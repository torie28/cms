import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ActivityService } from '../../../../core/activity';
import { httpErrorMessage } from '../../../../core/http-error';
import { I18nService, translate, TranslatePipe } from '../../../../core/i18n';
import {
  CategoryDefinition,
  Offering,
  OFFERING_CATEGORIES,
  OfferingCategory,
  OfferingPayload,
  OfferingService,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../../../../core/offerings';
import { Jumuiya, ParishService } from '../../../../core/parish';
import {
  datedFilename,
  EXPORT_FORMATS,
  ExportFormat,
  FORMAT_NAMES,
  saveCsv,
  savePdf,
  saveWorkbook,
  SheetData,
} from '../../../../core/spreadsheet';
import { FilterPanel, withinDateRange } from '../../../../shared/filter-panel';
import { matchesSearch, SearchBox } from '../../../../shared/search-box';

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';
type Sort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

interface CategoryTile extends CategoryDefinition {
  total: number;
  count: number;
  share: number;
}

const PERIODS: readonly { value: Period; label: string }[] = [
  { value: 'today', label: 'Leo' },
  { value: 'week', label: 'Wiki hii' },
  { value: 'month', label: 'Mwezi huu' },
  { value: 'year', label: 'Mwaka huu' },
  { value: 'custom', label: 'Chagua tarehe' },
];

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-sadaka',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, SearchBox, FilterPanel, TranslatePipe],
  templateUrl: './sadaka.html',
})
export class Sadaka {
  private readonly offeringsApi = inject(OfferingService);
  private readonly parish = inject(ParishService);
  private readonly activity = inject(ActivityService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18nService);

  protected readonly categories = OFFERING_CATEGORIES;
  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly periods = PERIODS;
  protected readonly exportFormats = EXPORT_FORMATS;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly today = isoDay(new Date());

  protected readonly offerings = signal<Offering[]>([]);
  protected readonly jumuiyas = signal<Jumuiya[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportOpen = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Offering | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly period = signal<Period>('month');
  protected readonly customFrom = signal(this.today.slice(0, 8) + '01');
  protected readonly customTo = signal(this.today);

  protected readonly search = signal('');
  protected readonly categoryFilter = signal<OfferingCategory | ''>('');
  protected readonly methodFilter = signal<PaymentMethod | ''>('');
  protected readonly jumuiyaFilter = signal(0);
  protected readonly sort = signal<Sort>('date-desc');

  protected readonly range = computed(() => {
    const now = new Date();

    switch (this.period()) {
      case 'today':
        return { from: this.today, to: this.today };
      case 'week': {
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        return { from: isoDay(monday), to: this.today };
      }
      case 'year':
        return { from: `${now.getFullYear()}-01-01`, to: this.today };
      case 'custom':
        return { from: this.customFrom(), to: this.customTo() };
      default:
        return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: this.today };
    }
  });

  private readonly currency = computed(
    () =>
      new Intl.NumberFormat(this.i18n.intlLocale(), {
        style: 'currency',
        currency: 'TZS',
        maximumFractionDigits: 0,
      }),
  );

  protected readonly grandTotal = computed(() =>
    this.offerings().reduce((sum, item) => sum + Number(item.amount), 0),
  );

  protected readonly tiles = computed<CategoryTile[]>(() => {
    const grand = this.grandTotal();

    return this.categories.map((category) => {
      const items = this.offerings().filter((item) => item.category === category.value);
      const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
      return { ...category, total, count: items.length, share: grand > 0 ? (total / grand) * 100 : 0 };
    });
  });

  protected readonly methodTotals = computed(() => {
    const grand = this.grandTotal();

    return this.paymentMethods.map((method) => {
      const total = this.offerings()
        .filter((item) => item.payment_method === method.value)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return { ...method, total, share: grand > 0 ? (total / grand) * 100 : 0 };
    });
  });

