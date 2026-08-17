import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

import { ApiService } from './api.service';
import { AuthResponse, User } from './models';

const TOKEN_KEY = 'placard_token';
const USER_KEY = 'placard_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(readStoredUser());
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string) {
    return this.api.login(email, password).pipe(tap((res) => this.persist(res)));
  }

  register(body: Record<string, unknown>) {
    return this.api.register(body).pipe(tap((res) => this.persist(res)));
  }

  refresh() {
    return this.api.me().pipe(tap((user) => this.setUser(user)));
  }

  setUser(user: User) {
    this.user.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  private persist(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.token);
    this.setUser(res.user);
  }
}

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
