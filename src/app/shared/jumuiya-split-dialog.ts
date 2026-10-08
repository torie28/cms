import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '../core/http-error';
import { translate, TranslatePipe } from '../core/i18n';
import { Jumuiya, JumuiyaMember, Kanda, ParishService } from '../core/parish';
import { matchesSearch, SearchBox } from './search-box';

export interface JumuiyaSplitResult {
  parent: Jumuiya;
  jumuiya: Jumuiya;
}

@Component({
  selector: 'app-jumuiya-split-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SearchBox, TranslatePipe],
  templateUrl: './jumuiya-split-dialog.html',
})
export class JumuiyaSplitDialog implements OnInit {
  private readonly parish = inject(ParishService);

  readonly jumuiya = input.required<Jumuiya>();
  readonly kandas = input.required<Kanda[]>();
  readonly closed = output<void>();
  readonly done = output<JumuiyaSplitResult>();

  protected readonly members = signal<JumuiyaMember[]>([]);
  protected readonly membersLoading = signal(true);
  protected readonly memberSearch = signal('');
  protected readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);

  protected readonly parentPlacement = signal<'stay' | 'move'>('stay');
  protected readonly parentMoveKandaId = signal(0);
  protected readonly childPlacement = signal<'same' | 'other'>('same');
  protected readonly childOtherKandaId = signal(0);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    chairperson: ['', Validators.maxLength(255)],
    notes: [''],
  });

  protected readonly currentKanda = computed(() => this.kandaById(this.jumuiya().kanda_id));

  /** Kandas the parent can move to: every kanda except the one it is in now. */
  protected readonly parentMoveOptions = computed(() =>
    this.kandas().filter((kanda) => kanda.id !== this.jumuiya().kanda_id),
  );

  protected readonly parentKandaId = computed(() =>
    this.parentPlacement() === 'stay' ? this.jumuiya().kanda_id : this.parentMoveKandaId(),
  );

  /** Kandas the new jumuiya can go to when it does not share the parent's kanda. */
  protected readonly childOtherOptions = computed(() =>
    this.kandas().filter((kanda) => kanda.id !== this.parentKandaId()),
  );

  protected readonly childKandaId = computed(() =>
    this.childPlacement() === 'same' ? this.parentKandaId() : this.childOtherKandaId(),
  );

  protected readonly filteredMembers = computed(() =>
    this.members().filter((member) => matchesSearch(this.memberSearch(), [member.name, member.phone])),
  );

  protected readonly movingCount = computed(() => this.selectedIds().size);
  protected readonly stayingCount = computed(() => this.members().length - this.movingCount());

  protected readonly allFilteredSelected = computed(() => {
    const visible = this.filteredMembers();
    const selected = this.selectedIds();
    return visible.length > 0 && visible.every((member) => selected.has(member.id));
  });

  protected readonly problems = computed(() => {
    const problems: string[] = [];

    if (this.parentPlacement() === 'move' && !this.parentMoveKandaId()) {
      problems.push('Chagua kanda ambayo jumuiya mama itahamia.');
    }
    if (this.childPlacement() === 'other' && !this.childOtherKandaId()) {
      problems.push('Chagua kanda ya jumuiya mpya.');
    }
    if (this.members().length > 0 && this.movingCount() === 0) {
      problems.push('Chagua angalau mwanajumuiya mmoja atakayehamia jumuiya mpya.');
    }

    return problems;
  });

  ngOnInit(): void {
    const group = this.jumuiya();
    this.form.patchValue({ notes: translate('Imegawanywa kutoka {name}.', { name: group.name }) });
    void this.loadMembers(group.id);
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  protected kandaName(id: number): string {
    return this.kandaById(id)?.name ?? '—';
  }

  protected setParentPlacement(value: 'stay' | 'move'): void {
    this.parentPlacement.set(value);
    if (value === 'move' && !this.parentMoveKandaId()) {
      this.parentMoveKandaId.set(this.parentMoveOptions()[0]?.id ?? 0);
    }
    this.syncChildKanda();
  }

  protected setParentMoveKanda(value: string): void {
    this.parentMoveKandaId.set(Number(value) || 0);
    this.syncChildKanda();
  }

  protected setChildPlacement(value: 'same' | 'other'): void {
    this.childPlacement.set(value);
    this.syncChildKanda();
  }

  protected setChildOtherKanda(value: string): void {
    this.childOtherKandaId.set(Number(value) || 0);
  }

  protected toggleMember(id: number): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected toggleAllFiltered(): void {
    const visible = this.filteredMembers().map((member) => member.id);
    const selectAll = !this.allFilteredSelected();

    this.selectedIds.update((current) => {
      const next = new Set(current);
      for (const id of visible) {
        if (selectAll) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);

    if (this.saving()) {
      return;
    }
    if (this.form.invalid || this.problems().length > 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const raw = this.form.getRawValue();
      const result = await this.parish.splitJumuiya(this.jumuiya().id, {
        name: raw.name.trim(),
        chairperson: raw.chairperson.trim(),
        notes: raw.notes.trim(),
        parent_kanda_id: this.parentKandaId(),
        kanda_id: this.childKandaId(),
        member_ids: [...this.selectedIds()],
      });
      this.done.emit(result);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kugawanya jumuiya hiyo.'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Drops an "other kanda" choice that is no longer valid after the parent's kanda changed. */
  private syncChildKanda(): void {
    if (this.childPlacement() !== 'other') {
      return;
    }

    const options = this.childOtherOptions();
    if (!options.some((kanda) => kanda.id === this.childOtherKandaId())) {
      this.childOtherKandaId.set(options[0]?.id ?? 0);
    }
  }

  private kandaById(id: number): Kanda | undefined {
    return this.kandas().find((kanda) => kanda.id === id);
  }

  private async loadMembers(id: number): Promise<void> {
    this.membersLoading.set(true);

    try {
      const detail = await this.parish.getJumuiya(id);
      this.members.set([...(detail.members ?? [])].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia wanajumuiya.'));
    } finally {
      this.membersLoading.set(false);
    }
  }
}
