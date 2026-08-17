import { Component, OnInit, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';

import { ApiService } from '../../core/api.service';
import { Garment, Review, User } from '../../core/models';
import { ReportDialog } from '../../shared/report-dialog';

@Component({
  selector: 'app-user-detail',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ReportDialog],
  template: `
    <div class="page narrow">
      @if (user(); as profile) {
        <section class="card head">
          <img class="avatar big" [src]="profile.avatar_url" alt="" />
          <div>
            <h1>{{ profile.full_name }}</h1>
            <p class="muted">
              &#64;{{ profile.username }} · {{ profile.neighborhood ?? profile.city }} · ⭐
              {{ profile.rating_avg | number: '1.1-1' }} ({{ profile.rating_count }})
            </p>
            <p>{{ profile.bio }}</p>
            <div class="row">
              @for (size of profile.preferred_sizes; track size) {
                <span class="chip chip-muted">Talla {{ size }}</span>
              }
              @for (style of profile.preferred_styles; track style) {
                <span class="chip">{{ style }}</span>
              }
            </div>
            <div class="row actions">
              <button class="btn btn-ghost btn-sm" (click)="reporting.set(true)">
                ⚑ Reportar usuario
              </button>
              @if (blocked()) {
                <button class="btn btn-ghost btn-sm" (click)="unblock(profile)">
                  Desbloquear
                </button>
                <span class="chip chip-warn">Usuario bloqueado</span>
              } @else {
                <button class="btn btn-danger btn-sm" (click)="block(profile)">Bloquear</button>
              }
            </div>
          </div>
        </section>

        <h2>Clóset de &#64;{{ profile.username }}</h2>
        @if (garments().length === 0) {
          <p class="muted">Este usuario aún no tiene prendas publicadas.</p>
        } @else {
          <div class="grid">
            @for (garment of garments(); track garment.id) {
              <article class="card item">
                <img class="thumb" [src]="garment.images[0]?.url" [alt]="garment.title" />
                <div class="body">
                  <strong>{{ garment.title }}</strong>
                  <span class="muted">
                    Talla {{ garment.size }} ·
                    {{ garment.price ? (garment.price | currency: 'USD') : 'Intercambio' }}
                  </span>
                </div>
              </article>
            }
          </div>
        }

        <h2>Reputación</h2>
        @if (reviews().length === 0) {
          <p class="muted">Sin calificaciones todavía.</p>
        } @else {
          <div class="stack">
            @for (review of reviews(); track review.id) {
              <div class="card review">
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
      } @else {
        <div class="spinner"></div>
      }

      @if (reporting()) {
        <app-report-dialog
          [userId]="id()"
          [label]="'a ' + (user()?.full_name ?? 'este usuario')"
          (closed)="reporting.set(false)"
        />
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 900px;
    }

    .head {
      display: flex;
      gap: 1.2rem;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }

    .avatar.big {
      width: 96px;
      height: 96px;
    }

    .actions {
      margin-top: 0.8rem;
    }

    h2 {
      margin: 1.4rem 0 0.8rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.9rem;
    }

    .item {
      padding: 0;
      overflow: hidden;
    }

    .thumb {
      width: 100%;
      height: 200px;
      object-fit: cover;
      background: #f1eaf3;
    }

    .body {
      padding: 0.7rem 0.9rem;
      display: flex;
      flex-direction: column;
      font-size: 0.9rem;
    }

    .review {
      display: flex;
      gap: 0.7rem;
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
export class UserDetailPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly id = input.required<string>();
  readonly user = signal<User | null>(null);
  readonly garments = signal<Garment[]>([]);
  readonly reviews = signal<Review[]>([]);
  readonly reporting = signal(false);
  readonly blocked = signal(false);

  ngOnInit() {
    this.api.getUser(this.id()).subscribe((user) => this.user.set(user));
    this.api
      .listGarments({ owner_id: this.id(), status: 'disponible', per_page: 24 })
      .subscribe((res) => this.garments.set(res.items));
    this.api.reviewsForUser(this.id()).subscribe((items) => this.reviews.set(items));
    this.api
      .listBlocks()
      .subscribe((items) => this.blocked.set(items.some((b) => b.blocked_id === this.id())));
  }

  block(profile: User) {
    if (!confirm(`¿Bloquear a ${profile.full_name}? Se eliminará el match y dejarán de verse.`)) {
      return;
    }
    this.api.blockUser(profile.id).subscribe(() => this.blocked.set(true));
  }

  unblock(profile: User) {
    this.api.unblockUser(profile.id).subscribe(() => this.blocked.set(false));
  }
}
