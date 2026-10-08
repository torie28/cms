import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ActivityService } from '../../../../core/activity';
import { AuthService } from '../../../../core/auth';
import { ConfirmService } from '../../../../core/confirm';
import { httpErrorMessage } from '../../../../core/http-error';
import { I18nService, translate, TranslatePipe } from '../../../../core/i18n';
import { displayPhone, normalizePhone } from '../../../../core/messages';
import {
  downloadOfferingTemplate,
  OfferingImportPlan,
  readOfferingSheet,
} from '../../../../core/offering-transfer';
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
  SPREADSHEET_ACCEPT,
} from '../../../../core/spreadsheet';
import { FilterPanel, withinDateRange } from '../../../../shared/filter-panel';
import { matchesSearch, SearchBox } from '../../../../shared/search-box';

type Period = 'today' | 'week' | 'month' | 'last-month' | 'year' | 'custom';
type Sort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

/** 0 means "show everything on one page". */
const PAGE_SIZES = [10, 25, 50, 100, 0] as const;
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_KEY = 'cms.sadaka.pageSize';

/** Page numbers to show, with 'gap' where a run of pages is collapsed: 1 … 4 5 6 … 20. */
function pageWindow(current: number, count: number): (number | 'gap')[] {
  if (count <= 7) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  let start = Math.max(2, Math.min(current - 1, count - 4));
  let end = Math.min(count - 1, Math.max(current + 1, 5));
  // A gap hiding a single page takes as much room as that page's number, so show the number.
  if (start === 3) {
    start = 2;
  }
  if (end === count - 2) {
    end = count - 1;
  }
  return [
    1,
    ...(start > 2 ? (['gap'] as const) : []),
    ...Array.from({ length: end - start + 1 }, (_, i) => start + i),
    ...(end < count - 1 ? (['gap'] as const) : []),
    count,
  ];
}

interface CategoryTile extends CategoryDefinition {
  total: number;
  count: number;
  share: number;
}

