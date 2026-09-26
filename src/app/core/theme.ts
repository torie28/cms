import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cms.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly systemPrefersDark = signal(false);

  readonly preference = signal<ThemePreference>('system');

  /** The theme actually in effect once `system` has been resolved against the OS setting. */
  readonly resolved = computed<'light' | 'dark'>(() => {
    const preference = this.preference();
    if (preference !== 'system') {
      return preference;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      this.preference.set(stored);
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark.set(query.matches);
    query.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));

    effect(() => {
      const resolved = this.resolved();
      const root = document.documentElement;
      root.classList.toggle('dark', resolved === 'dark');
      root.style.colorScheme = resolved;
      localStorage.setItem(STORAGE_KEY, this.preference());
    });
  }

  use(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  cycle(): void {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(this.preference()) + 1) % order.length];
    this.preference.set(next);
  }
}
