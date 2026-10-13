import { inject, Type } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from '../../../../core/auth';
import { moduleGuard, noAccessUrl } from '../../../../core/auth-guard';

export interface SettingsSection {
  /** URL segment under /settings, and by convention the sub-folder name. */
  path: string;
  label: string;
  description: string;
  /**
   * Key in the backend `modules` table (see API/app/Support/Modules.php) that grants access.
   * Leave out for personal sections every signed-in user may open.
   */
  module?: string;
  loadComponent: () => Promise<Type<unknown>>;
}

/**
 * Every settings sub-module. To add one, create a folder next to this file
 * (e.g. `./backup/backup.ts`), add its module key to API/app/Support/Modules.php,
 * and add an entry here — the side menu, route and access check come from this list.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    path: 'preferences',
    label: 'Mwonekano na lugha',
    description: 'Mandhari, ukubwa wa herufi, zoom na lugha',
    loadComponent: () => import('./preferences/preferences').then((m) => m.PreferencesSettings),
  },
  {
    path: 'system',
    label: 'Mipangilio ya mfumo',
    description: 'Washa au zima moduli za mfumo',
    module: 'settings',
    loadComponent: () => import('./system-settings/system-settings').then((m) => m.SystemSettings),
  },
  {
    path: 'apis',
    label: 'API na huduma za nje',
    description: 'SMS, barua pepe na funguo za huduma nyingine',
    module: 'api_settings',
    loadComponent: () => import('./api-settings/api-settings').then((m) => m.ApiSettings),
  },
  {
    path: 'activity-logs',
    label: 'Kumbukumbu za shughuli',
    description: 'Nani alifanya nini, na lini',
    module: 'activity_logs',
    loadComponent: () => import('./activity-logs/activity-logs').then((m) => m.ActivityLogs),
  },
];

export const SETTINGS_MODULES = SETTINGS_SECTIONS.flatMap((section) => (section.module ? [section.module] : []));

/** Undefined when some section is open to everyone, so the Settings menu and route need no module. */
export const SETTINGS_ACCESS: readonly string[] | undefined = SETTINGS_SECTIONS.every((section) => section.module)
  ? SETTINGS_MODULES
  : undefined;

export function canOpenSection(auth: AuthService, section: SettingsSection): boolean {
  return !section.module || auth.canAccess(section.module);
}

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      const auth = inject(AuthService);
      const first = SETTINGS_SECTIONS.find((section) => canOpenSection(auth, section));
      return first ? `/settings/${first.path}` : noAccessUrl(inject(Router), SETTINGS_MODULES);
    },
  },
  ...SETTINGS_SECTIONS.map((section) => ({
    path: section.path,
    title: `${section.label} · Mfumo wa Usimamizi wa Kanisa`,
    canActivate: section.module ? [moduleGuard(section.module)] : ([] as CanActivateFn[]),
    loadComponent: section.loadComponent,
  })),
];
