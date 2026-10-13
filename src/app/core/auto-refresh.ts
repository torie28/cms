import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, DestroyRef, inject, PLATFORM_ID } from '@angular/core';
import { ConnectivityService } from './connectivity';
import { PreferencesService } from './preferences';

export const AUTO_REFRESH_MS = 15_000;

/**
 * Calls `reload` every 15 seconds while the page is open, so data changed by other
 * users shows up without a full page reload. Call from a component constructor.
 *
 * Ticks are skipped when the user has turned auto refresh off, the tab is hidden,
 * the site is offline, a modal dialog is open (a half-filled form must not change
 * underneath them), or the previous reload has not finished.
 */
export function onAutoRefresh(reload: () => Promise<unknown> | void): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const destroyRef = inject(DestroyRef);
  const connectivity = inject(ConnectivityService);
  const preferences = inject(PreferencesService);
  let running = false;

  afterNextRender(() => {
    const timer = setInterval(async () => {
      if (
        running ||
        !preferences.preferences().autoRefresh ||
        document.visibilityState !== 'visible' ||
        !connectivity.online() ||
        document.querySelector('[aria-modal="true"]')
      ) {
        return;
      }

      running = true;
      try {
        await reload();
      } catch {
        // A failed background refresh just waits for the next tick.
      } finally {
        running = false;
      }
    }, AUTO_REFRESH_MS);

    destroyRef.onDestroy(() => clearInterval(timer));
  });
}
