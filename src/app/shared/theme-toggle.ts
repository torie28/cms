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
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  protected select(preference: ThemePreference): void {
    this.theme.use(preference);
  }
}
