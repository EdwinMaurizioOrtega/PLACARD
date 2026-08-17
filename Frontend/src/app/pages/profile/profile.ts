import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Review, SIZES, STYLES, Stats } from '../../core/models';

@Component({
  selector: 'app-profile',
  imports: [DatePipe, FormsModule],
  template: `
    <div class="page narrow">
      <div class="page-head">
        <div>
          <h1>Mi perfil</h1>
          <p class="subtitle">Tus datos, preferencias y reputación en la comunidad.</p>
        </div>
        <button class="btn btn-danger" (click)="removeAccount()">Eliminar cuenta</button>
      </div>

      @if (stats(); as data) {
        <div class="metrics">
          <div class="card metric">
            <span class="value">{{ data.mine.my_garments }}</span>
            <span class="muted">Prendas publicadas</span>
          </div>
          <div class="card metric">
            <span class="value">{{ data.mine.my_likes_received }}</span>
            <span class="muted">Me gusta recibidos</span>
          </div>
          <div class="card metric">
            <span class="value">{{ data.mine.my_matches }}</span>
            <span class="muted">Matches</span>
          </div>
          <div class="card metric">
            <span class="value">{{ data.mine.unread_messages }}</span>
            <span class="muted">Mensajes sin leer</span>
          </div>
        </div>
      }

      @if (message()) {
        <div class="alert alert-ok">{{ message() }}</div>
      }
      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

      <form class="card" (ngSubmit)="save()">
        <h3>Datos personales</h3>
        <div class="grid-2">
          <div class="field">
            <label for="full_name">Nombre completo</label>
            <input id="full_name" name="full_name" [(ngModel)]="form.full_name" />
          </div>
          <div class="field">
            <label for="username">Usuario</label>
            <input id="username" name="username" [(ngModel)]="form.username" />
          </div>
          <div class="field">
            <label for="phone">Teléfono</label>
            <input id="phone" name="phone" [(ngModel)]="form.phone" />
          </div>
          <div class="field">
            <label for="city">Ciudad</label>
            <input id="city" name="city" [(ngModel)]="form.city" />
          </div>
          <div class="field">
            <label for="neighborhood">Sector</label>
            <input id="neighborhood" name="neighborhood" [(ngModel)]="form.neighborhood" />
          </div>
          <div class="field">
            <label for="max_distance_km">Radio de búsqueda (km)</label>
            <input
              id="max_distance_km"
              name="max_distance_km"
              type="number"
              min="1"
              max="200"
              [(ngModel)]="form.max_distance_km"
            />
          </div>
          <div class="field">
            <label for="avatar_url">Foto de perfil (URL)</label>
            <input id="avatar_url" name="avatar_url" [(ngModel)]="form.avatar_url" />
          </div>
          <div class="field">
            <label for="password">Nueva contraseña (opcional)</label>
            <input id="password" name="password" type="password" [(ngModel)]="form.password" />
          </div>
        </div>

        <div class="field">
          <label for="bio">Sobre mí</label>
          <textarea id="bio" name="bio" [(ngModel)]="form.bio"></textarea>
        </div>

        <div class="field">
          <label>Tallas que uso</label>
          <div class="tags">
            @for (size of sizes; track size) {
              <button
                type="button"
                class="tag"
                [class.on]="selectedSizes().includes(size)"
                (click)="toggle(selectedSizes, size)"
              >
                {{ size }}
              </button>
            }
          </div>
        </div>

        <div class="field">
          <label>Estilos favoritos</label>
          <div class="tags">
            @for (style of styles; track style) {
              <button
                type="button"
                class="tag"
                [class.on]="selectedStyles().includes(style)"
                (click)="toggle(selectedStyles, style)"
              >
                {{ style }}
              </button>
            }
          </div>
        </div>

        <div class="row">
          <button type="button" class="btn btn-ghost" (click)="useLocation()">
            📍 Actualizar mi ubicación
          </button>
          <span class="muted">
            Actual: {{ coords() }}
          </span>
        </div>

        <div class="row end">
          <button class="btn btn-primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>

      <section class="card">
        <h3>Mi reputación ({{ auth.user()?.rating_count }} calificaciones)</h3>
        @if (reviews().length === 0) {
          <p class="muted">Todavía no tienes calificaciones. Completa intercambios para ganarlas.</p>
        } @else {
          <div class="stack">
            @for (review of reviews(); track review.id) {
              <div class="review">
                <img class="avatar" [src]="review.reviewer_avatar_url" alt="" />
                <div>
                  <strong>&#64;{{ review.reviewer_username }}</strong>
                  <span class="stars">{{ '★'.repeat(review.rating) }}</span>
                  <p class="muted">{{ review.comment ?? 'Sin comentario' }}</p>
                  <small class="muted">{{ review.created_at | date: 'dd/MM/yyyy' }}</small>
                </div>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .narrow {
      max-width: 820px;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.8rem;
      margin-bottom: 1.2rem;
    }

    .metric {
      text-align: center;
      padding: 1rem;
    }

    .metric .value {
      display: block;
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--brand);
    }

    .card {
      margin-bottom: 1.2rem;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .tag {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 0.3rem 0.8rem;
      font-size: 0.85rem;
      font-family: inherit;
      cursor: pointer;
    }

    .tag.on {
      background: var(--brand);
      border-color: var(--brand);
      color: #fff;
    }

    .row.end {
      justify-content: flex-end;
    }

    .review {
      display: flex;
      gap: 0.7rem;
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.7rem;
    }

    .review p {
      margin: 0.2rem 0;
    }

    .stars {
      color: #f5a524;
      margin-left: 0.4rem;
    }
  `,
})
export class ProfilePage implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly sizes = SIZES;
  readonly styles = STYLES;
  readonly selectedSizes = signal<string[]>([]);
  readonly selectedStyles = signal<string[]>([]);
  readonly reviews = signal<Review[]>([]);
  readonly stats = signal<Stats | null>(null);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  form = {
    full_name: '',
    username: '',
    phone: '',
    city: '',
    neighborhood: '',
    bio: '',
    avatar_url: '',
    max_distance_km: 25,
    password: '',
    latitude: null as number | null,
    longitude: null as number | null,
  };

  ngOnInit() {
    this.auth.refresh().subscribe((user) => {
      this.form = {
        full_name: user.full_name,
        username: user.username,
        phone: user.phone ?? '',
        city: user.city,
        neighborhood: user.neighborhood ?? '',
        bio: user.bio ?? '',
        avatar_url: user.avatar_url ?? '',
        max_distance_km: user.max_distance_km,
        password: '',
        latitude: user.latitude,
        longitude: user.longitude,
      };
      this.selectedSizes.set(user.preferred_sizes);
      this.selectedStyles.set(user.preferred_styles);
      this.api.reviewsForUser(user.id).subscribe((items) => this.reviews.set(items));
    });
    this.api.stats().subscribe((data) => this.stats.set(data));
  }

  coords(): string {
    const { latitude, longitude } = this.form;
    return latitude && longitude ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : 'sin registrar';
  }

  toggle(list: WritableSignal<string[]>, value: string) {
    list.update((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  useLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        this.form.latitude = pos.coords.latitude;
        this.form.longitude = pos.coords.longitude;
        this.message.set('Ubicación capturada. Guarda los cambios para aplicarla.');
      },
      () => this.error.set('No se pudo obtener la ubicación del navegador'),
    );
  }

  save() {
    const user = this.auth.user();
    if (!user) return;

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    const payload: Record<string, unknown> = {
      ...this.form,
      preferred_sizes: this.selectedSizes(),
      preferred_styles: this.selectedStyles(),
    };
    if (!this.form.password) delete payload['password'];

    this.api.updateUser(user.id, payload).subscribe({
      next: (updated) => {
        this.auth.setUser(updated);
        this.form.password = '';
        this.message.set('Perfil actualizado.');
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'No se pudo guardar el perfil');
        this.saving.set(false);
      },
    });
  }

  removeAccount() {
    const user = this.auth.user();
    if (!user) return;
    if (!confirm('Esto eliminará tu cuenta, prendas y matches. ¿Continuar?')) return;
    this.api.deleteUser(user.id).subscribe(() => this.auth.logout());
  }
}
