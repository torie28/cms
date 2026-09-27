import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../core/i18n';

/** Inclusive date-range check on the calendar day of an ISO timestamp; empty bounds are open. */
export function withinDateRange(value: string, from: string, to: string): boolean {
  const day = value.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

export function withinNumberRange(value: number, min: number | null, max: number | null): boolean {
  return (min === null || value >= min) && (max === null || value <= max);
}

export function parseBound(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

@Component({
  selector: 'app-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <ng-content select="[filterSearch]" />
      <button
        type="button"
        class="flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-sunken"
        [class.border-brass]="activeCount() > 0"
        [class.border-line]="activeCount() === 0"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="panelId"
        (click)="open.set(!open())"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {{ 'Vichujio' | t }}
        @if (activeCount() > 0) {
          <span class="rounded-full bg-brass-strong px-1.5 text-xs leading-5 text-canvas">{{ activeCount() }}</span>
        }
        <span class="text-xs text-faint" aria-hidden="true">{{ open() ? '▴' : '▾' }}</span>
      </button>
      @if (summary()) {
        <p class="text-sm text-muted">{{ summary() }}</p>
      }
      @if (activeCount() > 0) {
        <button type="button" class="text-sm text-brass-strong hover:underline" (click)="clear.emit()">
          {{ 'Ondoa vichujio' | t }}
        </button>
      }
    </div>

    @if (open()) {
      <div
        [id]="panelId"
        class="alert-in mt-3 grid gap-4 rounded border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
        role="group"
        [attr.aria-label]="'Vichujio' | t"
      >
        <ng-content />
      </div>
    }
  `,
})
export class FilterPanel {
  private static nextId = 0;

  readonly activeCount = input(0);
  readonly summary = input('');
  readonly clear = output<void>();

  protected readonly open = signal(false);
  protected readonly panelId = `filter-panel-${FilterPanel.nextId++}`;
}
