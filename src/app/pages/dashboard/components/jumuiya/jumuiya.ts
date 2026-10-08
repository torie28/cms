import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FilterPanel, parseBound, withinNumberRange } from '../../../../shared/filter-panel';
import { JumuiyaMoveDialog } from '../../../../shared/jumuiya-move-dialog';
import { JumuiyaSplitDialog, JumuiyaSplitResult } from '../../../../shared/jumuiya-split-dialog';
import { matchesSearch, SearchBox } from '../../../../shared/search-box';
import { ActivityService } from '../../../../core/activity';
import { AuthService } from '../../../../core/auth';
import { ConfirmService } from '../../../../core/confirm';
import { httpErrorMessage } from '../../../../core/http-error';
import { translate, TranslatePipe } from '../../../../core/i18n';
import { EXPORT_FORMATS, FORMAT_NAMES, SPREADSHEET_ACCEPT } from '../../../../core/spreadsheet';
import {
  downloadTemplate,
  ExportFormat,
  exportJumuiyaProfile,
  exportJumuiyas,
  ImportedRow,
  normalizeGender,
  readSpreadsheet,
} from '../../../../core/jumuiya-transfer';
import { OfferingService } from '../../../../core/offerings';
import {
  Jumuiya,
  JumuiyaMember,
  JumuiyaMemberPayload,
  Kanda,
  ParishService,
} from '../../../../core/parish';

interface ImportGroup {
  name: string;
  existing: Jumuiya | null;
  kandaId: number;
  kandaName: string;
  chairperson: string;
  notes: string;
  members: JumuiyaMemberPayload[];
}

interface ImportPlan {
  groups: ImportGroup[];
  issues: string[];
  memberCount: number;
}

@Component({
  selector: 'app-jumuiya',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SearchBox, FilterPanel, JumuiyaSplitDialog, JumuiyaMoveDialog, TranslatePipe],
  templateUrl: './jumuiya.html',
})
export class JumuiyaPage {
  private readonly parish = inject(ParishService);
  private readonly offeringsApi = inject(OfferingService);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  protected readonly canCreate = computed(() => this.auth.can('jumuiya', 'create'));
  protected readonly canUpdate = computed(() => this.auth.can('jumuiya', 'update'));
  protected readonly canDelete = computed(() => this.auth.can('jumuiya', 'delete'));
  protected readonly canSplit = computed(() => this.canCreate() && this.canUpdate());
  protected readonly splitTarget = signal<Jumuiya | null>(null);
  protected readonly moveTarget = signal<Jumuiya | null>(null);

  protected readonly jumuiyas = signal<Jumuiya[]>([]);
  protected readonly kandas = signal<Kanda[]>([]);
  protected readonly members = signal<JumuiyaMember[]>([]);
  protected readonly selected = signal<Jumuiya | null>(null);
  protected readonly editingJumuiya = signal<Jumuiya | null>(null);
  protected readonly editingMember = signal<JumuiyaMember | null>(null);
  protected readonly loading = signal(true);
  protected readonly membersLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly jumuiyaFormOpen = signal(false);
  protected readonly memberFormOpen = signal(false);
  protected readonly viewOpen = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly skeletonRows = [1, 2, 3, 4];

