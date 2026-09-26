import { IconName } from '../shared/icon';

export interface NavItem {
  label: string;
  path: string | null;
  icon: IconName;
  exact?: boolean;
}

export const APP_NAV: NavItem[] = [
  { label: 'Overview', path: '/dashboard', icon: 'grid', exact: true },
  { label: 'Users', path: '/users', icon: 'users', exact: true },
  { label: 'Attendance', path: null, icon: 'check' },
  { label: 'Giving', path: null, icon: 'coin' },
  { label: 'Events', path: null, icon: 'calendar' },
  { label: 'Jumuiya', path: '/jumuiya', icon: 'heart', exact: true },
  { label: 'Kanda', path: '/kanda', icon: 'map', exact: true },
  { label: 'Settings', path: '/settings', icon: 'gear', exact: false },
];
