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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '../core/http-error';
import { translate, TranslatePipe } from '../core/i18n';
import { Kanda, KandaJumuiya, KandaSplitResult, ParishService } from '../core/parish';
import { matchesSearch, SearchBox } from './search-box';

@Component({
  selector: 'app-kanda-split-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SearchBox, TranslatePipe],
  templateUrl: './kanda-split-dialog.html',
})
export class KandaSplitDialog implements OnInit {
  private readonly parish = inject(ParishService);

  readonly kanda = input.required<Kanda>();
  readonly closed = output<void>();
  readonly done = output<KandaSplitResult>();

  protected readonly jumuiyas = signal<KandaJumuiya[]>([]);
  protected readonly jumuiyasLoading = signal(true);
  protected readonly search = signal('');
  protected readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    leader: ['', Validators.maxLength(255)],
    notes: [''],
  });

  private readonly newName = toSignal(this.form.controls.name.valueChanges, { initialValue: '' });

  protected readonly filteredJumuiyas = computed(() =>
    this.jumuiyas().filter((group) => matchesSearch(this.search(), [group.name, group.chairperson])),
  );

  private readonly moving = computed(() => this.jumuiyas().filter((group) => this.selectedIds().has(group.id)));
  protected readonly movingCount = computed(() => this.moving().length);
  protected readonly stayingCount = computed(() => this.jumuiyas().length - this.movingCount());
  protected readonly movingMembers = computed(() =>
    this.moving().reduce((sum, group) => sum + group.members_count, 0),
  );
  protected readonly stayingMembers = computed(() =>
    this.jumuiyas().reduce((sum, group) => sum + group.members_count, 0) - this.movingMembers(),
  );

  protected readonly allFilteredSelected = computed(() => {
    const visible = this.filteredJumuiyas();
    const selected = this.selectedIds();
    return visible.length > 0 && visible.every((group) => selected.has(group.id));
  });

  protected readonly problems = computed(() => {
    const problems: string[] = [];
    const name = this.newName().trim().toLowerCase();

    if (name && name === this.kanda().name.trim().toLowerCase()) {
      problems.push('Kanda mpya inahitaji jina tofauti na kanda mama.');
    }
    if (this.movingCount() === 0) {
      problems.push('Chagua angalau jumuiya moja itakayohamia kanda mpya.');
    }

    return problems;
  });

  ngOnInit(): void {
    this.form.patchValue({ notes: translate('Imegawanywa kutoka {name}.', { name: this.kanda().name }) });
    void this.loadJumuiyas(this.kanda().id);
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  protected toggleJumuiya(id: number): void {
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
    const visible = this.filteredJumuiyas().map((group) => group.id);
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
      const result = await this.parish.splitKanda(this.kanda().id, {
        name: raw.name.trim(),
        leader: raw.leader.trim(),
        notes: raw.notes.trim(),
        jumuiya_ids: [...this.selectedIds()],
      });
      this.done.emit(result);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kugawanya kanda hiyo.'));
    } finally {
      this.saving.set(false);
    }
  }

  private async loadJumuiyas(id: number): Promise<void> {
    this.jumuiyasLoading.set(true);

    try {
      const detail = await this.parish.getKanda(id);
      this.jumuiyas.set([...detail.jumuiyas].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia jumuiya za kanda hii.'));
    } finally {
      this.jumuiyasLoading.set(false);
    }
  }
}
