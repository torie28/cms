import { Routes } from '@angular/router';
import { authGuard, guestGuard, moduleGuard } from './core/auth-guard';
import { Dashboard } from './pages/dashboard/dashboard';
import {
  SETTINGS_ACCESS,
  SETTINGS_ROUTES,
} from './pages/dashboard/components/settings/settings.sections';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Ingia · Mfumo wa Usimamizi wa Kanisa',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'forgot-password',
    title: 'Umesahau nenosiri · Mfumo wa Usimamizi wa Kanisa',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    title: 'Weka nenosiri jipya · Mfumo wa Usimamizi wa Kanisa',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'dashboard',
        title: 'Muhtasari · Mfumo wa Usimamizi wa Kanisa',
        component: Dashboard,
      },
      {
        path: 'users',
        canActivate: [moduleGuard('users')],
        loadComponent: () =>
          import('./pages/dashboard/components/users/users').then((m) => m.Users),
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Watumiaji · Mfumo wa Usimamizi wa Kanisa',
            loadComponent: () =>
              import('./pages/dashboard/components/users/user-list/user-list').then(
                (m) => m.UserList,
              ),
          },
          {
            path: 'roles',
            title: 'Nyadhifa · Mfumo wa Usimamizi wa Kanisa',
            loadComponent: () =>
              import('./pages/dashboard/components/users/roles/roles').then((m) => m.Roles),
          },
        ],
      },
      {
        path: 'kanda',
        title: 'Kanda · Mfumo wa Usimamizi wa Kanisa',
        canActivate: [moduleGuard('kanda')],
        loadComponent: () =>
          import('./pages/dashboard/components/kanda/kanda').then((m) => m.KandaPage),
      },
      {
        path: 'sadaka',
        title: 'Sadaka · Mfumo wa Usimamizi wa Kanisa',
        canActivate: [moduleGuard('sadaka')],
        loadComponent: () =>
          import('./pages/dashboard/components/sadaka/sadaka').then((m) => m.Sadaka),
      },
      {
        path: 'matukio',
        title: 'Matukio · Mfumo wa Usimamizi wa Kanisa',
        canActivate: [moduleGuard('matukio')],
        loadComponent: () =>
          import('./pages/dashboard/components/matukio/matukio').then((m) => m.Matukio),
      },
      {
        path: 'jumuiya',
        title: 'Jumuiya · Mfumo wa Usimamizi wa Kanisa',
        canActivate: [moduleGuard('jumuiya')],
        loadComponent: () =>
          import('./pages/dashboard/components/jumuiya/jumuiya').then((m) => m.JumuiyaPage),
      },
      {
        path: 'notifications',
        title: 'Arifa na SMS · Mfumo wa Usimamizi wa Kanisa',
        canActivate: [moduleGuard('notifications')],
        loadComponent: () =>
          import('./pages/dashboard/components/notifications/notifications').then(
            (m) => m.NotificationsPage,
          ),
      },
      {
        path: 'settings',
        title: 'Mipangilio · Mfumo wa Usimamizi wa Kanisa',
        canActivate: SETTINGS_ACCESS ? [moduleGuard(SETTINGS_ACCESS)] : [],
        loadComponent: () =>
          import('./pages/dashboard/components/settings/settings').then((m) => m.Settings),
        children: SETTINGS_ROUTES,
      },
      {
        path: 'no-access',
        title: 'Huna ruhusa · Mfumo wa Usimamizi wa Kanisa',
        loadComponent: () => import('./pages/forbidden/forbidden').then((m) => m.Forbidden),
      },
    ],
  },
  {
    path: '**',
    title: 'Ukurasa haukupatikana · Mfumo wa Usimamizi wa Kanisa',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
