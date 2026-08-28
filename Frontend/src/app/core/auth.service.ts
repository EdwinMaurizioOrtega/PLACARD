import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import { ApiService } from './api.service';
import { AuthResponse, User } from './models';

const TOKEN_KEY = 'placard_token';
const USER_KEY = 'placard_user';

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60_000,
};

export type GeoStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(readStoredUser());
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly geoStatus = signal<GeoStatus>('unknown');
  readonly hasCoords = computed(() => {
    const user = this.user();
    return user?.latitude != null && user?.longitude != null;
  });
  // Las coordenadas guardadas no bastan: el usuario puede revocar el permiso despues.
  readonly hasLocation = computed(() => this.geoStatus() === 'granted' && this.hasCoords());

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

  // La ubicacion se toma en cada sesion, no al registrarse: el usuario se mueve
  // y el feed depende de donde esta ahora. Nunca falla, solo informa si se logro.
  syncLocation(): Observable<boolean> {
    const user = this.user();
    if (!user) return of(false);

    return this.currentPosition().pipe(
      switchMap((coords) =>
        coords
          ? this.api.updateUser(user.id, {
              latitude: coords.latitude,
              longitude: coords.longitude,
            })
          : of(null),
      ),
      tap((updated) => {
        if (updated) this.setUser(updated);
      }),
      map((updated) => updated !== null),
      catchError(() => of(false)),
    );
  }

  /** Mantiene el indicador al dia si el usuario revoca el permiso desde el navegador. */
  watchGeoPermission() {
    if (!navigator.geolocation) {
      this.geoStatus.set('unavailable');
      return;
    }
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((permission) => {
        const apply = () => this.geoStatus.set(toGeoStatus(permission.state));
        apply();
        permission.onchange = apply;
      })
      .catch(() => undefined);
  }

  setUser(user: User) {
    this.user.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.geoStatus.set('unknown');
    this.router.navigate(['/login']);
  }

  private currentPosition(): Observable<GeolocationCoordinates | null> {
    return new Observable((subscriber) => {
      if (!navigator.geolocation) {
        this.geoStatus.set('unavailable');
        subscriber.next(null);
        subscriber.complete();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.geoStatus.set('granted');
          subscriber.next(pos.coords);
          subscriber.complete();
        },
        (err) => {
          this.geoStatus.set(err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown');
          subscriber.next(null);
          subscriber.complete();
        },
        GEO_OPTIONS,
      );
    });
  }

  private persist(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.token);
    this.setUser(res.user);
  }
}

function toGeoStatus(state: PermissionState): GeoStatus {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  return 'unknown';
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
