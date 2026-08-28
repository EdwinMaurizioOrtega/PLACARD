import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Panel administrativo</h1>
          <p class="subtitle">Indicadores, reportería y gestión de la plataforma.</p>
        </div>
      </div>

      <nav class="modules">
        @for (item of modules; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="on">
            <span class="icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>

      <router-outlet />
    </div>
  `,
  styles: `
    .modules {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 1.3rem;
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.9rem;
    }

    .modules a {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 1rem;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--muted);
      font-weight: 600;
      font-size: 0.87rem;
    }

    .modules a:hover {
      text-decoration: none;
      border-color: var(--brand);
      color: var(--brand-dark);
    }

    .modules a.on {
      background: var(--ink);
      border-color: var(--ink);
      color: #fff;
    }

    .icon {
      font-size: 1rem;
    }
  `,
})
export class AdminPage {
  protected readonly modules = [
    { path: 'resumen', label: 'Resumen', icon: '📊' },
    { path: 'reporteria', label: 'Reportería', icon: '📈' },
    { path: 'moderacion', label: 'Moderación', icon: '🛡️' },
    { path: 'catalogo', label: 'Catálogo', icon: '🏷️' },
    { path: 'usuarios', label: 'Usuarios', icon: '👥' },
  ];
}
