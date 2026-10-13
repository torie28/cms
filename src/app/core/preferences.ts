import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type FontSize = 'sm' | 'md' | 'lg' | 'xl';
export type FontFamily = 'default' | 'system' | 'serif' | 'readable' | 'mono';

export interface Preferences {
  fontSize: FontSize;
  fontFamily: FontFamily;
  /** Zoom applied to the page content below the top bar, as a percentage. */
  zoom: number;
  noahFontSize: FontSize;
  noahFontFamily: FontFamily;
}

export const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  fontSize: 'md',
  fontFamily: 'default',
  zoom: 100,
  noahFontSize: 'md',
  noahFontFamily: 'default',
};

export const FONT_SIZES: readonly { value: FontSize; label: string }[] = [
  { value: 'sm', label: 'Ndogo' },
  { value: 'md', label: 'Wastani' },
  { value: 'lg', label: 'Kubwa' },
  { value: 'xl', label: 'Kubwa zaidi' },
];

export const FONT_FAMILIES: readonly { value: FontFamily; label: string; stack: string }[] = [
  {
    value: 'default',
    label: 'Chaguo-msingi (Inter)',
    stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  { value: 'system', label: 'Herufi za kifaa', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  {
    value: 'serif',
    label: 'Serif ya kitamaduni',
    stack: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  },
  { value: 'readable', label: 'Rahisi kusoma', stack: "Verdana, Tahoma, 'DejaVu Sans', sans-serif" },
  { value: 'mono', label: 'Upana sawa (mono)', stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
];

export const ZOOM_MIN = 75;
export const ZOOM_MAX = 150;
export const ZOOM_STEP = 5;

/** Root font size for the whole app; every rem-based size and spacing follows it. */
const APP_FONT_SIZE: Record<FontSize, string> = { sm: '87.5%', md: '100%', lg: '112.5%', xl: '125%' };
const NOAH_FONT_SIZE: Record<FontSize, string> = { sm: '0.8125rem', md: '0.875rem', lg: '1rem', xl: '1.125rem' };

// Also read by the pre-paint script in src/index.html.
const STORAGE_KEY = 'cms.preferences';

function isFontSize(value: unknown): value is FontSize {
  return FONT_SIZES.some((option) => option.value === value);
}

function isFontFamily(value: unknown): value is FontFamily {
  return FONT_FAMILIES.some((option) => option.value === value);
}

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PREFERENCES.zoom;
  }
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value / ZOOM_STEP) * ZOOM_STEP));
}

function parse(raw: string | null): Preferences {
  try {
    const stored = JSON.parse(raw ?? '{}') as Partial<Record<keyof Preferences, unknown>>;
    return {
      fontSize: isFontSize(stored.fontSize) ? stored.fontSize : DEFAULT_PREFERENCES.fontSize,
      fontFamily: isFontFamily(stored.fontFamily) ? stored.fontFamily : DEFAULT_PREFERENCES.fontFamily,
      zoom: typeof stored.zoom === 'number' ? clampZoom(stored.zoom) : DEFAULT_PREFERENCES.zoom,
      noahFontSize: isFontSize(stored.noahFontSize) ? stored.noahFontSize : DEFAULT_PREFERENCES.noahFontSize,
      noahFontFamily: isFontFamily(stored.noahFontFamily)
        ? stored.noahFontFamily
        : DEFAULT_PREFERENCES.noahFontFamily,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function fontStack(family: FontFamily): string {
  return (FONT_FAMILIES.find((option) => option.value === family) ?? FONT_FAMILIES[0]).stack;
}

/** Per-browser display preferences (text size, fonts, page zoom), applied as CSS variables on <html>. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly preferences = signal<Preferences>({ ...DEFAULT_PREFERENCES });

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    this.preferences.set(parse(localStorage.getItem(STORAGE_KEY)));

    effect(() => {
      const preferences = this.preferences();
      const style = document.documentElement.style;
      style.setProperty('--app-font-size', APP_FONT_SIZE[preferences.fontSize]);
      style.setProperty('--app-font', fontStack(preferences.fontFamily));
      style.setProperty('--page-zoom', String(preferences.zoom / 100));
      style.setProperty('--noah-font-size', NOAH_FONT_SIZE[preferences.noahFontSize]);
      style.setProperty('--noah-font', fontStack(preferences.noahFontFamily));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    });
  }

  update(changes: Partial<Preferences>): void {
    this.preferences.update((current) => {
      const next = { ...current, ...changes };
      return { ...next, zoom: clampZoom(next.zoom) };
    });
  }

  reset(): void {
    this.preferences.set({ ...DEFAULT_PREFERENCES });
  }
}
