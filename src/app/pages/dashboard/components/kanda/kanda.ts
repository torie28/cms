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
import { translate, TranslatePipe } from '../../../../core/i18n';
import {
  downloadKandaTemplate,
  exportKandas,
  KandaRow,
  readKandaSpreadsheet,
} from '../../../../core/kanda-transfer';
import { Kanda, ParishService } from '../../../../core/parish';
import {
  EXPORT_FORMATS,
  ExportFormat,
  FORMAT_NAMES,
  SPREADSHEET_ACCEPT,
} from '../../../../core/spreadsheet';
import { FilterPanel, parseBound, withinNumberRange } from '../../../../shared/filter-panel';
import { matchesSearch, SearchBox } from '../../../../shared/search-box';

type KandaSort = 'name' | 'name-desc' | 'jumuiyas-desc' | 'jumuiyas-asc';

interface KandaImportPlan {
  fresh: { name: string; leader: string; notes: string }[];
  existing: string[];
  issues: string[];
}

@Component({
  selector: 'app-kanda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SearchBox, FilterPanel, TranslatePipe],
  templateUrl: './kanda.html',
})
export class KandaPage {
  private readonly parish = inject(ParishService);
  private readonly activity = inject(ActivityService);

  protected readonly exportFormats = EXPORT_FORMATS;
  protected readonly spreadsheetAccept = SPREADSHEET_ACCEPT;
  protected readonly importOpen = signal(false);
  protected readonly importPlan = signal<KandaImportPlan | null>(null);
  protected readonly importFileName = signal<string | null>(null);
  protected readonly importError = signal<string | null>(null);
  protected readonly importing = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly exportMenuOpen = signal(false);
  protected readonly exporting = signal(false);

