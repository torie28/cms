import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslatePipe } from '../core/i18n';

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Every whitespace-separated term in the query must appear in at least one field. */
export function matchesSearch(query: string, fields: (string | null | undefined)[]): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const haystack = normalizeSearch(fields.filter(Boolean).join(' '));
  return terms.every((term) => haystack.includes(term));
}

@Component({
  selector: 'app-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [TranslatePipe],
  template: `
    <div class="relative">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <input
        type="search"
        autocomplete="off"
        [value]="value()"
        [placeholder]="placeholder() | t"
        [attr.aria-label]="(label() || placeholder()) | t"
        (input)="value.set($any($event.target).value)"
        (keydown.escape)="value.set('')"
        class="w-full rounded border border-line bg-canvas py-2 pr-9 pl-9 text-sm focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      @if (value()) {
        <button
          type="button"
          class="absolute top-1/2 right-2 -translate-y-1/2 rounded px-1.5 text-lg leading-none text-faint hover:text-ink"
          [attr.aria-label]="'Futa utafutaji' | t"
          (click)="value.set('')"
        >
          ×
        </button>
      }
    </div>
  `,
})
export class SearchBox {
  readonly value = model('');
  readonly placeholder = input('Tafuta…');
  readonly label = input('');
}
