import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../../core/auth';
import { TranslatePipe } from '../../../../core/i18n';
import { SETTINGS_SECTIONS } from './settings.sections';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './settings.html',
})
export class Settings {
  private readonly auth = inject(AuthService);

  protected readonly sections = computed(() =>
    SETTINGS_SECTIONS.filter((section) => this.auth.canAccess(section.module)),
  );
}
