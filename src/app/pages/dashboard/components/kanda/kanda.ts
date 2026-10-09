import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActivityService } from '../../../../core/activity';
import { AuthService } from '../../../../core/auth';
import { httpErrorMessage } from '../../../../core/http-error';
import { I18nService, translate, TranslatePipe } from '../../../../core/i18n';
import {
  downloadKandaTemplate,
  exportKandaProfile,
  exportKandas,
  KandaRow,
  readKandaSpreadsheet,
} from '../../../../core/kanda-transfer';
import {
  buildImportPlan,
  downloadKandaJumuiyaTemplate,
  downloadTemplate,
  importNotice,
  ImportPlan,
  readJumuiyaMemberSheet,
  readSpreadsheet,
  runImportPlan,
} from '../../../../core/jumuiya-transfer';
import { OfferingService } from '../../../../core/offerings';
import { Jumuiya, Kanda, KandaDetail, KandaSplitResult, ParishService } from '../../../../core/parish';
import {
  EXPORT_FORMATS,
  ExportFormat,
  FORMAT_NAMES,
  SPREADSHEET_ACCEPT,
} from '../../../../core/spreadsheet';
import { FilterPanel, parseBound, withinNumberRange } from '../../../../shared/filter-panel';
import { JumuiyaCreateDialog } from '../../../../shared/jumuiya-create-dialog';
import { JumuiyaMoveDialog } from '../../../../shared/jumuiya-move-dialog';
import { JumuiyaSplitDialog, JumuiyaSplitResult } from '../../../../shared/jumuiya-split-dialog';
import { KandaSplitDialog } from '../../../../shared/kanda-split-dialog';
import { matchesSearch, SearchBox } from '../../../../shared/search-box';

type KandaSort = 'name' | 'name-desc' | 'jumuiyas-desc' | 'jumuiyas-asc' | 'members-desc';

const CHART_LIMIT = 8;

interface KandaImportPlan {
  fresh: { name: string; leader: string; notes: string }[];
  existing: string[];
  issues: string[];
}

@Component({
  selector: 'app-kanda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    SearchBox,
    FilterPanel,
    JumuiyaSplitDialog,
    JumuiyaMoveDialog,
    KandaSplitDialog,
    JumuiyaCreateDialog,
    TranslatePipe,
  ],
  templateUrl: './kanda.html',
})
export class KandaPage {
  private readonly parish = inject(ParishService);
  private readonly offeringsApi = inject(OfferingService);
  private readonly activity = inject(ActivityService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  protected readonly canCreate = computed(() => this.auth.can('kanda', 'create'));
  protected readonly canUpdate = computed(() => this.auth.can('kanda', 'update'));
  protected readonly canDelete = computed(() => this.auth.can('kanda', 'delete'));
  protected readonly editingKanda = signal<Kanda | null>(null);
  protected readonly deleteTarget = signal<Kanda | null>(null);
  protected readonly deleteMoveTo = signal(0);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly deleteMoveOptions = computed(() =>
    this.kandas().filter((kanda) => kanda.id !== this.deleteTarget()?.id),
  );
  protected readonly canSplit = computed(
    () => this.auth.can('jumuiya', 'create') && this.auth.can('jumuiya', 'update'),
  );
  protected readonly canSplitKanda = computed(() => this.canCreate() && this.canUpdate());
  protected readonly canAddJumuiya = computed(() => this.auth.can('jumuiya', 'create'));
  protected readonly addJumuiyaTarget = signal<Kanda | null>(null);
  protected readonly kandaSplitTarget = signal<Kanda | null>(null);

  protected readonly jumuiyas = signal<Jumuiya[]>([]);
  protected readonly detailOpen = signal(false);
  protected readonly detail = signal<KandaDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);
  protected readonly splitTarget = signal<Jumuiya | null>(null);
  protected readonly moveTarget = signal<Jumuiya | null>(null);
  protected readonly canMove = computed(() => this.auth.can('jumuiya', 'update'));

