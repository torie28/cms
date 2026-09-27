import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConnectivityService } from '../core/connectivity';
import { TranslatePipe } from '../core/i18n';

/** Covers the whole app while the connection is down; the page reloads once it returns. */
@Component({
  selector: 'app-offline-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (!connectivity.online()) {
      <div
        class="fixed inset-0 z-[1000] flex items-center justify-center bg-canvas/95 p-6 backdrop-blur-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="offline-title"
        aria-describedby="offline-text"
      >
        <div class="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-lg">
          <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brass-tint text-brass-strong">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M3 3l18 18" />
              <path d="M8.5 16.5a5 5 0 0 1 7 0" />
              <path d="M5 12.9a10 10 0 0 1 5.2-2.7" />
              <path d="M14.5 10.4A10 10 0 0 1 19 12.9" />
              <path d="M2 8.8a15 15 0 0 1 4.2-2.5" />
              <path d="M10.7 5.1A15 15 0 0 1 22 8.8" />
              <circle cx="12" cy="20" r="0.8" fill="currentColor" />
            </svg>
          </div>

          <h2 id="offline-title" class="text-lg font-semibold text-ink">{{ 'Hakuna muunganisho' | t }}</h2>
          <p id="offline-text" class="mt-2 text-sm text-muted">
            {{ 'Angalia intaneti yako. Ukurasa utajipakia upya wenyewe muunganisho ukirudi.' | t }}
          </p>

          <div class="mt-6 flex items-center justify-center gap-2 text-xs text-faint" aria-live="polite">
            <span class="h-2 w-2 animate-pulse rounded-full bg-brass"></span>
            {{ 'Inasubiri muunganisho…' | t }}
          </div>

          <button
            type="button"
            class="mt-6 inline-flex cursor-pointer items-center rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:border-brass"
            (click)="connectivity.retry()"
          >
            {{ 'Jaribu tena' | t }}
          </button>
        </div>
      </div>
    }
  `,
})
export class OfflineScreen {
  protected readonly connectivity = inject(ConnectivityService);
}
