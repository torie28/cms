import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../../core/auth';
import { ConfirmService } from '../../../../../core/confirm';
import { I18nService, Lang, LANGUAGES, translate, TranslatePipe } from '../../../../../core/i18n';
import {
  DEFAULT_PREFERENCES,
  FONT_FAMILIES,
  FONT_SIZES,
  FontFamily,
  FontSize,
  PreferencesService,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from '../../../../../core/preferences';
import { ThemePreference, ThemeService } from '../../../../../core/theme';

const DEFAULT_THEME: ThemePreference = 'system';
const DEFAULT_LANG: Lang = 'sw';

@Component({
  selector: 'app-preferences-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './preferences.html',
})
export class PreferencesSettings {
  private readonly prefs = inject(PreferencesService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);

  protected readonly fontSizes = FONT_SIZES;
  protected readonly fontFamilies = FONT_FAMILIES;
  protected readonly languages = LANGUAGES;
  protected readonly zoomMin = ZOOM_MIN;
  protected readonly zoomMax = ZOOM_MAX;
  protected readonly zoomStep = ZOOM_STEP;
  protected readonly themes: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Mwanga' },
    { value: 'dark', label: 'Giza' },
    { value: 'system', label: 'Mfumo' },
  ];

  protected readonly current = this.prefs.preferences;
  protected readonly themePreference = this.theme.preference;
  protected readonly notice = signal<string | null>(null);

  protected readonly isDefault = computed(() => {
    const current = this.current();
    return (
      (Object.keys(DEFAULT_PREFERENCES) as (keyof typeof DEFAULT_PREFERENCES)[]).every(
        (key) => current[key] === DEFAULT_PREFERENCES[key],
      ) &&
      this.themePreference() === DEFAULT_THEME &&
      this.i18n.lang() === DEFAULT_LANG
    );
  });

  protected fontStack(family: FontFamily): string {
    return (FONT_FAMILIES.find((option) => option.value === family) ?? FONT_FAMILIES[0]).stack;
  }

  protected setTheme(value: ThemePreference): void {
    this.theme.use(value);
  }

  protected setFontSize(value: FontSize): void {
    this.prefs.update({ fontSize: value });
  }

  protected setFontFamily(value: string): void {
    this.prefs.update({ fontFamily: value as FontFamily });
  }

  protected setZoom(value: number | string): void {
    this.prefs.update({ zoom: Number(value) });
  }

  protected stepZoom(direction: 1 | -1): void {
    this.setZoom(this.current().zoom + direction * ZOOM_STEP);
  }

  protected setNoahFontSize(value: FontSize): void {
    this.prefs.update({ noahFontSize: value });
  }

  protected setNoahFontFamily(value: string): void {
    this.prefs.update({ noahFontFamily: value as FontFamily });
  }

  protected setLanguage(value: Lang): void {
    void this.auth.setLanguage(value);
  }

  protected async resetAll(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Rudisha mipangilio ya awali',
      message: translate(
        'Mandhari, ukubwa wa herufi, aina ya herufi, zoom, mipangilio ya Noah na lugha vitarudi kwenye chaguo-msingi. Endelea?',
      ),
      confirmLabel: 'Rudisha',
    });

    if (!confirmed) {
      return;
    }

    this.prefs.reset();
    this.theme.use(DEFAULT_THEME);
    await this.auth.setLanguage(DEFAULT_LANG);
    this.notice.set('Mipangilio imerudishwa kwenye chaguo-msingi.');
  }
}
