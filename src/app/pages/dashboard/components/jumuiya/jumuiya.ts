import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '../../../../core/http-error';
import {
  Jumuiya,
  JumuiyaMember,
  JumuiyaMemberPayload,
  Kanda,
  ParishService,
} from '../../../../core/parish';

@Component({
  selector: 'app-jumuiya',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './jumuiya.html',
})
export class JumuiyaPage {
  private readonly parish = inject(ParishService);
  private readonly fb = inject(FormBuilder);

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

    if (
      this.saving() ||
      !window.confirm(`Futa ${group.name}? Wanajumuiya wake wote wataondolewa pia.`)
    ) {
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

    if (
      !jumuiya ||
      this.saving() ||
      !window.confirm(`Mwondoe ${member.name} kutoka ${jumuiya.name}?`)
    ) {
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

  protected genderLabel(gender: string | null): string {
    if (gender === 'male') {
      return 'Mwanaume';
    }

    if (gender === 'female') {
      return 'Mwanamke';
    }

    return '—';
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
        name: current.name === '' ? `Mwanajumuiya ${index + 1}` : current.name,
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
