import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService, ThemePreference } from '../core/theme';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-toggle.html',
})
export class ThemeToggle {
  private readonly theme = inject(ThemeService);

  protected readonly preference = this.theme.preference;

  protected readonly options: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Mwanga' },
    { value: 'dark', label: 'Giza' },
    { value: 'system', label: 'Mfumo' },
  ];

  protected select(preference: ThemePreference): void {
    this.theme.use(preference);
  }
}
