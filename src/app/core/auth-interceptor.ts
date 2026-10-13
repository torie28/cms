import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth';
import { currentLang } from './i18n';

const TOKEN_KEY = 'cms.token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    // Lets Laravel answer framework messages (e.g. validation) in the UI language.
    'Accept-Language': currentLang(),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((error: unknown) => {
      // The token expired or was revoked (e.g. password changed): start a fresh sign-in.
      if (token && error instanceof HttpErrorResponse && error.status === 401) {
        auth.expireSession();
        void router.navigateByUrl('/login');
      }

      return throwError(() => error);
    }),
  );
};

function readToken(): string | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  return sessionStorage.getItem(TOKEN_KEY);
}
