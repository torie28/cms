import { IconName } from '../shared/icon';

export interface NavItem {
  label: string;
  path: string | null;
  icon: IconName;
  exact?: boolean;
}

export const APP_NAV: NavItem[] = [
  { label: 'Muhtasari', path: '/dashboard', icon: 'grid', exact: true },
  { label: 'Watumiaji', path: '/users', icon: 'users', exact: true },
  { label: 'Mahudhurio', path: null, icon: 'check' },
  { label: 'Sadaka', path: '/sadaka', icon: 'coin', exact: true },
  { label: 'Matukio', path: null, icon: 'calendar' },
  { label: 'Jumuiya', path: '/jumuiya', icon: 'heart', exact: true },
  { label: 'Kanda', path: '/kanda', icon: 'map', exact: true },
  { label: 'Mipangilio', path: '/settings', icon: 'gear', exact: false },
];