  protected readonly totals = computed(() => {
    const kandas = this.kandas();
    const jumuiyas = kandas.reduce((sum, kanda) => sum + kanda.jumuiyas_count, 0);
    const members = kandas.reduce((sum, kanda) => sum + (kanda.members_count ?? 0), 0);

    return {
      kandas: kandas.length,
      jumuiyas,
      members,
      withoutLeader: kandas.filter((kanda) => !kanda.leader?.trim()).length,
      jumuiyasPerKanda: kandas.length ? jumuiyas / kandas.length : 0,
      membersPerJumuiya: jumuiyas ? members / jumuiyas : 0,
    };
  });

  private readonly largestKanda = computed(() =>
    Math.max(1, ...this.kandas().map((kanda) => kanda.members_count ?? 0)),
  );

  protected readonly sizeChart = computed(() => {
    const largest = this.largestKanda();

    return [...this.kandas()]
      .sort((a, b) => (b.members_count ?? 0) - (a.members_count ?? 0) || a.name.localeCompare(b.name))
      .slice(0, CHART_LIMIT)
      .map((kanda) => ({ kanda, share: ((kanda.members_count ?? 0) / largest) * 100 }));
  });

  protected readonly chartOverflow = computed(() => Math.max(0, this.kandas().length - CHART_LIMIT));

  protected readonly attention = computed(() => {
    const items: { kanda: Kanda; reason: string }[] = [];

    for (const kanda of this.kandas()) {
      if (kanda.jumuiyas_count === 0) {
        items.push({ kanda, reason: 'Haina jumuiya' });
      } else if (!kanda.leader?.trim()) {
        items.push({ kanda, reason: 'Haina kiongozi' });
      } else if ((kanda.members_count ?? 0) === 0) {
        items.push({ kanda, reason: 'Haina wanajumuiya' });
      }
    }

    return items.slice(0, 6);
  });

  private readonly splitJumuiyas = computed(() => this.jumuiyas().filter((group) => group.parent));
  protected readonly splitCount = computed(() => this.splitJumuiyas().length);
  protected readonly recentSplits = computed(() =>
    [...this.splitJumuiyas()].sort((a, b) => b.id - a.id).slice(0, 5),
  );

  protected readonly detailSplitCount = computed(
    () => (this.detail()?.jumuiyas ?? []).filter((group) => group.parent).length,
  );

  protected readonly detailLargestJumuiya = computed(() =>
    Math.max(1, ...(this.detail()?.jumuiyas ?? []).map((group) => group.members_count)),
  );

  private readonly currency = computed(
    () =>
      new Intl.NumberFormat(this.i18n.intlLocale(), {
        style: 'currency',
        currency: 'TZS',
        maximumFractionDigits: 0,
      }),
  );

  protected readonly exportFormats = EXPORT_FORMATS;
  protected readonly spreadsheetAccept = SPREADSHEET_ACCEPT;
  protected readonly importOpen = signal(false);
  protected readonly importPlan = signal<KandaImportPlan | null>(null);
  /** Set instead of `importPlan` when the file is a kanda's filled-in jumuiya + members template. */
  protected readonly memberImportPlan = signal<ImportPlan | null>(null);
  /** When set, the import dialog adds jumuiyas (and their members) to this kanda instead of creating kandas. */
  protected readonly importKanda = signal<Kanda | null>(null);
  protected readonly importFileName = signal<string | null>(null);
  protected readonly importError = signal<string | null>(null);
  protected readonly importing = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly exportMenuOpen = signal(false);
  protected readonly detailExportOpen = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportingKandaId = signal<number | null>(null);

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
        if (sort === 'members-desc') {
          return (b.members_count ?? 0) - (a.members_count ?? 0);
        }

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

  protected openForm(kanda?: Kanda, event?: Event): void {
    event?.stopPropagation();
    this.editingKanda.set(kanda ?? null);
    this.form.reset({ name: kanda?.name ?? '', leader: kanda?.leader ?? '', notes: kanda?.notes ?? '' });
    this.error.set(null);
    this.formOpen.set(true);
  }

  protected openDelete(kanda: Kanda, event?: Event): void {
    event?.stopPropagation();
    this.deleteTarget.set(kanda);
    this.deleteError.set(null);
    this.deleteMoveTo.set(0);
  }

