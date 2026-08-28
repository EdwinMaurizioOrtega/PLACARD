import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { Garment, STATUSES } from '../../core/models';

@Component({
  selector: 'app-closet',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Mi clóset</h1>
          <p class="subtitle">Administra las prendas que pusiste a circular.</p>
        </div>
        <a class="btn btn-primary" routerLink="/closet/nueva">+ Publicar prenda</a>
      </div>

      @if (message()) {
        <div class="alert alert-ok">{{ message() }}</div>
      }

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (garments().length === 0) {
        <div class="empty card">
          <span class="big">👚</span>
          <h3>Tu clóset está vacío</h3>
          <p>Publica esa prenda que casi no usas y dale una segunda vida.</p>
          <a class="btn btn-primary" routerLink="/closet/nueva">Publicar mi primera prenda</a>
        </div>
      } @else {
        <div class="grid">
          @for (garment of garments(); track garment.id) {
            <article class="card item">
              <img class="thumb" [src]="garment.images[0]?.url" [alt]="garment.title" />
              <div class="body">
                <div class="row between">
                  <h3>{{ garment.title }}</h3>
                  <strong>{{ garment.price ? (garment.price | currency: 'USD') : '—' }}</strong>
                </div>
                <div class="row">
                  <span class="chip chip-muted">Talla {{ garment.size }}</span>
                  <span class="chip chip-muted">{{ garment.category_name ?? 'Sin categoría' }}</span>
                  <span class="chip" [class.chip-warn]="garment.status !== 'disponible'">
                    {{ statusLabel(garment.status) }}
                  </span>
                  @if (garment.is_hidden) {
                    <span class="chip chip-warn">Oculta por moderación</span>
                  }
                </div>
                <p class="metrics muted">
                  👁 {{ garment.views }} vistas · ♥ {{ garment.likes_count }} me gusta
                </p>
                <div class="row">
                  <a class="btn btn-ghost btn-sm" [routerLink]="['/closet', garment.id]">Editar</a>
                  <select
                    class="status"
                    [value]="garment.status"
                    (change)="changeStatus(garment, $event)"
                  >
                    @for (status of statuses; track status.value) {
                      <option [value]="status.value">{{ status.label }}</option>
                    }
                  </select>
                  <button class="btn btn-danger btn-sm" (click)="remove(garment)">Eliminar</button>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .item {
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .thumb {
      width: 100%;
      height: 210px;
      object-fit: cover;
      background: #e6eef2;
    }

    .body {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }

    .row.between {
      justify-content: space-between;
      align-items: baseline;
    }

    h3 {
      margin: 0;
      font-size: 1.05rem;
    }

    .metrics {
      margin: 0;
      font-size: 0.82rem;
    }

    .status {
      width: auto;
      padding: 0.35rem 0.6rem;
      font-size: 0.85rem;
      border-radius: 999px;
    }
  `,
})
export class ClosetPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly garments = signal<Garment[]>([]);
  readonly loading = signal(true);
  readonly message = signal('');
  readonly statuses = STATUSES;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.myGarments().subscribe({
      next: (items) => {
        this.garments.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  statusLabel(status: string): string {
    return this.statuses.find((s) => s.value === status)?.label ?? status;
  }

  changeStatus(garment: Garment, event: Event) {
    const status = (event.target as HTMLSelectElement).value;
    this.api.updateGarment(garment.id, { status }).subscribe(() => {
      this.message.set(`"${garment.title}" ahora está en estado ${this.statusLabel(status)}.`);
      this.load();
    });
  }

  remove(garment: Garment) {
    if (!confirm(`¿Eliminar "${garment.title}" de tu clóset?`)) return;
    this.api.deleteGarment(garment.id).subscribe(() => {
      this.message.set(`"${garment.title}" fue eliminada.`);
      this.load();
    });
  }
}
