import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PreferencesService } from './core/preferences';
import { ThemeService } from './core/theme';
import { ConfirmDialog } from './shared/confirm-dialog';
import { OfflineScreen } from './shared/offline-screen';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, OfflineScreen, ConfirmDialog],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  // Instantiated here so the stored theme and display preferences apply on every route.
  private readonly theme = inject(ThemeService);
  private readonly preferences = inject(PreferencesService);
}
