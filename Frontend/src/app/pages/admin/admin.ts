import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { Category, REPORT_REASONS, Report, Stats, User } from '../../core/models';

@Component({
  selector: 'app-admin',
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Panel administrativo</h1>
          <p class="subtitle">Indicadores de la plataforma y gestión del catálogo.</p>
        </div>
      </div>

      @if (stats(); as data) {
        <div class="metrics">
          <div class="card metric">
            <span class="value">{{ data.overview.total_users }}</span><span class="muted">Usuarios</span>
          </div>
          <div class="card metric">
            <span class="value">{{ data.overview.total_garments }}</span
            ><span class="muted">Prendas</span>
          </div>
          <div class="card metric">
            <span class="value">{{ data.overview.available_garments }}</span
            ><span class="muted">Disponibles</span>
          </div>
          <div class="card metric">
            <span class="value">{{ data.overview.total_swipes }}</span><span class="muted">Swipes</span>
          </div>
          <div class="card metric">
            <span class="value">{{ data.overview.total_matches }}</span
            ><span class="muted">Matches</span>
          </div>
          <div class="card metric">
            <span class="value">{{ data.overview.total_messages }}</span
            ><span class="muted">Mensajes</span>
          </div>
          <div class="card metric" [class.alerted]="data.overview.pending_reports > 0">
            <span class="value">{{ data.overview.pending_reports }}</span
            ><span class="muted">Reportes pendientes</span>
          </div>
        </div>

        <section class="card">
          <h2>Prendas por categoría</h2>
          @for (row of data.by_category; track row.category) {
            <div class="bar-row">
              <span class="label">{{ row.category }}</span>
              <div class="bar">
                <div class="fill" [style.width.%]="percent(row.total, data.by_category)"></div>
              </div>
              <span class="value-sm">{{ row.total }}</span>
            </div>
          }
        </section>
      }

      <section class="card">
        <div class="row between">
          <h2>Cola de moderación</h2>
          <select class="filter" [(ngModel)]="reportStatus" (ngModelChange)="loadReports()">
            <option value="pendiente">Pendientes</option>
            <option value="revisado">Revisados</option>
            <option value="descartado">Descartados</option>
            <option value="">Todos</option>
          </select>
        </div>

        @if (reports().length === 0) {
          <p class="muted">No hay reportes en esta bandeja.</p>
        } @else {
          <div class="stack">
            @for (report of reports(); track report.id) {
              <div class="report">
                <div class="row between">
                  <strong>{{ reasonLabel(report.reason) }}</strong>
                  <small class="muted">{{ report.created_at | date: 'dd/MM/yyyy HH:mm' }}</small>
                </div>
                <p class="muted target">
                  Reportado por &#64;{{ report.reporter_username }}
                  @if (report.target_username) {
                    · usuario &#64;{{ report.target_username }}
                  }
                  @if (report.target_garment_title) {
                    · prenda “{{ report.target_garment_title }}”
                  }
                </p>
                @if (report.details) {
                  <p class="details">{{ report.details }}</p>
                }
                <div class="row">
                  <span class="chip" [class.chip-warn]="report.status === 'pendiente'">
                    {{ report.status }}
                  </span>
                  @if (report.target_garment_id) {
                    <button
                      class="btn btn-danger btn-sm"
                      (click)="hideGarment(report.target_garment_id!)"
                    >
                      Ocultar prenda
                    </button>
                  }
                  @if (report.target_user_id) {
                    <button
                      class="btn btn-danger btn-sm"
                      (click)="suspend(report.target_user_id!)"
                    >
                      Suspender cuenta
                    </button>
                  }
                  @if (report.status === 'pendiente') {
                    <button class="btn btn-accent btn-sm" (click)="resolve(report, 'revisado')">
                      Marcar revisado
                    </button>
                    <button class="btn btn-ghost btn-sm" (click)="resolve(report, 'descartado')">
                      Descartar
                    </button>
                  } @else if (report.resolution) {
                    <small class="muted">{{ report.resolution }}</small>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      <div class="cols">
        <section class="card">
          <h2>Categorías</h2>
          @if (error()) {
            <div class="alert alert-error">{{ error() }}</div>
          }
          <form class="row form" (ngSubmit)="saveCategory()">
            <input name="name" [(ngModel)]="categoryForm.name" placeholder="Nombre" required />
            <input name="icon" [(ngModel)]="categoryForm.icon" placeholder="Icono" class="icon" />
            <button class="btn btn-primary btn-sm" type="submit">
              {{ editingId() ? 'Actualizar' : 'Crear' }}
            </button>
            @if (editingId()) {
              <button class="btn btn-ghost btn-sm" type="button" (click)="cancelEdit()">
                Cancelar
              </button>
            }
          </form>

          <div class="stack">
            @for (cat of categories(); track cat.id) {
              <div class="row item">
                <span>{{ cat.icon }} {{ cat.name }}</span>
                <small class="muted">/{{ cat.slug }}</small>
                <span class="spacer"></span>
                <button class="btn btn-ghost btn-sm" (click)="startEdit(cat)">Editar</button>
                <button class="btn btn-danger btn-sm" (click)="removeCategory(cat)">Eliminar</button>
              </div>
            }
          </div>
        </section>

        <section class="card">
          <h2>Usuarios</h2>
          <input
            [(ngModel)]="userQuery"
            (keyup.enter)="loadUsers()"
            placeholder="Buscar por nombre o usuario…"
          />
          <div class="stack users">
            @for (user of users(); track user.id) {
              <a class="row item" [routerLink]="['/usuarios', user.id]">
                <img class="avatar" [src]="user.avatar_url" alt="" />
                <span>
                  <strong>{{ user.full_name }}</strong><br />
                  <small class="muted">&#64;{{ user.username }} · {{ user.city }}</small>
                </span>
                <span class="spacer"></span>
                <span class="chip chip-muted">⭐ {{ user.rating_avg }}</span>
                @if (user.role === 'admin') {
                  <span class="chip">admin</span>
                }
                @if (!user.is_active) {
                  <span class="chip chip-warn">suspendido</span>
                }
                <button
                  class="btn btn-ghost btn-sm"
                  (click)="toggleActive(user); $event.preventDefault(); $event.stopPropagation()"
                >
                  {{ user.is_active ? 'Suspender' : 'Reactivar' }}
                </button>
              </a>
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.8rem;
      margin-bottom: 1.2rem;
    }

    .metric {
      text-align: center;
      padding: 1rem;
    }

    .metric .value {
      display: block;
      font-size: 1.7rem;
      font-weight: 800;
      color: var(--brand);
    }

    .metric.alerted {
      border-color: var(--danger);
    }

    .row.between {
      justify-content: space-between;
      width: 100%;
    }

    .filter {
      width: auto;
      padding: 0.35rem 0.6rem;
      font-size: 0.85rem;
    }

    .report {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 0.85rem;
    }

    .report .target {
      margin: 0.2rem 0;
      font-size: 0.85rem;
    }

    .report .details {
      margin: 0.2rem 0 0.6rem;
      font-size: 0.9rem;
    }

    .card {
      margin-bottom: 1.2rem;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 150px 1fr 40px;
      align-items: center;
      gap: 0.7rem;
      margin-bottom: 0.45rem;
      font-size: 0.88rem;
    }

    .bar {
      height: 10px;
      background: var(--line);
      border-radius: 999px;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      background: linear-gradient(90deg, var(--brand), #ff9ec0);
    }

    .value-sm {
      text-align: right;
      font-weight: 600;
    }

    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 1.2rem;
      align-items: start;
    }

    .form {
      margin-bottom: 1rem;
      flex-wrap: nowrap;
    }

    .form .icon {
      max-width: 80px;
    }

    .item {
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.5rem;
      color: var(--ink);
    }

    .item:hover {
      text-decoration: none;
    }

    .spacer {
      flex: 1;
    }

    .users {
      max-height: 420px;
      overflow-y: auto;
      margin-top: 0.8rem;
    }
  `,
})
export class AdminPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly stats = signal<Stats | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly users = signal<User[]>([]);
  readonly reports = signal<Report[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly error = signal('');

  categoryForm = { name: '', icon: '' };
  userQuery = '';
  reportStatus = 'pendiente';

  ngOnInit() {
    this.loadStats();
    this.loadCategories();
    this.loadUsers();
    this.loadReports();
  }

  private loadStats() {
    this.api.stats().subscribe((data) => this.stats.set(data));
  }

  loadReports() {
    this.api.listReports(this.reportStatus).subscribe((items) => this.reports.set(items));
  }

  reasonLabel(reason: string): string {
    return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  }

  resolve(report: Report, status: string) {
    this.api.resolveReport(report.id, status).subscribe(() => {
      this.loadReports();
      this.loadStats();
    });
  }

  hideGarment(garmentId: string) {
    if (!confirm('¿Ocultar esta prenda del catálogo?')) return;
    this.api.moderateGarment(garmentId, true).subscribe({
      next: () => this.loadStats(),
      error: (err) => this.error.set(err?.error?.error ?? 'No se pudo ocultar la prenda'),
    });
  }

  suspend(userId: string) {
    if (!confirm('¿Suspender esta cuenta? No podrá iniciar sesión.')) return;
    this.api.setUserActive(userId, false).subscribe(() => this.loadUsers());
  }

  toggleActive(user: User) {
    this.api.setUserActive(user.id, !user.is_active).subscribe(() => this.loadUsers());
  }

  percent(total: number, rows: { total: number }[]): number {
    const max = Math.max(...rows.map((r) => r.total), 1);
    return (total / max) * 100;
  }

  loadCategories() {
    this.api.listCategories().subscribe((items) => this.categories.set(items));
  }

  loadUsers() {
    this.api.listUsers({ q: this.userQuery, per_page: 50 }).subscribe((res) => this.users.set(res.items));
  }

  startEdit(category: Category) {
    this.editingId.set(category.id);
    this.categoryForm = { name: category.name, icon: category.icon ?? '' };
  }

  cancelEdit() {
    this.editingId.set(null);
    this.categoryForm = { name: '', icon: '' };
  }

  saveCategory() {
    if (!this.categoryForm.name.trim()) return;
    this.error.set('');
    const id = this.editingId();
    const request = id
      ? this.api.updateCategory(id, this.categoryForm)
      : this.api.createCategory(this.categoryForm);

    request.subscribe({
      next: () => {
        this.cancelEdit();
        this.loadCategories();
      },
      error: (err) => this.error.set(err?.error?.error ?? 'No se pudo guardar la categoría'),
    });
  }

  removeCategory(category: Category) {
    if (!confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    this.api.deleteCategory(category.id).subscribe({
      next: () => this.loadCategories(),
      error: (err) => this.error.set(err?.error?.error ?? 'No se pudo eliminar la categoría'),
    });
  }
}
