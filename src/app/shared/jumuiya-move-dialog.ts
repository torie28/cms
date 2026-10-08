import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { httpErrorMessage } from '../core/http-error';
import { translate, TranslatePipe } from '../core/i18n';
import { Jumuiya, Kanda, ParishService } from '../core/parish';

@Component({
  selector: 'app-jumuiya-move-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      animate.enter="backdrop-in"
      animate.leave="backdrop-out"
      (click)="close()"
    >
      <section
        class="w-full max-w-md rounded border border-line bg-surface p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-title"
        (click)="$event.stopPropagation()"
      >
        <h2 id="move-title" class="font-serif text-xl">{{ 'Hamisha jumuiya kanda nyingine' | t }}</h2>
        <p class="mt-1 text-sm text-muted">
          {{ 'Unahamisha {name} kutoka {kanda}.' | t: { name: jumuiya().name, kanda: currentKanda() } }}
        </p>

        <div class="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div class="rounded border border-line bg-sunken px-3 py-2">
            <p class="text-[0.65rem] tracking-[0.12em] text-faint uppercase">{{ 'Kanda ya sasa' | t }}</p>
            <p class="truncate text-sm font-medium">{{ currentKanda() }}</p>
          </div>
          <span class="text-faint" aria-hidden="true">→</span>
          <div class="rounded border border-brass/50 bg-brass-tint/40 px-3 py-2">
            <p class="text-[0.65rem] tracking-[0.12em] text-brass-strong uppercase">{{ 'Kanda mpya' | t }}</p>
            <p class="truncate text-sm font-medium">{{ targetName() || '—' }}</p>
          </div>
        </div>

        @if (options().length === 0) {
          <p class="mt-4 rounded border border-line bg-sunken px-3 py-2 text-sm text-muted">
            {{ 'Hakuna kanda nyingine. Ongeza kanda mpya kwanza.' | t }}
          </p>
        } @else {
          <label for="move-kanda" class="mt-4 mb-1 block text-xs tracking-[0.12em] text-muted uppercase">
            {{ 'Chagua kanda mpya' | t }}
          </label>
          <select
            id="move-kanda"
            class="w-full rounded border border-line bg-canvas px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none"
            [value]="targetId()"
            (change)="targetId.set(+$any($event.target).value)"
          >
            <option value="0" disabled>{{ 'Chagua kanda' | t }}</option>
            @for (kanda of options(); track kanda.id) {
              <option [value]="kanda.id">{{ kanda.name }}</option>
            }
          </select>
        }

        <p class="mt-4 rounded border border-line bg-sunken/60 px-3 py-2 text-sm">
          {{ memberNote() }}
        </p>

        @if (error()) {
          <p class="alert-in mt-3 rounded border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative" role="alert">
            {{ error() }}
          </p>
        }

        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded px-3 py-2 text-sm text-muted hover:bg-sunken" [disabled]="saving()" (click)="close()">
            {{ 'Ghairi' | t }}
          </button>
          <button
            type="button"
            class="rounded bg-brass-strong px-4 py-2 text-sm font-medium text-canvas disabled:opacity-60"
            [disabled]="saving() || !targetId()"
            (click)="submit()"
          >
            {{ (saving() ? 'Inahamisha…' : 'Hamisha') | t }}
          </button>
        </div>
      </section>
    </div>
  `,
})
export class JumuiyaMoveDialog {
  private readonly parish = inject(ParishService);

  readonly jumuiya = input.required<Jumuiya>();
  readonly kandas = input.required<Kanda[]>();
  readonly closed = output<void>();
  readonly done = output<Jumuiya>();

  protected readonly targetId = signal(0);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly options = computed(() =>
    this.kandas().filter((kanda) => kanda.id !== this.jumuiya().kanda_id),
  );

  protected readonly currentKanda = computed(
    () =>
      this.kandas().find((kanda) => kanda.id === this.jumuiya().kanda_id)?.name ??
      this.jumuiya().kanda?.name ??
      '—',
  );

  protected readonly targetName = computed(
    () => this.options().find((kanda) => kanda.id === this.targetId())?.name ?? '',
  );

  protected readonly memberNote = computed(() => {
    const count = this.jumuiya().members_count ?? 0;
    return count > 0
      ? translate('Wanajumuiya wote {count} wa {name} watahamia kanda mpya pamoja nayo.', {
          count,
          name: this.jumuiya().name,
        })
      : translate('Jumuiya hii haina wanajumuiya bado.');
  });

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving() || !this.targetId()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      this.done.emit(await this.parish.moveJumuiya(this.jumuiya().id, this.targetId()));
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuhamisha jumuiya hiyo.'));
    } finally {
      this.saving.set(false);
    }
  }
}
