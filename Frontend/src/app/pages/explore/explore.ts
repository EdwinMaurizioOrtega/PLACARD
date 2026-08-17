import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { CONDITIONS, Category, Garment, MODES, SIZES } from '../../core/models';

@Component({
  selector: 'app-explore',
  imports: [CurrencyPipe, DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Explorar</h1>
          <p class="subtitle">Catálogo completo de prendas publicadas en la comunidad.</p>
        </div>
      </div>

      <div class="card filters">
        <input
          class="search"
          [(ngModel)]="filters.q"
          (keyup.enter)="search()"
          placeholder="Buscar por título, descripción o marca…"
        />
        <select [(ngModel)]="filters.category_id" (ngModelChange)="search()">
          <option value="">Categoría</option>
          @for (cat of categories(); track cat.id) {
            <option [value]="cat.id">{{ cat.name }}</option>
          }
        </select>
        <select [(ngModel)]="filters.size" (ngModelChange)="search()">
          <option value="">Talla</option>
          @for (size of sizes; track size) {
            <option [value]="size">{{ size }}</option>
          }
        </select>
        <select [(ngModel)]="filters.condition" (ngModelChange)="search()">
          <option value="">Estado</option>
          @for (cond of conditions; track cond.value) {
            <option [value]="cond.value">{{ cond.label }}</option>
          }
        </select>
        <select [(ngModel)]="filters.mode" (ngModelChange)="search()">
          <option value="">Modalidad</option>
          @for (mode of modes; track mode.value) {
            <option [value]="mode.value">{{ mode.label }}</option>
          }
        </select>
        <input type="number" min="0" [(ngModel)]="filters.max_price" (change)="search()" placeholder="Precio máx." />
        <button class="btn btn-ghost btn-sm" (click)="reset()">Limpiar</button>
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (items().length === 0) {
        <div class="empty card">
          <span class="big">🔍</span>
          <h3>Sin resultados</h3>
          <p>Prueba con otros filtros o amplía tu búsqueda.</p>
        </div>
      } @else {
        <p class="muted count">{{ total() }} prendas encontradas</p>
        <div class="grid">
          @for (garment of items(); track garment.id) {
            <article class="card item">
              <img class="thumb" [src]="garment.images[0]?.url" [alt]="garment.title" />
              <div class="body">
                <div class="row between">
                  <h3>{{ garment.title }}</h3>
                  <strong>{{ garment.price ? (garment.price | currency: 'USD') : 'Intercambio' }}</strong>
                </div>
                <div class="row">
                  <span class="chip chip-muted">Talla {{ garment.size }}</span>
                  <span class="chip chip-muted">{{ conditionLabel(garment.condition) }}</span>
                  <span class="chip">{{ modeLabel(garment.mode) }}</span>
                </div>
                <a class="owner" [routerLink]="['/usuarios', garment.owner_id]">
                  <img class="avatar" [src]="garment.owner_avatar_url" alt="" />
                  <span>
                    <strong>{{ garment.owner_full_name }}</strong><br />
                    <small class="muted">⭐ {{ garment.owner_rating | number: '1.1-1' }}</small>
                  </span>
                </a>
              </div>
            </article>
          }
        </div>

        <div class="row pager">
          <button class="btn btn-ghost btn-sm" [disabled]="page() === 1" (click)="go(page() - 1)">
            ← Anterior
          </button>
          <span class="muted">Página {{ page() }} de {{ totalPages() }}</span>
          <button
            class="btn btn-ghost btn-sm"
            [disabled]="page() >= totalPages()"
            (click)="go(page() + 1)"
          >
            Siguiente →
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .filters {
      display: grid;
      grid-template-columns: 2fr repeat(4, 1fr) 0.8fr auto;
      gap: 0.6rem;
      align-items: center;
      margin-bottom: 1.2rem;
    }

    @media (max-width: 900px) {
      .filters {
        grid-template-columns: repeat(2, 1fr);
      }

      .search {
        grid-column: 1 / -1;
      }
    }

    .count {
      margin: 0 0 0.8rem;
      font-size: 0.88rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }

    .item {
      padding: 0;
      overflow: hidden;
    }

    .thumb {
      width: 100%;
      height: 240px;
      object-fit: cover;
      background: #f1eaf3;
    }

    .body {
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    h3 {
      margin: 0;
      font-size: 1rem;
    }

    .row.between {
      justify-content: space-between;
      align-items: baseline;
    }

    .owner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--ink);
      font-size: 0.85rem;
      border-top: 1px solid var(--line);
      padding-top: 0.6rem;
    }

    .owner:hover {
      text-decoration: none;
    }

    .avatar {
      width: 32px;
      height: 32px;
    }

    .pager {
      justify-content: center;
      margin-top: 1.5rem;
    }
  `,
})
export class ExplorePage implements OnInit {
  private readonly api = inject(ApiService);

  readonly categories = signal<Category[]>([]);
  readonly items = signal<Garment[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);

  readonly sizes = SIZES;
  readonly conditions = CONDITIONS;
  readonly modes = MODES;

  filters = {
    q: '',
    category_id: '',
    size: '',
    condition: '',
    mode: '',
    max_price: null as number | null,
  };

  ngOnInit() {
    this.api.listCategories().subscribe((cats) => this.categories.set(cats));
    this.load();
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.total() / 12));
  }

  search() {
    this.page.set(1);
    this.load();
  }

  go(page: number) {
    this.page.set(page);
    this.load();
  }

  reset() {
    this.filters = { q: '', category_id: '', size: '', condition: '', mode: '', max_price: null };
    this.search();
  }

  private load() {
    this.loading.set(true);
    this.api
      .listGarments({
        ...this.filters,
        status: 'disponible',
        page: this.page(),
        per_page: 12,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  modeLabel(mode: string): string {
    return this.modes.find((m) => m.value === mode)?.label ?? mode;
  }

  conditionLabel(condition: string): string {
    return this.conditions.find((c) => c.value === condition)?.label ?? condition;
  }
}