  protected readonly majitoleoByJumuiya = computed(() => {
    const totals = new Map<string, { name: string; total: number; count: number }>();

    for (const item of this.offerings()) {
      if (item.category !== 'majitoleo') {
        continue;
      }
      const name = item.jumuiya?.name ?? translate('Bila jumuiya');
      const entry = totals.get(name) ?? { name, total: 0, count: 0 };
      entry.total += Number(item.amount);
      entry.count++;
      totals.set(name, entry);
    }

    return [...totals.values()].sort((a, b) => b.total - a.total);
  });

  protected readonly majitoleoMax = computed(() =>
    Math.max(1, ...this.majitoleoByJumuiya().map((entry) => entry.total)),
  );

  protected readonly activeFilters = computed(
    () =>
      [this.categoryFilter(), this.methodFilter(), this.jumuiyaFilter()].filter(Boolean).length +
      (this.sort() === 'date-desc' ? 0 : 1),
  );

  protected readonly filtered = computed(() => {
    const category = this.categoryFilter();
    const method = this.methodFilter();
    const jumuiyaId = this.jumuiyaFilter();
    const sort = this.sort();

    return this.offerings()
      .filter(
        (item) =>
          (!category || item.category === category) &&
          (!method || item.payment_method === method) &&
          (!jumuiyaId || item.jumuiya_id === jumuiyaId) &&
          matchesSearch(this.search(), [
            translate(this.categoryLabel(item.category)),
            item.contributor,
            item.jumuiya?.name,
            item.reference,
            item.notes,
            item.recorded_by,
          ]),
      )
      .sort((a, b) => {
        if (sort === 'amount-desc' || sort === 'amount-asc') {
          const diff = Number(a.amount) - Number(b.amount);
          return sort === 'amount-desc' ? -diff : diff;
        }
        const diff = a.received_on.localeCompare(b.received_on) || a.id - b.id;
        return sort === 'date-asc' ? diff : -diff;
      });
  });

  protected readonly filteredTotal = computed(() =>
    this.filtered().reduce((sum, item) => sum + Number(item.amount), 0),
  );

  protected readonly filterSummary = computed(() =>
    this.search() || this.activeFilters() > 0
      ? translate('Kumbukumbu {shown} kati ya {total}', {
          shown: this.filtered().length,
          total: this.offerings().length,
        })
      : '',
  );

