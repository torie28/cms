import { HttpInterceptorFn } from '@angular/common/http';
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

  return next(req.clone({ setHeaders: headers }));
};

function readToken(): string | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  return sessionStorage.getItem(TOKEN_KEY);
}
