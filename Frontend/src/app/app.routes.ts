import { Routes } from '@angular/router';

import { adminGuard, authGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'descubrir' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register').then((m) => m.RegisterPage),
  },
  {
    path: 'descubrir',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/discover/discover').then((m) => m.DiscoverPage),
  },
  {
    path: 'explorar',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/explore/explore').then((m) => m.ExplorePage),
  },
  {
    path: 'closet',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/closet/closet').then((m) => m.ClosetPage),
  },
  {
    path: 'closet/nueva',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/garment-form/garment-form').then((m) => m.GarmentFormPage),
  },
  {
    path: 'closet/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/garment-form/garment-form').then((m) => m.GarmentFormPage),
  },
  {
    path: 'matches',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/matches/matches').then((m) => m.MatchesPage),
  },
  {
    path: 'matches/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/chat/chat').then((m) => m.ChatPage),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage),
  },
  {
    path: 'usuarios/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/user-detail/user-detail').then((m) => m.UserDetailPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      {
        path: 'resumen',
        loadComponent: () => import('./pages/admin/overview').then((m) => m.AdminOverviewPage),
      },
      {
        path: 'reporteria',
        loadComponent: () => import('./pages/admin/analytics').then((m) => m.AdminAnalyticsPage),
      },
      {
        path: 'moderacion',
        loadComponent: () => import('./pages/admin/moderation').then((m) => m.AdminModerationPage),
      },
      {
        path: 'catalogo',
        loadComponent: () => import('./pages/admin/catalog').then((m) => m.AdminCatalogPage),
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/admin/users').then((m) => m.AdminUsersPage),
      },
    ],
  },
  { path: '**', redirectTo: 'descubrir' },
];
