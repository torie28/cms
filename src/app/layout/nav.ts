import { SETTINGS_MODULES } from '../pages/dashboard/components/settings/settings.sections';
import { IconName } from '../shared/icon';

export interface NavItem {
  label: string;
  path: string | null;
  icon: IconName;
  exact?: boolean;
  /** Key(s) in the backend `modules` table; shown when the user can open any of them. */
  module?: string | readonly string[];
}

export const APP_NAV: NavItem[] = [
  { label: 'Muhtasari', path: '/dashboard', icon: 'grid', exact: true, module: 'dashboard' },
  { label: 'Watumiaji', path: '/users', icon: 'users', exact: false, module: 'users' },
  { label: 'Mahudhurio', path: null, icon: 'check' },
  { label: 'Sadaka', path: '/sadaka', icon: 'coin', exact: true, module: 'sadaka' },
  { label: 'Matukio', path: null, icon: 'calendar' },
  { label: 'Jumuiya', path: '/jumuiya', icon: 'heart', exact: true, module: 'jumuiya' },
  { label: 'Kanda', path: '/kanda', icon: 'map', exact: true, module: 'kanda' },
  { label: 'Arifa na SMS', path: '/notifications', icon: 'bell', exact: true, module: 'notifications' },
  { label: 'Mipangilio', path: '/settings', icon: 'gear', exact: false, module: SETTINGS_MODULES },
];
