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
        <span class="brand-mark">P</span>
        <h1>PLACARD</h1>
        <p>
          Moda circular en Cuenca. Desliza, haz match e intercambia las prendas que ya no usas.
        </p>
        <ul>
          <li>👗 Descubre prendas cercanas con un swipe</li>
          <li>🤝 Haz match cuando el interés es mutuo</li>
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
      background: linear-gradient(135deg, #fff1f6 0%, #f6f2ff 55%, #e9fbf8 100%);
    }

    .hero {
      max-width: 460px;
      margin-left: auto;
      padding: 1rem;
    }

    .hero h1 {
      font-size: 2.8rem;
      letter-spacing: 0.16em;
      margin: 0.6rem 0;
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

    .brand-mark {
      display: grid;
      place-items: center;
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--brand), #ff8fb4);
      color: #fff;
      font-size: 1.6rem;
      font-weight: 800;
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
      next: () => this.router.navigate(['/descubrir']),
      error: (err) => {
        this.error.set(err?.error?.error ?? 'No se pudo iniciar sesión');
        this.loading.set(false);
      },
    });
  }
}
