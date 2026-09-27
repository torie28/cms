import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

const OFFLINE_PROBE_MS = 5_000;
const ONLINE_PROBE_MS = 30_000;
const PROBE_TIMEOUT_MS = 5_000;
// navigator.onLine only reports a network link, so a single failed probe while
// "online" is not trusted; this many in a row are needed before going offline.
const FAILURES_BEFORE_OFFLINE = 2;

/**
 * Tracks whether the site is reachable. Once the connection drops and then comes
 * back, the page reloads itself so every view refetches fresh data.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly document = inject(DOCUMENT);

  private readonly state = signal(true);
  readonly online = this.state.asReadonly();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private probing = false;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    const win = this.document.defaultView!;
    const onOffline = () => this.goOffline();
    const onOnline = () => void this.probe();
    const onVisible = () => {
      if (this.document.visibilityState === 'visible') {
        void this.probe();
      }
    };

    win.addEventListener('offline', onOffline);
    win.addEventListener('online', onOnline);
    this.document.addEventListener('visibilitychange', onVisible);

    if (!win.navigator.onLine) {
      this.goOffline();
    } else {
      this.schedule(ONLINE_PROBE_MS);
    }

    inject(DestroyRef).onDestroy(() => {
      win.removeEventListener('offline', onOffline);
      win.removeEventListener('online', onOnline);
      this.document.removeEventListener('visibilitychange', onVisible);
      this.clearTimer();
    });
  }

  /** Re-checks immediately; used by the "try again" button. */
  retry(): void {
    void this.probe();
  }

  private goOffline(): void {
    this.failures = FAILURES_BEFORE_OFFLINE;
    this.state.set(false);
    this.schedule(OFFLINE_PROBE_MS);
  }

  private async probe(): Promise<void> {
    if (this.probing) {
      return;
    }
    this.probing = true;
    this.clearTimer();

    const reachable = this.document.defaultView!.navigator.onLine && (await this.ping());
    this.probing = false;

    if (reachable) {
      this.failures = 0;
      if (!this.state()) {
        this.document.defaultView!.location.reload();
        return;
      }
      this.schedule(ONLINE_PROBE_MS);
      return;
    }

    this.failures++;
    if (this.failures >= FAILURES_BEFORE_OFFLINE) {
      this.state.set(false);
    }
    this.schedule(this.state() ? ONLINE_PROBE_MS / 3 : OFFLINE_PROBE_MS);
  }

  /** Any HTTP response counts as reachable; only network failures and timeouts do not. */
  private async ping(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      await fetch(`/favicon.ico?_=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private schedule(ms: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => void this.probe(), ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
