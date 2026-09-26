import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'cms.token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return next(req.clone({ setHeaders: headers }));
};

function readToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}
