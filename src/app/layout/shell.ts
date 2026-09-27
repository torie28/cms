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
import { I18nService, TranslatePipe } from '../core/i18n';
import { liturgicalDay, liturgicalName } from '../core/liturgical';
import { Icon } from '../shared/icon';
import { LanguageToggle } from '../shared/language-toggle';
import { NotificationBell } from '../shared/notification-bell';
import { ThemeToggle } from '../shared/theme-toggle';
import { APP_NAV } from './nav';

const COLLAPSED_KEY = 'cms.sidebar.collapsed';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Icon,
    LanguageToggle,
    NotificationBell,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ThemeToggle,
    TranslatePipe,
  ],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly user = this.auth.user;
  protected readonly sidebarOpen = signal(false);
  protected readonly collapsed = signal(false);
  protected readonly navigation = computed(() =>
    APP_NAV.filter((item) => !item.module || this.auth.canAccess(item.module)),
  );

  private readonly now = new Date();
  protected readonly today = computed(() =>
    this.now.toLocaleDateString(this.i18n.intlLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );
  protected readonly liturgy = liturgicalDay(this.now);
  protected readonly liturgyName = computed(() => liturgicalName(this.liturgy));

  protected readonly roleName = computed(() => {
    const user = this.user();
    return user ? this.i18n.t(user.role_label ?? user.role.replaceAll('_', ' ')) : this.i18n.t('Mgeni');
  });

  protected readonly initials = computed(() => {
    const name = this.user()?.name ?? this.i18n.t('Mgeni');
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
      void this.auth.refresh();
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