  protected readonly search = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '');
  protected readonly kandaFilter = signal(0);
  protected readonly chairFilter = signal<'' | 'has' | 'none'>('');
  protected readonly minMembers = signal('');
  protected readonly maxMembers = signal('');
  protected readonly sort = signal<'name' | 'name-desc' | 'members-desc' | 'members-asc'>('name');
  protected readonly memberSearch = signal('');

  protected readonly activeFilters = computed(
    () =>
      [this.kandaFilter(), this.chairFilter(), this.minMembers(), this.maxMembers()].filter(Boolean)
        .length + (this.sort() === 'name' ? 0 : 1),
  );

  protected readonly filteredJumuiyas = computed(() => {
    const kandaId = this.kandaFilter();
    const chair = this.chairFilter();
    const min = parseBound(this.minMembers());
    const max = parseBound(this.maxMembers());
    const sort = this.sort();

    return this.jumuiyas()
      .filter(
        (group) =>
          (kandaId === 0 || group.kanda_id === kandaId) &&
          (chair === '' || (chair === 'has') === !!group.chairperson?.trim()) &&
          withinNumberRange(group.members_count ?? 0, min, max) &&
          matchesSearch(this.search(), [group.name, group.kanda?.name, group.chairperson, group.notes]),
      )
      .sort((a, b) => {
        if (sort === 'members-desc' || sort === 'members-asc') {
          const diff = (a.members_count ?? 0) - (b.members_count ?? 0);
          return sort === 'members-desc' ? -diff : diff;
        }

        const diff = a.name.localeCompare(b.name);
        return sort === 'name-desc' ? -diff : diff;
      });
  });

  protected readonly filterSummary = computed(() =>
    this.search() || this.activeFilters() > 0
      ? translate('Jumuiya {shown} kati ya {total}', {
          shown: this.filteredJumuiyas().length,
          total: this.jumuiyas().length,
        })
      : '',
  );
  protected readonly filteredMembers = computed(() =>
    this.members().filter((member) =>
      matchesSearch(this.memberSearch(), [member.name, member.phone, this.genderLabel(member.gender)]),
    ),
  );

  protected readonly importOpen = signal(false);
  protected readonly importTarget = signal<Jumuiya | null>(null);
  protected readonly importPlan = signal<ImportPlan | null>(null);
  protected readonly importFileName = signal<string | null>(null);
  protected readonly importError = signal<string | null>(null);
  protected readonly importing = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly exportMenu = signal<'page' | 'view' | null>(null);
  protected readonly exportScope = signal<'selected' | 'all'>('selected');
  protected readonly exporting = signal(false);
  protected readonly exportFormats = EXPORT_FORMATS;
  protected readonly spreadsheetAccept = SPREADSHEET_ACCEPT;
  private readonly activity = inject(ActivityService);

  protected readonly jumuiyaForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    kanda_id: [0, [Validators.required, Validators.min(1)]],
    chairperson: [''],
    notes: [''],
    members: this.fb.nonNullable.array([]),
  });

  protected readonly memberForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: [''],
    gender: [''],
  });

  protected readonly bulkMemberForm = this.fb.nonNullable.group({
    members: this.fb.nonNullable.array([]),
  });

  protected readonly jumuiyaMemberCount = this.fb.nonNullable.control(0, [
    Validators.min(0),
    Validators.max(200),
  ]);

  protected readonly bulkMemberCount = this.fb.nonNullable.control(1, [
    Validators.min(1),
    Validators.max(200),
  ]);

  protected get draftMembers(): FormArray {
    return this.jumuiyaForm.controls.members;
  }

  protected get bulkMembers(): FormArray {
    return this.bulkMemberForm.controls.members;
  }

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected select(group: Jumuiya): void {
    this.selected.set(group);
  }

  protected openJumuiyaForm(): void {
    this.editingJumuiya.set(null);
    this.members.set([]);
    this.jumuiyaMemberCount.setValue(0);
    this.resizeDraftMembers(this.draftMembers, 0);
    this.jumuiyaForm.patchValue({
      name: '',
      kanda_id: this.kandas()[0]?.id ?? 0,
      chairperson: '',
      notes: '',
    });
    this.jumuiyaForm.markAsPristine();
    this.jumuiyaForm.markAsUntouched();
    this.error.set(null);
    this.jumuiyaFormOpen.set(true);
  }

  protected async openEditJumuiya(group: Jumuiya, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.selected.set(group);
    this.editingJumuiya.set(group);
    this.jumuiyaMemberCount.setValue(0);
    this.resizeDraftMembers(this.draftMembers, 0);
    this.jumuiyaForm.patchValue({
      name: group.name,
      kanda_id: group.kanda_id,
      chairperson: group.chairperson ?? '',
      notes: group.notes ?? '',
    });
    this.jumuiyaForm.markAsPristine();
    this.jumuiyaForm.markAsUntouched();
    this.error.set(null);
    this.members.set([]);
    this.viewOpen.set(false);
    this.jumuiyaFormOpen.set(true);
    await this.loadMembers(group.id);
  }

  protected async openView(group: Jumuiya, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.selected.set(group);
    this.error.set(null);
    this.memberSearch.set('');
    this.viewOpen.set(true);
    await this.loadMembers(group.id);
  }

  protected openMemberForm(group?: Jumuiya, event?: Event): void {
    event?.stopPropagation();
    const target = group ?? this.selected();
    if (!target) {
      return;
    }

    this.selected.set(target);
    this.editingMember.set(null);
    this.memberForm.reset({ name: '', phone: '', gender: '' });
    this.bulkMemberCount.setValue(5);
    this.resizeDraftMembers(this.bulkMembers, 5);
    this.bulkMemberForm.markAsPristine();
    this.bulkMemberForm.markAsUntouched();
    this.error.set(null);
    this.memberFormOpen.set(true);
  }

  protected openEditMember(member: JumuiyaMember, event?: Event): void {
    event?.stopPropagation();
    this.editingMember.set(member);
    this.memberForm.reset({
      name: member.name,
      phone: member.phone ?? '',
      gender: member.gender ?? '',
    });
    this.error.set(null);
    this.memberFormOpen.set(true);
  }

  protected closeForms(): void {
    this.jumuiyaFormOpen.set(false);
    this.memberFormOpen.set(false);
    this.editingJumuiya.set(null);
    this.editingMember.set(null);
  }

  protected closeView(): void {
    this.viewOpen.set(false);
  }

  protected openSplit(group: Jumuiya, event?: Event): void {
    event?.stopPropagation();
    this.selected.set(group);
    this.viewOpen.set(false);
    this.splitTarget.set(group);
  }

  protected openMove(group: Jumuiya, event?: Event): void {
    event?.stopPropagation();
    this.selected.set(group);
    this.viewOpen.set(false);
    this.moveTarget.set(group);
  }

  protected async onMoveDone(moved: Jumuiya): Promise<void> {
    this.moveTarget.set(null);
    this.upsertJumuiya(moved);
    this.notice.set(
      translate('{name} imehamishiwa {kanda} pamoja na wanajumuiya wake {count}.', {
        name: moved.name,
        kanda: moved.kanda?.name ?? '—',
        count: moved.members_count ?? 0,
      }),
    );
    await this.refresh();
  }

  protected async onSplitDone({ parent, jumuiya }: JumuiyaSplitResult): Promise<void> {
    this.splitTarget.set(null);
    this.notice.set(
      translate('{parent} imegawanywa: {child} imeundwa ndani ya {kanda} ikiwa na wanajumuiya {count}.', {
        parent: parent.name,
        child: jumuiya.name,
        kanda: jumuiya.kanda?.name ?? '—',
        count: jumuiya.members_count ?? 0,
      }),
    );
    await this.refresh();
    this.selected.set(this.jumuiyas().find((group) => group.id === jumuiya.id) ?? jumuiya);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [jumuiyas, kandas] = await Promise.all([
        this.parish.listJumuiyas(),
        this.parish.listKandas(),
      ]);
      this.jumuiyas.set(jumuiyas);
      this.kandas.set(kandas);
      this.syncSelected(jumuiyas);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia jumuiya.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async submitJumuiya(): Promise<void> {
    if (this.saving() || this.jumuiyaForm.invalid) {
      this.jumuiyaForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const raw = this.jumuiyaForm.getRawValue();
      const members = this.completedDraftMembers(
        raw.members,
        this.normalizedCount(this.jumuiyaMemberCount.value, 0),
      );
      const payload = {
        name: raw.name,
        kanda_id: Number(raw.kanda_id),
        chairperson: raw.chairperson,
        notes: raw.notes,
      };
      const editing = this.editingJumuiya();
      let saved = editing
        ? await this.parish.updateJumuiya(editing.id, payload)
        : await this.parish.createJumuiya({ ...payload, members });

      if (editing && members.length > 0) {
        const added = await this.parish.addJumuiyaMembers(editing.id, members);
        saved = added.jumuiya;
      }

      this.upsertJumuiya(saved);
      this.selected.set(saved);
      this.closeForms();
    } catch (error) {
      this.error.set(
        httpErrorMessage(
          error,
          this.editingJumuiya()
            ? 'Imeshindwa kuhariri jumuiya hiyo.'
            : 'Imeshindwa kuongeza jumuiya hiyo.',
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async submitMember(): Promise<void> {
    const jumuiya = this.selected();
    const editing = this.editingMember();

    if (!jumuiya || this.saving()) {
      return;
    }

    if (editing && this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      if (editing) {
        const { jumuiya: updated } = await this.parish.updateJumuiyaMember(
          jumuiya.id,
          editing.id,
          this.memberForm.getRawValue(),
        );
        this.upsertJumuiya(updated);
        if (this.viewOpen()) {
          await this.loadMembers(updated.id);
        }
      } else {
        const members = this.completedDraftMembers(
          this.bulkMemberForm.getRawValue().members,
          this.normalizedCount(this.bulkMemberCount.value, 1),
        );

        const { jumuiya: updated } = await this.parish.addJumuiyaMembers(jumuiya.id, members);
        this.upsertJumuiya(updated);
        if (this.viewOpen()) {
          await this.loadMembers(updated.id);
        }
      }

      this.closeForms();
    } catch (error) {
      this.error.set(
        httpErrorMessage(
          error,
          editing
            ? 'Imeshindwa kuhariri mwanajumuiya huyo.'
            : 'Imeshindwa kuongeza wanajumuiya hao.',
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async removeJumuiya(group: Jumuiya, event?: Event): Promise<void> {
    event?.stopPropagation();

    if (this.saving()) {
      return;
    }
    const confirmed = await this.confirm.ask({
      message: translate('Futa {name}? Wanajumuiya wake wote wataondolewa pia.', { name: group.name }),
      tone: 'danger',
    });
    if (!confirmed || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      await this.parish.deleteJumuiya(group.id);
      this.jumuiyas.update((current) => current.filter((item) => item.id !== group.id));

      if (this.selected()?.id === group.id) {
        this.selected.set(null);
        this.members.set([]);
        this.viewOpen.set(false);
      }
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kufuta jumuiya hiyo.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async removeMember(member: JumuiyaMember): Promise<void> {
    const jumuiya = this.selected();

    if (!jumuiya || this.saving()) {
      return;
    }
    const confirmed = await this.confirm.ask({
      message: translate('Mwondoe {member} kutoka {jumuiya}?', { member: member.name, jumuiya: jumuiya.name }),
      confirmLabel: 'Ondoa',
      tone: 'danger',
    });
    if (!confirmed || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const { jumuiya: updated } = await this.parish.deleteJumuiyaMember(jumuiya.id, member.id);
      this.upsertJumuiya(updated);
      this.members.update((current) => current.filter((item) => item.id !== member.id));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kumwondoa mwanajumuiya huyo.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected prepareJumuiyaMembers(): void {
    const count = this.normalizedCount(this.jumuiyaMemberCount.value, 0);
    this.jumuiyaMemberCount.setValue(count);
    this.resizeDraftMembers(this.draftMembers, count);
  }

  protected prepareBulkMembers(): void {
    const count = this.normalizedCount(this.bulkMemberCount.value, 1);
    this.bulkMemberCount.setValue(count);
    this.resizeDraftMembers(this.bulkMembers, count);
  }

  protected openImport(target?: Jumuiya, event?: Event): void {
    event?.stopPropagation();
    this.importTarget.set(target ?? null);
    this.importPlan.set(null);
    this.importFileName.set(null);
    this.importError.set(null);
    this.exportMenu.set(null);
    this.importOpen.set(true);
  }

  protected closeImport(): void {
    if (this.importing()) {
      return;
    }

    this.importOpen.set(false);
    this.importTarget.set(null);
    this.importPlan.set(null);
  }

  protected async downloadImportTemplate(): Promise<void> {
    await downloadTemplate(this.importTarget()?.name);
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
      const rows = await readSpreadsheet(file);
      if (rows.length === 0) {
        this.importError.set(translate('Faili hilo halina safu zenye taarifa.'));
        return;
      }
      this.importPlan.set(this.buildImportPlan(rows, this.importTarget()));
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

    if (!plan || plan.groups.length === 0 || this.importing()) {
      return;
    }

    this.importing.set(true);
    this.importError.set(null);
    const failures: string[] = [];
    let created = 0;
    let added = 0;

    for (const group of plan.groups) {
      try {
        if (group.existing) {
          if (group.members.length > 0) {
            await this.parish.addJumuiyaMembers(group.existing.id, group.members);
            added += group.members.length;
          }
        } else {
          await this.parish.createJumuiya({
            name: group.name,
            kanda_id: group.kandaId,
            chairperson: group.chairperson,
            notes: group.notes,
            members: group.members,
          });
          created++;
          added += group.members.length;
        }
      } catch (error) {
        failures.push(`${group.name}: ${httpErrorMessage(error, 'imeshindwa kuhifadhiwa.')}`);
      }
    }

    this.importing.set(false);

    if (created > 0 || added > 0) {
      const target = this.importTarget();
      void this.activity.record({
        action: 'imported',
        subject:
          (target
            ? `${added} members into ${target.name}`
            : `${created} jumuiyas and ${added} members`) +
          (this.importFileName() ? ` from ${this.importFileName()}` : ''),
        subject_type: target ? 'jumuiya_member' : 'jumuiya',
      });
    }

    await this.refresh();

    const selected = this.selected();
    if (this.viewOpen() && selected) {
      await this.loadMembers(selected.id);
    }

    if (failures.length > 0) {
      this.importPlan.set(null);
      this.importError.set(translate('Baadhi hazikuingizwa. {failures}', { failures: failures.join(' · ') }));
      return;
    }

    this.closeImport();
    this.notice.set(
      translate('Uingizaji umekamilika: jumuiya mpya {created}, wanajumuiya {added}.', { created, added }),
    );
  }

  protected toggleExportMenu(menu: 'page' | 'view', event: Event): void {
    event.stopPropagation();
    this.exportScope.set('selected');
    this.exportMenu.update((current) => (current === menu ? null : menu));
  }

  protected closeExportMenu(): void {
    this.exportMenu.set(null);
  }

  protected async exportAll(format: ExportFormat): Promise<void> {
    this.exportMenu.set(null);

    if (this.exporting() || this.filteredJumuiyas().length === 0) {
      return;
    }

    this.exporting.set(true);
    this.error.set(null);

    try {
      const detailed = await Promise.all(
        this.filteredJumuiyas().map((group) => this.parish.getJumuiya(group.id)),
      );
      const kanda = this.kandas().find((item) => item.id === this.kandaFilter());
      await exportJumuiyas(
        detailed,
        format,
        kanda ? translate('Jumuiya za {kanda}', { kanda: kanda.name }) : translate('Jumuiya zote'),
      );
      void this.activity.record({
        action: 'exported',
        subject: `${detailed.length} jumuiyas as ${FORMAT_NAMES[format]}`,
        subject_type: 'jumuiya',
      });
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuandaa faili la kupakua.'));
    } finally {
      this.exporting.set(false);
    }
  }

  /** The page "Pakua" menu exports the selected jumuiya unless the user switches it to the whole list. */
  protected async exportPage(format: ExportFormat): Promise<void> {
    await (this.selected() && this.exportScope() === 'selected' ? this.exportSelected(format) : this.exportAll(format));
  }

  protected async exportSelected(format: ExportFormat): Promise<void> {
    this.exportMenu.set(null);
    const group = this.selected();

    if (!group || this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.error.set(null);

    try {
      const [detail, offerings] = await Promise.all([
        this.parish.getJumuiya(group.id),
        this.auth.canAccess('sadaka')
          ? this.offeringsApi.list({ from: '', to: '', jumuiyaIds: [group.id] }).catch(() => null)
          : Promise.resolve(null),
      ]);
      await exportJumuiyaProfile({ ...group, ...detail, parent: group.parent ?? null }, format, {
        offerings,
        children: this.jumuiyas().filter((item) => (item.parent_id ?? item.parent?.id) === group.id),
      });
      void this.activity.record({
        action: 'exported',
        subject: `${group.name} (details, ${detail.members?.length ?? 0} members${
          offerings ? `, ${offerings.length} offerings` : ''
        }) as ${FORMAT_NAMES[format]}`,
        subject_type: 'jumuiya',
      });
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuandaa faili la kupakua.'));
    } finally {
      this.exporting.set(false);
    }
  }

  protected setKandaFilter(value: string): void {
    this.kandaFilter.set(Number(value) || 0);
  }

  protected clearFilters(): void {
    this.kandaFilter.set(0);
    this.chairFilter.set('');
    this.minMembers.set('');
    this.maxMembers.set('');
    this.sort.set('name');
  }

  protected setChairFilter(value: string): void {
    this.chairFilter.set(value === 'has' || value === 'none' ? value : '');
  }

  protected setSort(value: string): void {
    this.sort.set(
      value === 'name-desc' || value === 'members-desc' || value === 'members-asc' ? value : 'name',
    );
  }

  protected genderLabel(gender: string | null): string {
    if (gender === 'male') {
      return translate('Mwanaume');
    }

    if (gender === 'female') {
      return translate('Mwanamke');
    }

    return '—';
  }

  private buildImportPlan(rows: ImportedRow[], target: Jumuiya | null): ImportPlan {
    const issues: string[] = [];
    const groups = new Map<string, ImportGroup>();
    const findKanda = (name: string) =>
      this.kandas().find((kanda) => kanda.name.trim().toLowerCase() === name.trim().toLowerCase());

    for (const row of rows) {
      const name = target ? target.name : row.jumuiya;

      if (!name) {
        issues.push(translate('Mstari {line}: jina la jumuiya halipo, umerukwa.', { line: row.line }));
        continue;
      }

      const key = name.trim().toLowerCase();
      let group = groups.get(key);

      if (!group) {
        const existing =
          target ?? this.jumuiyas().find((item) => item.name.trim().toLowerCase() === key) ?? null;
        group = {
          name: existing?.name ?? name,
          existing,
          kandaId: existing?.kanda_id ?? 0,
          kandaName: existing?.kanda?.name ?? row.kanda,
          chairperson: '',
          notes: '',
          members: [],
        };
        groups.set(key, group);
      }

      if (!group.existing) {
        group.kandaName ||= row.kanda;
        group.chairperson ||= row.chairperson;
        group.notes ||= row.notes;
      }

      if (!row.member) {
        if (row.phone || row.gender) {
          issues.push(
            translate('Mstari {line}: jina la mwanajumuiya halipo, umerukwa.', { line: row.line }),
          );
        }
        continue;
      }

      if (row.member.length > 255 || row.phone.length > 40) {
        issues.push(translate('Mstari {line}: jina au simu ni ndefu mno, umerukwa.', { line: row.line }));
        continue;
      }

      let gender = normalizeGender(row.gender);
      if (gender === 'invalid') {
        issues.push(
          translate('Mstari {line}: jinsia "{gender}" haitambuliki, imeachwa wazi.', {
            line: row.line,
            gender: row.gender,
          }),
        );
        gender = '';
      }

      group.members.push({ name: row.member, phone: row.phone, gender });
    }

    const valid: ImportGroup[] = [];

    for (const group of groups.values()) {
      if (!group.existing) {
        const kanda = group.kandaName ? findKanda(group.kandaName) : undefined;

        if (!kanda) {
          issues.push(
            group.kandaName
              ? translate('{name}: kanda "{kanda}" haipo, jumuiya imerukwa.', {
                  name: group.name,
                  kanda: group.kandaName,
                })
              : translate('{name}: kanda haijatajwa, jumuiya imerukwa.', { name: group.name }),
          );
          continue;
        }

        group.kandaId = kanda.id;
        group.kandaName = kanda.name;
      } else if (group.members.length === 0) {
        continue;
      }

      valid.push(group);
    }

    return {
      groups: valid,
      issues,
      memberCount: valid.reduce((total, group) => total + group.members.length, 0),
    };
  }

  private newDraftMember() {
    return this.fb.nonNullable.group({
      name: [''],
      phone: [''],
      gender: [''],
    });
  }

  private resizeDraftMembers(rows: FormArray, count: number): void {
    while (rows.length < count) {
      rows.push(this.newDraftMember());
    }

    while (rows.length > count) {
      rows.removeAt(rows.length - 1);
    }
  }

  private normalizedCount(value: number, minimum: number): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return minimum;
    }

    return Math.min(200, Math.max(minimum, Math.trunc(parsed)));
  }

  private completedDraftMembers(members: unknown[], requestedCount: number): JumuiyaMemberPayload[] {
    const prepared = members.map((member) => {
      if (!member || typeof member !== 'object') {
        return { name: '', phone: '', gender: '' };
      }

      const row = member as { name?: unknown; phone?: unknown; gender?: unknown };
      return {
        name: typeof row.name === 'string' ? row.name.trim() : '',
        phone: typeof row.phone === 'string' ? row.phone.trim() : '',
        gender: typeof row.gender === 'string' ? row.gender : '',
      };
    });

    const targetCount = Math.max(requestedCount, prepared.length);

    return Array.from({ length: targetCount }, (_, index) => {
      const current = prepared[index] ?? { name: '', phone: '', gender: '' };
      return {
        name: current.name === '' ? translate('Mwanajumuiya {n}', { n: index + 1 }) : current.name,
        phone: current.phone,
        gender: current.gender,
      };
    });
  }

  private upsertJumuiya(saved: Jumuiya): void {
    this.jumuiyas.update((current) => {
      const next = current.some((group) => group.id === saved.id)
        ? current.map((group) => (group.id === saved.id ? { ...group, ...saved } : group))
        : [...current, saved];

      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    this.selected.set(saved);
  }

  private syncSelected(jumuiyas: Jumuiya[]): void {
    const current = this.selected();
    if (!current) {
      return;
    }

    this.selected.set(jumuiyas.find((group) => group.id === current.id) ?? null);
  }

  private async loadMembers(jumuiyaId: number): Promise<void> {
    this.membersLoading.set(true);

    try {
      const detail = await this.parish.getJumuiya(jumuiyaId);
      this.upsertJumuiya(detail);
      this.members.set(detail.members ?? []);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia wanajumuiya.'));
    } finally {
      this.membersLoading.set(false);
    }
  }
}
