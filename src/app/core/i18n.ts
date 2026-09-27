import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, Pipe, PipeTransform, PLATFORM_ID, signal } from '@angular/core';
import { EN } from '../i18n/en';

/**
 * Swahili is the source language: UI text is written in Swahili and looked up in the
 * English dictionary (src/app/i18n/en/*) when English is selected. Text missing from
 * the dictionary is shown as-is, so an untranslated string degrades to Swahili.
 */
export type Lang = 'sw' | 'en';

export type TranslateParams = Record<string, string | number | null | undefined>;

export const LANGUAGES: readonly { value: Lang; label: string; short: string }[] = [
  { value: 'sw', label: 'Kiswahili', short: 'SW' },
  { value: 'en', label: 'English', short: 'EN' },
];

const STORAGE_KEY = 'cms.lang';

// Module-level so plain functions (e.g. httpErrorMessage) can translate without DI.
const current = signal<Lang>('sw');

export const currentLang = current.asReadonly();

export function isLang(value: unknown): value is Lang {
  return value === 'sw' || value === 'en';
}

/** Translates Swahili source text; `{name}` placeholders are filled from `params`, others are left alone. */
export function translate(text: string, params?: TranslateParams): string {
  const base = current() === 'en' ? (EN[text] ?? text) : text;

  if (!params) {
    return base;
  }

  return base.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key] ?? '') : match,
  );
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly lang = current.asReadonly();

  /** Locale id for DatePipe / formatDate / toLocale* calls. */
  readonly dateLocale = computed(() => (this.lang() === 'en' ? 'en-GB' : 'sw'));
  readonly intlLocale = computed(() => (this.lang() === 'en' ? 'en-GB' : 'sw-TZ'));

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) {
      current.set(stored);
    }

    effect(() => {
      document.documentElement.lang = this.lang();
      localStorage.setItem(STORAGE_KEY, this.lang());
    });
  }

  use(lang: Lang): void {
    current.set(lang);
  }

  t(text: string, params?: TranslateParams): string {
    return translate(text, params);
  }
}

/** `{{ 'Hifadhi' | t }}` or `{{ 'Jumuiya {n}' | t: { n: count } }}`. Impure so it follows language changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  transform(text: string | null | undefined, params?: TranslateParams): string {
    return text ? translate(text, params) : '';
  }
}