  protected closeDelete(): void {
    if (!this.deleting()) {
      this.deleteTarget.set(null);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const kanda = this.deleteTarget();

    if (!kanda || this.deleting()) {
      return;
    }

    const needsMove = kanda.jumuiyas_count > 0;
    if (needsMove && !this.deleteMoveTo()) {
      this.deleteError.set(translate('Chagua kanda ya kuhamishia jumuiya zake.'));
      return;
    }

    this.deleting.set(true);
    this.deleteError.set(null);

    try {
      const target = needsMove ? this.kandas().find((item) => item.id === this.deleteMoveTo()) : undefined;
      await this.parish.deleteKanda(kanda.id, target?.id);
      this.deleting.set(false);
      this.deleteTarget.set(null);

      if (this.detail()?.id === kanda.id) {
        this.closeDetail();
      }

      this.notice.set(
        target
          ? translate('{name} imefutwa. Jumuiya zake {count} zimehamishiwa {target}.', {
              name: kanda.name,
              count: kanda.jumuiyas_count,
              target: target.name,
            })
          : translate('{name} imefutwa. Unaweza kuirejesha kutoka kumbukumbu za shughuli.', { name: kanda.name }),
      );
      await this.refresh();
    } catch (error) {
      this.deleteError.set(httpErrorMessage(error, 'Imeshindwa kufuta kanda hiyo.'));
    } finally {
      this.deleting.set(false);
    }
  }

  protected openImport(kanda?: Kanda, event?: Event): void {
    event?.stopPropagation();
    this.importKanda.set(kanda ?? null);
    this.importPlan.set(null);
    this.memberImportPlan.set(null);
    this.importFileName.set(null);
    this.importError.set(null);
    this.exportMenuOpen.set(false);
    this.importOpen.set(true);
  }

  protected closeImport(): void {
    if (!this.importing()) {
      this.importOpen.set(false);
      this.importKanda.set(null);
      this.importPlan.set(null);
      this.memberImportPlan.set(null);
    }
  }

  protected async downloadImportTemplate(): Promise<void> {
    const kanda = this.importKanda();
    await (kanda ? this.downloadFillTemplate(kanda) : downloadKandaTemplate());
  }

  /** A template for filling this kanda's jumuiyas and members, imported from the Jumuiya page. */
  protected async downloadFillTemplate(kanda: Kanda, event?: Event): Promise<void> {
    event?.stopPropagation();
    const error = this.detailOpen() ? this.detailError : this.error;
    error.set(null);

    try {
      const names =
        this.detail()?.id === kanda.id
          ? this.detail()!.jumuiyas.map((group) => group.name)
          : this.jumuiyas()
              .filter((group) => group.kanda_id === kanda.id)
              .map((group) => group.name);
      await downloadKandaJumuiyaTemplate(kanda.name, names);
    } catch (failure) {
      error.set(httpErrorMessage(failure, 'Imeshindwa kuandaa faili la kupakua.'));
    }
  }

  protected async downloadJumuiyaTemplate(group: Jumuiya): Promise<void> {
    this.detailError.set(null);

    try {
      await downloadTemplate(group.name, this.detail()?.name);
    } catch (failure) {
      this.detailError.set(httpErrorMessage(failure, 'Imeshindwa kuandaa faili la kupakua.'));
    }
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
    this.memberImportPlan.set(null);
    this.importError.set(null);

    try {
      const kanda = this.importKanda();
      if (kanda) {
        const rows = await readSpreadsheet(file);
        if (rows.length === 0) {
          this.importError.set(translate('Faili hilo halina jumuiya wala wanajumuiya waliojazwa.'));
          return;
        }
        this.memberImportPlan.set(
          buildImportPlan(rows, { jumuiyas: this.jumuiyas(), kandas: this.kandas(), kanda }),
        );
        return;
      }

      const memberRows = await readJumuiyaMemberSheet(file);
      if (memberRows) {
        if (memberRows.length === 0) {
          this.importError.set(translate('Faili hilo halina jumuiya wala wanajumuiya waliojazwa.'));
          return;
        }
        this.memberImportPlan.set(
          buildImportPlan(memberRows, { jumuiyas: this.jumuiyas(), kandas: this.kandas() }),
        );
        return;
      }

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
    if (this.memberImportPlan()) {
      await this.runMemberImport();
      return;
    }

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

  private async runMemberImport(): Promise<void> {
    const plan = this.memberImportPlan();

    if (!plan || plan.groups.length === 0 || this.importing()) {
      return;
    }

    this.importing.set(true);
    this.importError.set(null);
    const result = await runImportPlan(plan, this.parish);
    const { created, added, failures } = result;
    this.importing.set(false);

    if (created > 0 || added > 0) {
      void this.activity.record({
        action: 'imported',
        subject:
          `${created} jumuiyas and ${added} members` +
          (this.importKanda() ? ` into ${this.importKanda()!.name}` : '') +
          (this.importFileName() ? ` from ${this.importFileName()}` : ''),
        subject_type: 'jumuiya',
      });
    }

    const current = this.detail();
    await Promise.all([this.refresh(), current ? this.loadDetail(current.id) : Promise.resolve()]);

    this.notice.set(result.saved.length > 0 ? importNotice(result) : null);

    if (failures.length > 0) {
      this.memberImportPlan.set(null);
      this.importError.set(translate('Baadhi hazikuingizwa. {failures}', { failures: failures.join(' · ') }));
      return;
    }

    this.closeImport();
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

  /** Exports one kanda in full: its details, jumuiyas, every member and the jumuiyas' offerings. */
  protected async exportKanda(kanda: Kanda, format: ExportFormat): Promise<void> {
    this.detailExportOpen.set(false);

    if (this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.exportingKandaId.set(kanda.id);
    this.error.set(null);
    this.detailError.set(null);

    try {
      const detail = this.detail()?.id === kanda.id ? this.detail()! : await this.parish.getKanda(kanda.id);
      const ids = detail.jumuiyas.map((group) => group.id);
      const [groups, offerings] = await Promise.all([
        Promise.all(ids.map((id) => this.parish.getJumuiya(id))),
        this.auth.canAccess('sadaka')
          ? ids.length > 0
            ? this.offeringsApi.list({ from: '', to: '', jumuiyaIds: ids }).catch(() => null)
            : Promise.resolve([])
          : Promise.resolve(null),
      ]);
      await exportKandaProfile(detail, groups, offerings, format);
      void this.activity.record({
        action: 'exported',
        subject: `${kanda.name} (details, ${groups.length} jumuiyas${
          offerings ? `, ${offerings.length} offerings` : ''
        }) as ${FORMAT_NAMES[format]}`,
        subject_type: 'kanda',
      });
    } catch (error) {
      const message = httpErrorMessage(error, 'Imeshindwa kuandaa faili la kupakua.');
      (this.detailOpen() ? this.detailError : this.error).set(message);
    } finally {
      this.exporting.set(false);
      this.exportingKandaId.set(null);
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
    const repeats = new Map<string, { name: string; lines: number[] }>();

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
        repeats.set(key, { name, lines: [...(repeats.get(key)?.lines ?? []), row.line] });
      } else if (known.has(key)) {
        seen.add(key);
        plan.existing.push(name);
      } else {
        seen.add(key);
        plan.fresh.push({ name, leader: row.leader, notes: row.notes });
      }
    }

    for (const { name, lines } of repeats.values()) {
      plan.issues.push(
        lines.length === 1
          ? translate('Mstari {line}: "{name}" imerudiwa kwenye faili, umerukwa.', { line: lines[0], name })
          : translate('"{name}" imerudiwa mara {count} kwenye faili (mistari {from}–{to}); nakala za ziada zimerukwa.', {
              name,
              count: lines.length,
              from: lines[0],
              to: lines[lines.length - 1],
            }),
      );
    }

    return plan;
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editingKanda.set(null);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [kandas, jumuiyas] = await Promise.all([
        this.parish.listKandas(),
        this.parish.listJumuiyas().catch(() => [] as Jumuiya[]),
      ]);
      this.kandas.set(kandas);
      this.jumuiyas.set(jumuiyas);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia kanda.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async openDetail(kanda: Kanda): Promise<void> {
    this.detail.set(null);
    this.detailError.set(null);
    this.detailOpen.set(true);
    await this.loadDetail(kanda.id);
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.detail.set(null);
  }

  protected openSplit(group: Jumuiya): void {
    this.splitTarget.set(group);
  }

  protected openAddJumuiya(kanda: Kanda, event?: Event): void {
    event?.stopPropagation();
    this.addJumuiyaTarget.set(kanda);
  }

  protected async onJumuiyaAdded(created: Jumuiya): Promise<void> {
    const kanda = this.addJumuiyaTarget();
    this.addJumuiyaTarget.set(null);
    this.notice.set(
      translate('{name} imeongezwa kwenye {kanda} ikiwa na wanajumuiya {count}.', {
        name: created.name,
        kanda: kanda?.name ?? created.kanda?.name ?? '—',
        count: created.members_count ?? 0,
      }),
    );

    const current = this.detail();
    await Promise.all([this.refresh(), current ? this.loadDetail(current.id) : Promise.resolve()]);
  }

  protected openKandaSplit(kanda: Kanda, event?: Event): void {
    event?.stopPropagation();
    this.kandaSplitTarget.set(kanda);
  }

  protected async onKandaSplitDone(result: KandaSplitResult): Promise<void> {
    const { parent, kanda } = result;
    this.kandaSplitTarget.set(null);
    this.kandas.set(result.kandas);
    this.notice.set(
      translate('{parent} imegawanywa: {child} imeundwa ikiwa na jumuiya {count} na wanajumuiya {members}.', {
        parent: parent.name,
        child: kanda.name,
        count: kanda.jumuiyas_count,
        members: kanda.members_count ?? 0,
      }),
    );

    const current = this.detail();
    await Promise.all([this.refresh(), current ? this.loadDetail(current.id) : Promise.resolve()]);
  }

  protected async onMoveDone(moved: Jumuiya): Promise<void> {
    this.moveTarget.set(null);
    this.notice.set(
      translate('{name} imehamishiwa {kanda} pamoja na wanajumuiya wake {count}.', {
        name: moved.name,
        kanda: moved.kanda?.name ?? '—',
        count: moved.members_count ?? 0,
      }),
    );

    const current = this.detail();
    await Promise.all([this.refresh(), current ? this.loadDetail(current.id) : Promise.resolve()]);
  }

  protected async onSplitDone(result: JumuiyaSplitResult): Promise<void> {
    const { parent, jumuiya } = result;
    this.splitTarget.set(null);
    this.notice.set(
      translate('{parent} imegawanywa: {child} imeundwa ndani ya {kanda} ikiwa na wanajumuiya {count}.', {
        parent: parent.name,
        child: jumuiya.name,
        kanda: jumuiya.kanda?.name ?? '—',
        count: jumuiya.members_count ?? 0,
      }),
    );

    const current = this.detail();
    await Promise.all([this.refresh(), current ? this.loadDetail(current.id) : Promise.resolve()]);
  }

  protected money(value: number | string | null | undefined): string {
    return this.currency().format(Number(value ?? 0));
  }

  protected percent(part: number, whole: number): number {
    return whole > 0 ? (part / whole) * 100 : 0;
  }

  protected decimal(value: number): string {
    return value.toLocaleString(this.i18n.intlLocale(), { maximumFractionDigits: 1 });
  }

  private async loadDetail(id: number): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set(null);

    try {
      this.detail.set(await this.parish.getKanda(id));
    } catch (error) {
      this.detailError.set(httpErrorMessage(error, 'Imeshindwa kupakia dashibodi ya kanda.'));
    } finally {
      this.detailLoading.set(false);
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

    const editing = this.editingKanda();

    try {
      const saved = editing
        ? await this.parish.updateKanda(editing.id, this.form.getRawValue())
        : await this.parish.createKanda(this.form.getRawValue());
      this.kandas.update((current) =>
        [...current.filter((kanda) => kanda.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );

      const detail = this.detail();
      if (detail && detail.id === saved.id) {
        this.detail.set({ ...detail, name: saved.name, leader: saved.leader, notes: saved.notes });
      }
      if (editing) {
        this.jumuiyas.update((current) =>
          current.map((group) =>
            group.kanda_id === saved.id ? { ...group, kanda: { id: saved.id, name: saved.name } } : group,
          ),
        );
      }

      this.closeForm();
    } catch (error) {
      this.error.set(
        httpErrorMessage(error, editing ? 'Imeshindwa kuhariri kanda hiyo.' : 'Imeshindwa kuongeza kanda hiyo.'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