  protected readonly form = this.fb.nonNullable.group({
    category: ['sadaka' as OfferingCategory, Validators.required],
    received_on: [this.today, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    payment_method: ['cash' as PaymentMethod, Validators.required],
    jumuiya_id: [0],
    contributor: [''],
    reference: [''],
    notes: [''],
  });

  private readonly formCategory = signal<OfferingCategory>('sadaka');
  protected readonly selectedCategory = computed(
    () => this.categories.find((category) => category.value === this.formCategory()) ?? this.categories[0],
  );

  constructor() {
    this.form.controls.category.valueChanges.subscribe((value) => this.formCategory.set(value));
    this.applyQueryParams();

    afterNextRender(() => {
      void this.loadJumuiyas();
      void this.refresh();
    });
  }

  protected money(value: number | string): string {
    return this.currency().format(Number(value));
  }

  protected categoryLabel(value: string): string {
    return this.categories.find((category) => category.value === value)?.label ?? value;
  }

  protected methodLabel(value: string): string {
    return this.paymentMethods.find((method) => method.value === value)?.label ?? value;
  }

  protected setPeriod(value: Period): void {
    this.period.set(value);
    if (value !== 'custom') {
      void this.refresh();
    }
  }

  protected setCustomRange(from: string, to: string): void {
    this.customFrom.set(from);
    this.customTo.set(to);
    if (from && to && from <= to) {
      void this.refresh();
    }
  }

  protected toggleCategory(value: OfferingCategory): void {
    this.categoryFilter.update((current) => (current === value ? '' : value));
  }

  protected setCategoryFilter(value: string): void {
    this.categoryFilter.set(this.categories.some((c) => c.value === value) ? (value as OfferingCategory) : '');
  }

  protected setMethodFilter(value: string): void {
    this.methodFilter.set(this.paymentMethods.some((m) => m.value === value) ? (value as PaymentMethod) : '');
  }

  protected setJumuiyaFilter(value: string): void {
    this.jumuiyaFilter.set(Number(value) || 0);
  }

  protected setSort(value: string): void {
    this.sort.set(
      value === 'date-asc' || value === 'amount-desc' || value === 'amount-asc' ? value : 'date-desc',
    );
  }

  protected clearFilters(): void {
    this.categoryFilter.set('');
    this.methodFilter.set('');
    this.jumuiyaFilter.set(0);
    this.sort.set('date-desc');
  }

  protected async refresh(): Promise<void> {
    const { from, to } = this.range();
    if (from && to && from > to) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      this.offerings.set(await this.offeringsApi.list({ from, to }));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia kumbukumbu za sadaka.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected openForm(category?: OfferingCategory, event?: Event): void {
    event?.stopPropagation();
    this.editing.set(null);
    this.form.reset({
      category: category ?? (this.categoryFilter() || 'sadaka'),
      received_on: this.today,
      amount: null,
      payment_method: 'cash',
      jumuiya_id: this.jumuiyaFilter(),
      contributor: '',
      reference: '',
      notes: '',
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(item: Offering): void {
    this.editing.set(item);
    this.form.reset({
      category: item.category,
      received_on: item.received_on,
      amount: Number(item.amount),
      payment_method: item.payment_method,
      jumuiya_id: item.jumuiya_id ?? 0,
      contributor: item.contributor ?? '',
      reference: item.reference ?? '',
      notes: item.notes ?? '',
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    if (!this.saving()) {
      this.formOpen.set(false);
      this.editing.set(null);
    }
  }

  protected async submit(addAnother = false): Promise<void> {
    if (this.saving()) {
      return;
    }

    const raw = this.form.getRawValue();
    const category = this.selectedCategory();
    const problem =
      this.form.invalid
        ? 'Jaza aina, tarehe na kiasi sahihi.'
        : category.jumuiya && !Number(raw.jumuiya_id)
          ? 'Chagua jumuiya iliyotoa majitoleo haya.'
          : category.personal && !raw.contributor.trim()
            ? 'Andika jina la aliyetoa.'
            : raw.received_on > this.today
              ? 'Tarehe haiwezi kuwa ya baadaye.'
              : null;

    if (problem) {
      this.form.markAllAsTouched();
      this.formError.set(translate(problem));
      return;
    }

    const payload: OfferingPayload = {
      category: raw.category,
      amount: Number(raw.amount),
      received_on: raw.received_on,
      payment_method: raw.payment_method,
      jumuiya_id: Number(raw.jumuiya_id) || null,
      contributor: raw.contributor.trim(),
      reference: raw.reference.trim(),
      notes: raw.notes.trim(),
    };

    this.saving.set(true);
    this.formError.set(null);
    const editing = this.editing();

    try {
      const saved = editing
        ? await this.offeringsApi.update(editing.id, payload)
        : await this.offeringsApi.create(payload);

      this.upsert(saved);
      const inRange = withinDateRange(saved.received_on, this.range().from, this.range().to);
      const message = translate(editing ? '{category} ya {amount} imehifadhiwa.' : '{category} ya {amount} imerekodiwa.', {
        category: translate(this.categoryLabel(saved.category)),
        amount: this.money(saved.amount),
      });
      this.notice.set(
        inRange ? message : `${message} ${translate('Tarehe yake iko nje ya kipindi unachotazama.')}`,
      );

      if (addAnother && !editing) {
        this.form.patchValue({ amount: null, contributor: '', reference: '', notes: '' });
        this.form.markAsUntouched();
      } else {
        this.saving.set(false);
        this.closeForm();
      }
    } catch (error) {
      this.formError.set(
        httpErrorMessage(error, editing ? 'Imeshindwa kuhifadhi mabadiliko.' : 'Imeshindwa kurekodi mchango huo.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(item: Offering): Promise<void> {
    if (
      this.saving() ||
      !window.confirm(
        translate('Futa {category} ya {amount} ({date})?', {
          category: translate(this.categoryLabel(item.category)),
          amount: this.money(item.amount),
          date: item.received_on,
        }),
      )
    ) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      await this.offeringsApi.delete(item.id);
      this.offerings.update((current) => current.filter((entry) => entry.id !== item.id));
      this.notice.set(translate('Kumbukumbu imefutwa. Inaweza kurejeshwa kutoka kumbukumbu za shughuli ndani ya siku 30.'));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kufuta kumbukumbu hiyo.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected toggleExport(event: Event): void {
    event.stopPropagation();
    this.exportOpen.update((open) => !open);
  }

  protected async export(format: ExportFormat): Promise<void> {
    this.exportOpen.set(false);
    const rows = this.filtered();

    if (this.exporting() || rows.length === 0) {
      return;
    }

    this.exporting.set(true);
    this.error.set(null);

    try {
      const { from, to } = this.range();
      const title = translate('Sadaka na michango');
      const subtitle = translate('Kuanzia {from} hadi {to}', { from, to });
      const ledger: SheetData = {
        name: translate('Orodha ya michango'),
        head: ['Tarehe', 'Aina', 'Mtoaji', 'Jumuiya', 'Njia ya malipo', 'Namba ya risiti', 'Kiasi (TSh)', 'Maelezo'].map(
          (label) => translate(label),
        ),
        rows: rows.map((item) => [
          item.received_on,
          translate(this.categoryLabel(item.category)),
          item.contributor ?? '',
          item.jumuiya?.name ?? '',
          translate(this.methodLabel(item.payment_method)),
          item.reference ?? '',
          Number(item.amount).toFixed(2),
          item.notes ?? '',
        ]),
      };
      const summary: SheetData = {
        name: translate('Muhtasari'),
        head: [translate('Aina'), translate('Idadi'), translate('Jumla (TSh)')],
        rows: [
          ...this.categories
            .map((category) => {
              const items = rows.filter((item) => item.category === category.value);
              return [
                translate(category.label),
                String(items.length),
                items.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2),
              ];
            })
            .filter((row) => row[1] !== '0'),
          [translate('Jumla kuu'), String(rows.length), this.filteredTotal().toFixed(2)],
        ],
      };
      const filename = datedFilename(title);

      if (format === 'xlsx') {
        await saveWorkbook([summary, ledger], `${filename}.xlsx`);
      } else if (format === 'csv') {
        await saveCsv(ledger, `${filename}.csv`);
      } else {
        await savePdf(
          title,
          subtitle,
          [
            { heading: summary.name, head: summary.head, rows: summary.rows },
            { heading: ledger.name, head: ledger.head.slice(0, 7), rows: ledger.rows.map((row) => row.slice(0, 7)) },
          ],
          `${filename}.pdf`,
          format === 'print',
        );
      }

      void this.activity.record({
        action: 'exported',
        subject: `${rows.length} offerings (${from} – ${to}) as ${FORMAT_NAMES[format]}`,
        subject_type: 'offering',
      });
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuandaa faili la kupakua.'));
    } finally {
      this.exporting.set(false);
    }
  }

  /** Deep links from the overview: `?category=zaka` and/or `?from=YYYY-MM-DD&to=YYYY-MM-DD`. */
  private applyQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    this.setCategoryFilter(params.get('category') ?? '');

    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

    if (isDay(from) && isDay(to) && from <= to) {
      this.customFrom.set(from);
      this.customTo.set(to > this.today ? this.today : to);
      this.period.set('custom');
    }
  }

  private async loadJumuiyas(): Promise<void> {
    try {
      this.jumuiyas.set(await this.parish.listJumuiyas());
    } catch {
      // Only the jumuiya picker depends on this; recording other offerings still works.
    }
  }

  private upsert(saved: Offering): void {
    const { from, to } = this.range();
    this.offerings.update((current) => {
      const others = current.filter((item) => item.id !== saved.id);
      return withinDateRange(saved.received_on, from, to) ? [saved, ...others] : others;
    });
  }
}
