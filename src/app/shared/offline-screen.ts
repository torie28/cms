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
          <div class="mx-auto mb-5 w-[252px] overflow-hidden rounded-xl">
            <img
              src="offline.gif"
              alt=""
              width="336"
              height="192"
              class="block h-auto w-full [image-rendering:pixelated]"
              aria-hidden="true"
            />
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
