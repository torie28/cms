import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';
import { I18nService, isLang, Lang } from './i18n';
import { ModuleAction, ModulePrivileges } from './modules';

/** Modules whose access used to include every write, before privileges were stored. */
const LEGACY_WRITE = new Set(['sadaka', 'jumuiya', 'kanda', 'notifications']);

export interface AuthenticatedUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone?: string | null;
  gender?: string | null;
  role: string;
  role_label?: string | null;
  modules?: string[];
  privileges?: Record<string, ModulePrivileges>;
  /** Preferred UI language; null until the user has chosen one. */
  locale?: Lang | null;
}

export interface Credentials {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: AuthenticatedUser;
}

const USER_KEY = 'cms.session';
const TOKEN_KEY = 'cms.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(I18nService);
  private readonly currentUser = signal<AuthenticatedUser | null>(null);
  private readonly currentToken = signal<string | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly token = this.currentToken.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null && this.currentToken() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');

  /** Sessions stored before modules existed carry no list; treat them as unrestricted until refreshed. */
  canAccess(module: string | readonly string[]): boolean {
    const modules = this.currentUser()?.modules;
    const wanted = typeof module === 'string' ? [module] : module;
    return !modules || wanted.some((key) => key === 'dashboard' || modules.includes(key));
  }

  /**
   * Whether the signed-in user may create, edit or delete inside a module.
   * Administrators always may. A session saved before privileges existed keeps
   * the old rule until it is refreshed: full write on parish modules, none elsewhere.
   */
  can(module: string, action: ModuleAction): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }
    if (user.role === 'admin') {
      return true;
    }
    if (!user.privileges) {
      return LEGACY_WRITE.has(module) && this.canAccess(module);
    }
    return !!user.privileges[module]?.[action];
  }

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    // Sessions are scoped to the tab so every fresh visit starts at the login page;
    // drop any session persisted by older builds.
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);

    const storedUser = sessionStorage.getItem(USER_KEY);
    const storedToken = sessionStorage.getItem(TOKEN_KEY);

    if (storedUser && storedToken) {
      try {
        const user = JSON.parse(storedUser) as AuthenticatedUser;
        this.currentUser.set(user);
        this.currentToken.set(storedToken);
        if (isLang(user.locale)) {
          this.i18n.use(user.locale);
        }
      } catch {
        this.clearStorage();
      }
    }
  }

  async authenticate({ username, password }: Credentials): Promise<AuthenticatedUser> {
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${API_BASE}/login`, { username, password }),
      );

      this.currentToken.set(response.token);
      this.storeUser(response.user);

      if (this.isBrowser) {
        sessionStorage.setItem(TOKEN_KEY, response.token);
      }

      return response.user;
    } catch (error) {
      throw new Error(this.messageFrom(error));
    }
  }

  /** Re-reads the signed-in user so role and module changes apply without signing in again. */
  async refresh(): Promise<void> {
    if (!this.currentToken()) {
      return;
    }

    try {
      this.storeUser(await firstValueFrom(this.http.get<AuthenticatedUser>(`${API_BASE}/user`)));
    } catch {
      // Keep the cached session; the interceptor handles expired tokens.
    }
  }

  /** Switches the UI language and, when signed in, remembers it on the account. */
  async setLanguage(lang: Lang): Promise<void> {
    this.i18n.use(lang);
    const user = this.currentUser();

    if (!user || !this.currentToken()) {
      return;
    }

    this.storeUser({ ...user, locale: lang });

    try {
      await firstValueFrom(this.http.put(`${API_BASE}/user/preferences`, { locale: lang }));
    } catch {
      // The choice still applies in this browser.
    }
  }

  async signOut(): Promise<void> {
    const token = this.currentToken();

    if (token) {
      try {
        await firstValueFrom(this.http.post(`${API_BASE}/logout`, {}));
      } catch {
        // Still clear the local session if the API is unreachable.
      }
    }

    this.currentUser.set(null);
    this.currentToken.set(null);

    if (this.isBrowser) {
      this.clearStorage();
    }
  }

  private messageFrom(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string; errors?: Record<string, string[]> } | null;
      const fieldError = body?.errors?.['username']?.[0] ?? body?.errors?.['password']?.[0];
      return fieldError ?? body?.message ?? 'Imeshindwa kuingia.';
    }

    return 'Imeshindwa kuingia.';
  }

  private storeUser(user: AuthenticatedUser): void {
    if (isLang(user.locale)) {
      this.i18n.use(user.locale);
    } else if (this.currentToken()) {
      // First sign-in since languages existed: keep what they picked on the login page.
      user = { ...user, locale: this.i18n.lang() };
      void firstValueFrom(this.http.put(`${API_BASE}/user/preferences`, { locale: user.locale })).catch(() => {});
    }

    this.currentUser.set(user);

    if (this.isBrowser) {
      localStorage.removeItem(USER_KEY);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  private clearStorage(): void {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
}
