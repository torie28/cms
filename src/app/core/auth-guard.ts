import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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

/** Sends users to the dashboard unless they can open at least one of the given modules. */
export function moduleGuard(key: string | readonly string[]): CanActivateFn {
  return () => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return true;
    }

    const auth = inject(AuthService);
    return auth.canAccess(key) ? true : inject(Router).createUrlTree(['/dashboard']);
  };
}

export const guestGuard: CanActivateFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};
