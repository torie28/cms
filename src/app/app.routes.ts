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
        title: 'Dashboard · Church Management System',
        component: Dashboard,
      },
      {
        path: 'users',
        title: 'Users · Church Management System',
        loadComponent: () => import('./pages/users/users').then((m) => m.Users),
      },
      {
        path: 'kanda',
        title: 'Kanda · Church Management System',
        loadComponent: () => import('./pages/kanda/kanda').then((m) => m.KandaPage),
      },
      {
        path: 'jumuiya',
        title: 'Jumuiya · Church Management System',
        loadComponent: () => import('./pages/jumuiya/jumuiya').then((m) => m.JumuiyaPage),
      },
      {
        path: 'settings',
        title: 'Settings · Church Management System',
        loadComponent: () =>
          import('./pages/dashboard/components/settings/settings').then((m) => m.Settings),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'activity-logs' },
          {
            path: 'activity-logs',
            title: 'Activity logs · Church Management System',
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
