import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth';

export const authGuard: CanActivateFn = () => {
  // The session lives in browser storage, so the server has nothing to check
  // against and defers the decision to hydration.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/** Shows the no-access page unless the user can open at least one of the given modules. */
export function moduleGuard(key: string | readonly string[]): CanActivateFn {
  return (_route, state) => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return true;
    }

    if (inject(AuthService).canAccess(key)) {
      return true;
    }

    // browserUrl keeps the address the user asked for, so a reload re-checks it
    // once their role has been given access.
    return new RedirectCommand(noAccessUrl(inject(Router), key), { browserUrl: state.url });
  };
}

export function noAccessUrl(router: Router, key: string | readonly string[]): UrlTree {
  return router.createUrlTree(['/no-access'], {
    queryParams: { module: [key].flat().join(',') },
  });
}

export const guestGuard: CanActivateFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};
