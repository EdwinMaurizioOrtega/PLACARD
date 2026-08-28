import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth">
      <section class="hero">
        <img class="logo" src="logo-placard.png" alt="PLACARD S.A." />
        <p>
          Moda circular en Cuenca. Desliza, haz match e intercambia las prendas que ya no usas.
        </p>
        <ul>
          <li>👗 Descubre prendas cercanas con un swipe</li>
          <li>🤝 Haz match en un producto de interés</li>
          <li>♻️ Alarga la vida útil de tu ropa</li>
        </ul>
      </section>

      <section class="card form">
        <h2>Iniciar sesión</h2>
        <p class="subtitle">Ingresa con tu cuenta PLACARD.</p>

        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }

        <form (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Correo electrónico</label>
            <input id="email" name="email" type="email" [(ngModel)]="email" required />
          </div>
          <div class="field">
            <label for="password">Contraseña</label>
            <input id="password" name="password" type="password" [(ngModel)]="password" required />
          </div>
          <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
            {{ loading() ? 'Ingresando…' : 'Entrar' }}
          </button>
        </form>

        <p class="geo muted">
          📍 Al entrar te pediremos tu ubicación para mostrarte prendas cercanas a donde estás hoy.
        </p>

        <p class="foot">¿Aún no tienes cuenta? <a routerLink="/registro">Regístrate</a></p>
        <p class="demo">Demo: mariajose&#64;placard.ec / placard123</p>
      </section>
    </div>
  `,
  styles: `
    .auth {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      align-items: center;
      gap: 2rem;
      padding: 2rem;
      background: linear-gradient(135deg, #eaf6f1 0%, #eef4f8 55%, #e3eef5 100%);
    }

    .hero {
      max-width: 460px;
      margin-left: auto;
      padding: 1rem;
    }

    .hero .logo {
      width: min(340px, 100%);
      height: auto;
      display: block;
      margin-bottom: 1.2rem;
    }

    .hero p {
      color: var(--muted);
      font-size: 1.05rem;
    }

    .hero ul {
      list-style: none;
      padding: 0;
      margin-top: 1.4rem;
      display: grid;
      gap: 0.6rem;
      color: var(--ink);
      font-weight: 500;
    }

    .form {
      width: min(400px, 100%);
      padding: 2rem;
      box-shadow: var(--shadow-lg);
    }

    .foot,
    .demo {
      text-align: center;
      font-size: 0.85rem;
      margin: 0.9rem 0 0;
    }

    .geo {
      font-size: 0.78rem;
      text-align: center;
      margin: 0.9rem 0 0;
      line-height: 1.4;
    }

    .demo {
      color: var(--muted);
      margin-top: 0.3rem;
    }

    @media (max-width: 900px) {
      .auth {
        grid-template-columns: 1fr;
      }

      .hero {
        margin: 0 auto;
        text-align: center;
      }
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = 'mariajose@placard.ec';
  password = 'placard123';
  readonly loading = signal(false);
  readonly error = signal('');

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () =>
        // Se espera la ubicacion para que la primera baraja ya salga ordenada por cercania.
        this.auth.syncLocation().subscribe(() => this.router.navigate(['/descubrir'])),
      error: (err) => {
        this.error.set(err?.error?.error ?? 'No se pudo iniciar sesión');
        this.loading.set(false);
      },
    });
  }
}
