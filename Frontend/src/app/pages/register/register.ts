import { Component, WritableSignal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { SIZES, STYLES } from '../../core/models';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <section class="card">
        <h1>Crear cuenta</h1>
        <p class="subtitle">Únete a la comunidad de moda circular de Cuenca.</p>

        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }

        <form (ngSubmit)="submit()">
          <div class="grid-2">
            <div class="field">
              <label for="full_name">Nombre completo</label>
              <input id="full_name" name="full_name" [(ngModel)]="form.full_name" required />
            </div>
            <div class="field">
              <label for="username">Usuario</label>
              <input id="username" name="username" [(ngModel)]="form.username" required />
            </div>
            <div class="field">
              <label for="email">Correo electrónico</label>
              <input id="email" name="email" type="email" [(ngModel)]="form.email" required />
            </div>
            <div class="field">
              <label for="password">Contraseña (mín. 8)</label>
              <input
                id="password"
                name="password"
                type="password"
                [(ngModel)]="form.password"
                required
              />
            </div>
            <div class="field">
              <label for="city">Ciudad</label>
              <input id="city" name="city" [(ngModel)]="form.city" />
            </div>
            <div class="field">
              <label for="phone">Teléfono</label>
              <input id="phone" name="phone" [(ngModel)]="form.phone" />
            </div>
          </div>

          <div class="field">
            <label>Tallas que usas</label>
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
              📍 {{ located() ? 'Ubicación registrada' : 'Usar mi ubicación' }}
            </button>
            <span class="muted">Se usa para priorizar prendas cercanas.</span>
          </div>

          <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
            {{ loading() ? 'Creando cuenta…' : 'Crear cuenta' }}
          </button>
        </form>

        <p class="foot">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
      </section>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem 1rem;
      background: linear-gradient(135deg, #fff1f6 0%, #f6f2ff 55%, #e9fbf8 100%);
    }

    .card {
      width: min(620px, 100%);
      padding: 2rem;
      box-shadow: var(--shadow-lg);
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

    .row {
      margin: 0.5rem 0 1rem;
    }

    .foot {
      text-align: center;
      font-size: 0.9rem;
      margin: 1rem 0 0;
    }
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly sizes = SIZES;
  readonly styles = STYLES;
  readonly selectedSizes = signal<string[]>([]);
  readonly selectedStyles = signal<string[]>([]);
  readonly located = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  form = {
    full_name: '',
    username: '',
    email: '',
    password: '',
    city: 'Cuenca',
    phone: '',
    latitude: null as number | null,
    longitude: null as number | null,
  };

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
        this.located.set(true);
      },
      () => this.error.set('No se pudo obtener la ubicación del navegador'),
    );
  }

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth
      .register({
        ...this.form,
        preferred_sizes: this.selectedSizes(),
        preferred_styles: this.selectedStyles(),
      })
      .subscribe({
        next: () => this.router.navigate(['/descubrir']),
        error: (err) => {
          this.error.set(err?.error?.error ?? 'No se pudo crear la cuenta');
          this.loading.set(false);
        },
      });
  }
}
