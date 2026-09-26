import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';

export interface AuthenticatedUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
}

export interface Credentials {
  username: string;
  password: string;
  remember: boolean;
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
  private readonly currentUser = signal<AuthenticatedUser | null>(null);
  private readonly currentToken = signal<string | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly token = this.currentToken.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null && this.currentToken() !== null);

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    const storedUser = sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY);
    const storedToken = sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);

    if (storedUser && storedToken) {
      try {
        this.currentUser.set(JSON.parse(storedUser) as AuthenticatedUser);
        this.currentToken.set(storedToken);
      } catch {
        this.clearStorage();
      }
    }
  }

  async authenticate({ username, password, remember }: Credentials): Promise<AuthenticatedUser> {
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${API_BASE}/login`, { username, password }),
      );

      this.currentUser.set(response.user);
      this.currentToken.set(response.token);

      if (this.isBrowser) {
        this.clearStorage();
        const store = remember ? localStorage : sessionStorage;
        store.setItem(USER_KEY, JSON.stringify(response.user));
        store.setItem(TOKEN_KEY, response.token);
      }

      return response.user;
    } catch (error) {
      throw new Error(this.messageFrom(error));
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
      return fieldError ?? body?.message ?? 'Unable to sign in.';
    }

    return 'Unable to sign in.';
  }

  private clearStorage(): void {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
}
