import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth';
import { roleLabel } from '../core/users';
import { Icon } from '../shared/icon';
import { ThemeToggle } from '../shared/theme-toggle';
import { APP_NAV } from './nav';

const COLLAPSED_KEY = 'cms.sidebar.collapsed';

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
  protected readonly collapsed = signal(false);
  protected readonly navigation = APP_NAV;

  protected readonly today = new Date().toLocaleDateString('sw-TZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  protected readonly roleName = computed(() => {
    const role = this.user()?.role;
    return role ? roleLabel(role) : 'Mgeni';
  });

  protected readonly initials = computed(() => {
    const name = this.user()?.name ?? 'Mgeni';
    return name
      .replace(/^(Rev\.|Pastor|Deacon|Padre|Mchungaji)\s+/i, '')
      .split(' ')
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  });

  constructor() {
    afterNextRender(() => {
      this.collapsed.set(localStorage.getItem(COLLAPSED_KEY) === '1');
    });
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
    localStorage.setItem(COLLAPSED_KEY, this.collapsed() ? '1' : '0');
  }

  protected signOut(): void {
    void this.auth.signOut().then(() => this.router.navigate(['/login']));
  }
}