  protected readonly kandas = signal<Kanda[]>([]);
  protected readonly search = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '');
  protected readonly leaderFilter = signal<'' | 'has' | 'none'>('');
  protected readonly minJumuiyas = signal('');
  protected readonly maxJumuiyas = signal('');
  protected readonly sort = signal<KandaSort>('name');

  protected readonly activeFilters = computed(
    () =>
      [this.leaderFilter(), this.minJumuiyas(), this.maxJumuiyas()].filter(Boolean).length +
      (this.sort() === 'name' ? 0 : 1),
  );

  protected readonly filteredKandas = computed(() => {
    const leader = this.leaderFilter();
    const min = parseBound(this.minJumuiyas());
    const max = parseBound(this.maxJumuiyas());
    const sort = this.sort();

    return this.kandas()
      .filter(
        (kanda) =>
          (leader === '' || (leader === 'has') === !!kanda.leader?.trim()) &&
          withinNumberRange(kanda.jumuiyas_count, min, max) &&
          matchesSearch(this.search(), [kanda.name, kanda.leader, kanda.notes]),
      )
      .sort((a, b) => {
        if (sort === 'jumuiyas-desc' || sort === 'jumuiyas-asc') {
          const diff = a.jumuiyas_count - b.jumuiyas_count;
          return sort === 'jumuiyas-desc' ? -diff : diff;
        }

        const diff = a.name.localeCompare(b.name);
        return sort === 'name-desc' ? -diff : diff;
      });
  });

  protected readonly filterSummary = computed(() =>
    this.search() || this.activeFilters() > 0
      ? translate('Kanda {shown} kati ya {total}', {
          shown: this.filteredKandas().length,
          total: this.kandas().length,
        })
      : '',
  );
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly skeletonCards = [1, 2, 3];

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    leader: [''],
    notes: [''],
  });

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected openForm(): void {
    this.form.reset({ name: '', leader: '', notes: '' });
    this.error.set(null);
    this.formOpen.set(true);
  }

  protected openImport(): void {
    this.importPlan.set(null);
    this.importFileName.set(null);
    this.importError.set(null);
    this.exportMenuOpen.set(false);
    this.importOpen.set(true);
  }

  protected closeImport(): void {
    if (!this.importing()) {
      this.importOpen.set(false);
      this.importPlan.set(null);
    }
  }

  protected async downloadImportTemplate(): Promise<void> {
    await downloadKandaTemplate();
  }

  protected async chooseImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    this.importFileName.set(file.name);
    this.importPlan.set(null);
    this.importError.set(null);

    try {
      const rows = await readKandaSpreadsheet(file);
      if (rows.length === 0) {
        this.importError.set(translate('Faili hilo halina safu zenye taarifa.'));
        return;
      }
      this.importPlan.set(this.buildImportPlan(rows));
    } catch (error) {
      this.importError.set(
        error instanceof Error && error.message
          ? error.message
          : translate('Imeshindwa kusoma faili hilo.'),
      );
    }
  }

  protected async runImport(): Promise<void> {
    const plan = this.importPlan();

    if (!plan || plan.fresh.length === 0 || this.importing()) {
      return;
    }

    this.importing.set(true);
    this.importError.set(null);

    try {
      const result = await this.parish.importKandas(plan.fresh, this.importFileName() ?? '');
      this.kandas.set(result.kandas);
      this.importing.set(false);
      this.closeImport();
      this.notice.set(
        result.skipped.length > 0
          ? translate('Uingizaji umekamilika: kanda mpya {created}, zilizorukwa (tayari zipo) {skipped}.', {
              created: result.created,
              skipped: result.skipped.length,
            })
          : translate('Uingizaji umekamilika: kanda mpya {created}.', { created: result.created }),
      );
    } catch (error) {
      this.importError.set(httpErrorMessage(error, 'Imeshindwa kuingiza kanda hizo.'));
    } finally {
      this.importing.set(false);
    }
  }

  protected toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.exportMenuOpen.update((open) => !open);
  }

  protected async exportList(format: ExportFormat): Promise<void> {
    this.exportMenuOpen.set(false);
    const kandas = this.filteredKandas();

    if (this.exporting() || kandas.length === 0) {
      return;
    }

    this.exporting.set(true);
    this.error.set(null);

    try {
      const ids = new Set(kandas.map((kanda) => kanda.id));
      const jumuiyas = (await this.parish.listJumuiyas()).filter((group) => ids.has(group.kanda_id));
      await exportKandas(kandas, jumuiyas, format);
      void this.activity.record({
        action: 'exported',
        subject: `${kandas.length} kandas as ${FORMAT_NAMES[format]}`,
        subject_type: 'kanda',
      });
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuandaa faili la kupakua.'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected clearFilters(): void {
    this.leaderFilter.set('');
    this.minJumuiyas.set('');
    this.maxJumuiyas.set('');
    this.sort.set('name');
  }

  protected setLeaderFilter(value: string): void {
    this.leaderFilter.set(value === 'has' || value === 'none' ? value : '');
  }

  protected setSort(value: string): void {
    this.sort.set(value as KandaSort);
  }

  private buildImportPlan(rows: KandaRow[]): KandaImportPlan {
    const known = new Set(this.kandas().map((kanda) => kanda.name.trim().toLowerCase()));
    const seen = new Set<string>();
    const plan: KandaImportPlan = { fresh: [], existing: [], issues: [] };

    for (const row of rows) {
      const name = row.name.trim();
      const key = name.toLowerCase();

      if (!name) {
        plan.issues.push(translate('Mstari {line}: jina la kanda halipo, umerukwa.', { line: row.line }));
      } else if (name.length > 255 || row.leader.length > 255) {
        plan.issues.push(
          translate('Mstari {line}: jina au kiongozi ni ndefu mno, umerukwa.', { line: row.line }),
        );
      } else if (seen.has(key)) {
        plan.issues.push(
          translate('Mstari {line}: "{name}" imerudiwa kwenye faili, umerukwa.', { line: row.line, name }),
        );
      } else if (known.has(key)) {
        seen.add(key);
        plan.existing.push(name);
      } else {
        seen.add(key);
        plan.fresh.push({ name, leader: row.leader, notes: row.notes });
      }
    }

    return plan;
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.kandas.set(await this.parish.listKandas());
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia kanda.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const created = await this.parish.createKanda(this.form.getRawValue());
      this.kandas.update((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.closeForm();
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuongeza kanda hiyo.'));
    } finally {
      this.saving.set(false);
    }
  }
}