const PERIODS: readonly { value: Period; label: string }[] = [
  { value: 'today', label: 'Leo' },
  { value: 'week', label: 'Wiki hii' },
  { value: 'month', label: 'Mwezi huu' },
  { value: 'last-month', label: 'Mwezi uliopita' },
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
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly canCreate = computed(() => this.auth.can('sadaka', 'create'));
  protected readonly canUpdate = computed(() => this.auth.can('sadaka', 'update'));
  protected readonly canDelete = computed(() => this.auth.can('sadaka', 'delete'));

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

  protected readonly spreadsheetAccept = SPREADSHEET_ACCEPT;
  protected readonly importCategory = signal<CategoryDefinition | null>(null);
  protected readonly importPlan = signal<OfferingImportPlan | null>(null);
  protected readonly importFileName = signal<string | null>(null);
  protected readonly importError = signal<string | null>(null);
  protected readonly importing = signal(false);
  protected readonly importProgress = signal(0);
  protected readonly importThankYou = signal(false);
  protected readonly importFailures = signal<string[]>([]);

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
      case 'last-month':
        return {
          from: isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
          to: isoDay(new Date(now.getFullYear(), now.getMonth(), 0)),
        };
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

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly pageSize = signal<number>(DEFAULT_PAGE_SIZE);
  private readonly requestedPage = signal(1);
  private readonly ledger = viewChild<ElementRef<HTMLElement>>('ledger');

  protected readonly pageCount = computed(() => {
    const size = this.pageSize();
    return size === 0 ? 1 : Math.max(1, Math.ceil(this.filtered().length / size));
  });
  /** Clamped so deleting the last row of the last page falls back a page instead of showing nothing. */
  protected readonly page = computed(() => Math.min(this.requestedPage(), this.pageCount()));
  protected readonly pageStart = computed(() => (this.pageSize() === 0 ? 0 : (this.page() - 1) * this.pageSize()));
  protected readonly pageRows = computed(() => {
    const size = this.pageSize();
    return size === 0 ? this.filtered() : this.filtered().slice(this.pageStart(), this.pageStart() + size);
  });
  protected readonly pageTotal = computed(() =>
    this.pageRows().reduce((sum, item) => sum + Number(item.amount), 0),
  );
  protected readonly pages = computed(() => pageWindow(this.page(), this.pageCount()));

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
    contributor_phone: [''],
    send_thank_you: [true],
    reference: [''],
    notes: [''],
  });

  private readonly formCategory = signal<OfferingCategory>('sadaka');
  protected readonly selectedCategory = computed(
    () => this.categories.find((category) => category.value === this.formCategory()) ?? this.categories[0],
  );

  protected readonly displayPhone = displayPhone;
  protected readonly normalizePhone = normalizePhone;
  private readonly formPhone = signal('');
  /** The thank-you SMS goes out once per offering, so editing only offers it if none was sent yet. */
  protected readonly canSendThankYou = computed(
    () => !!this.selectedCategory().thankYou && !!this.formPhone().trim() && !this.editing()?.thank_you_message_id,
  );

  constructor() {
    this.form.controls.category.valueChanges.subscribe((value) => this.formCategory.set(value));
    this.form.controls.contributor_phone.valueChanges.subscribe((value) => this.formPhone.set(value));
    this.applyQueryParams();

    // Any change to what is being listed starts again from the first page.
    effect(() => {
      this.search();
      this.categoryFilter();
      this.methodFilter();
      this.jumuiyaFilter();
      this.sort();
      this.range();
      this.pageSize();
      untracked(() => this.requestedPage.set(1));
    });

    afterNextRender(() => {
      const stored = localStorage.getItem(PAGE_SIZE_KEY);
      if (stored !== null && (PAGE_SIZES as readonly number[]).includes(Number(stored))) {
        this.pageSize.set(Number(stored));
      }
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

  protected setPageSize(value: string): void {
    const size = Number(value);
    if (!(PAGE_SIZES as readonly number[]).includes(size)) {
      return;
    }
    this.pageSize.set(size);
    localStorage.setItem(PAGE_SIZE_KEY, String(size));
  }

  protected goToPage(target: number): void {
    const next = Math.min(Math.max(1, target), this.pageCount());
    if (next === this.page()) {
      return;
    }
    this.requestedPage.set(next);
    const top = this.ledger()?.nativeElement;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
      contributor_phone: '',
      send_thank_you: true,
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
      contributor_phone: item.contributor_phone ?? '',
      send_thank_you: true,
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
            : raw.contributor_phone.trim() && !normalizePhone(raw.contributor_phone)
              ? 'Namba ya simu ya mtoaji si sahihi.'
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
      contributor_phone: raw.contributor_phone.trim(),
      send_thank_you: raw.send_thank_you,
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
      const thanked = saved.thank_you_message && !editing?.thank_you_message_id ? saved.thank_you_message : null;
      const thankYouNote = !thanked
        ? ''
        : thanked.status === 'sent'
          ? translate('SMS ya shukrani imetumwa kwa {phone}.', { phone: displayPhone(saved.contributor_phone) })
          : translate('SMS ya shukrani imeshindwa kutumwa; unaweza kuituma tena kutoka Arifa na SMS.');
      this.notice.set(
        [message, inRange ? '' : translate('Tarehe yake iko nje ya kipindi unachotazama.'), thankYouNote]
          .filter(Boolean)
          .join(' '),
      );

      if (addAnother && !editing) {
        this.form.patchValue({ amount: null, contributor: '', contributor_phone: '', reference: '', notes: '' });
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
    if (this.saving()) {
      return;
    }
    const confirmed = await this.confirm.ask({
      message: translate('Futa {category} ya {amount} ({date})?', {
        category: translate(this.categoryLabel(item.category)),
        amount: this.money(item.amount),
        date: item.received_on,
      }),
      tone: 'danger',
    });
    if (!confirmed || this.saving()) {
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

  /** Opens the Excel import for a personal category (Zaka, Fungu la kumi); closes the single-entry form if it was open. */
  protected openImport(category: CategoryDefinition, event?: Event): void {
    event?.stopPropagation();
    if (this.saving()) {
      return;
    }
    this.formOpen.set(false);
    this.editing.set(null);
    this.importCategory.set(category);
    this.importPlan.set(null);
    this.importFileName.set(null);
    this.importError.set(null);
    this.importFailures.set([]);
    this.importProgress.set(0);
    this.importThankYou.set(false);
  }

  protected closeImport(): void {
    if (!this.importing()) {
      this.importCategory.set(null);
      this.importPlan.set(null);
    }
  }

  protected async downloadImportTemplate(): Promise<void> {
    const category = this.importCategory();
    if (category) {
      await downloadOfferingTemplate(translate(category.label), this.today);
    }
  }

  protected async chooseImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const category = this.importCategory();

    if (!file || !category) {
      return;
    }

    this.importFileName.set(file.name);
    this.importPlan.set(null);
    this.importError.set(null);
    this.importFailures.set([]);

    try {
      const plan = await readOfferingSheet(file, category.value, this.jumuiyas(), this.today);
      if (plan.rows.length === 0 && plan.errors.length === 0) {
        this.importError.set(translate('Faili hilo halina safu zenye taarifa.'));
        return;
      }
      this.importPlan.set(plan);
    } catch (error) {
      this.importError.set(
        error instanceof Error && error.message ? error.message : translate('Imeshindwa kusoma faili hilo.'),
      );
    }
  }

  protected async runImport(): Promise<void> {
    const plan = this.importPlan();
    const category = this.importCategory();
    if (!plan || !category || plan.rows.length === 0 || this.importing()) {
      return;
    }

    this.importing.set(true);
    this.importProgress.set(0);
    this.importError.set(null);
    this.importFailures.set([]);

    const failures: string[] = [];
    const saved: Offering[] = [];
    let thanked = 0;
    const queue = [...plan.rows];
    // A few requests at a time keeps large sheets quick without flooding the API or the SMS gateway.
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        try {
          const offering = await this.offeringsApi.create({ ...row.payload, send_thank_you: this.importThankYou() });
          saved.push(offering);
          if (offering.thank_you_message?.status === 'sent') {
            thanked++;
          }
        } catch (error) {
          failures.push(
            translate('Mstari {line} ({name}): {reason}', {
              line: row.line,
              name: row.payload.contributor,
              reason: httpErrorMessage(error, 'imeshindwa kuhifadhiwa.'),
            }),
          );
        }
        this.importProgress.update((done) => done + 1);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, plan.rows.length) }, worker));

    this.importing.set(false);

    if (saved.length > 0) {
      const total = saved.reduce((sum, item) => sum + Number(item.amount), 0);
      void this.activity.record({
        action: 'imported',
        subject:
          `${saved.length} ${category.label} offerings (TSh ${total.toLocaleString('en')})` +
          (this.importFileName() ? ` from ${this.importFileName()}` : ''),
        subject_type: 'offering',
      });
      await this.refresh();
      this.notice.set(
        [
          translate('{category}: michango {count} ya jumla {amount} imeingizwa kutoka Excel.', {
            category: translate(category.label),
            count: saved.length,
            amount: this.money(total),
          }),
          thanked > 0 ? translate('SMS za shukrani {count} zimetumwa.', { count: thanked }) : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
    }

    if (failures.length > 0) {
      failures.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      this.importPlan.set(null);
      this.importFailures.set(failures);
      this.importError.set(
        translate('Michango {saved} imeingizwa, {failed} imeshindwa. Rekebisha mistari hii kisha uingize faili lenye hiyo tu.', {
          saved: saved.length,
          failed: failures.length,
        }),
      );
      return;
    }

    this.closeImport();
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
