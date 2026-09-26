import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth';
import { Icon } from '../shared/icon';
import { ThemeToggle } from '../shared/theme-toggle';
import { APP_NAV } from './nav';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, RouterLinkActive, RouterOutlet, ThemeToggle],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly sidebarOpen = signal(false);
  protected readonly navigation = APP_NAV;

  protected readonly today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  protected readonly initials = computed(() => {
    const name = this.user()?.name ?? 'Guest';
    return name
      .replace(/^(Rev\.|Pastor|Deacon)\s+/i, '')
      .split(' ')
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  });

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected signOut(): void {
    void this.auth.signOut().then(() => this.router.navigate(['/login']));
  }
}
