import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth-guard';
import { Dashboard } from './pages/dashboard/dashboard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    title: 'Sign in · Church Management System',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
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
        title: 'Watumiaji · Mfumo wa Usimamizi wa Kanisa',
        loadComponent: () => import('./pages/users/users').then((m) => m.Users),
      },
      {
        path: 'kanda',
        title: 'Kanda · Mfumo wa Usimamizi wa Kanisa',
        loadComponent: () =>
          import('./pages/dashboard/components/kanda/kanda').then((m) => m.KandaPage),
      },
      {
        path: 'sadaka',
        title: 'Sadaka · Mfumo wa Usimamizi wa Kanisa',
        loadComponent: () =>
          import('./pages/dashboard/components/sadaka/sadaka').then((m) => m.Sadaka),
      },
      {
        path: 'jumuiya',
        title: 'Jumuiya · Mfumo wa Usimamizi wa Kanisa',
        loadComponent: () =>
          import('./pages/dashboard/components/jumuiya/jumuiya').then((m) => m.JumuiyaPage),
      },
      {
        path: 'settings',
        title: 'Mipangilio · Mfumo wa Usimamizi wa Kanisa',
        loadComponent: () =>
          import('./pages/dashboard/components/settings/settings').then((m) => m.Settings),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'activity-logs' },
          {
            path: 'activity-logs',
            title: 'Kumbukumbu za shughuli · Mfumo wa Usimamizi wa Kanisa',
            loadComponent: () =>
              import('./pages/dashboard/components/settings/activity-logs/activity-logs').then(
                (m) => m.ActivityLogs,
              ),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
