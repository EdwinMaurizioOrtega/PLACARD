import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { LikeReceived, MatchInfo } from '../../core/models';

@Component({
  selector: 'app-matches',
  imports: [DatePipe, RouterLink],
  template: `
    <div class="page narrow">
      <div class="page-head">
        <div>
          <h1>Matches</h1>
          <p class="subtitle">Conversaciones activas y personas interesadas en tus prendas.</p>
        </div>
        <div class="tabs">
          <button class="tab" [class.on]="tab() === 'matches'" (click)="tab.set('matches')">
            Matches ({{ matches().length }})
          </button>
          <button class="tab" [class.on]="tab() === 'likes'" (click)="tab.set('likes')">
            Me gustan tus prendas ({{ likes().length }})
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (tab() === 'matches') {
        @if (matches().length === 0) {
          <div class="empty card">
            <span class="big">💞</span>
            <h3>Todavía no tienes matches</h3>
            <p>Sigue deslizando en Descubrir: el match ocurre cuando el interés es mutuo.</p>
            <a class="btn btn-primary" routerLink="/descubrir">Ir a descubrir</a>
          </div>
        } @else {
          <div class="stack">
            @for (match of matches(); track match.id) {
              <a class="card match" [routerLink]="['/matches', match.id]">
                <img class="avatar big" [src]="match.other_avatar_url" alt="" />
                <div class="info">
                  <div class="row between">
                    <strong>{{ match.other_full_name }}</strong>
                    <small class="muted">{{ match.created_at | date: 'dd/MM/yyyy' }}</small>
                  </div>
                  <p class="last muted">
                    {{ match.last_message ?? 'Escriban el primer mensaje para coordinar.' }}
                  </p>
                  <div class="row">
                    <span class="chip chip-muted">&#64;{{ match.other_username }}</span>
                    <span class="chip" [class.chip-accent]="match.status === 'activo'">
                      {{ match.status }}
                    </span>
                  </div>
                </div>
                @if (match.unread_count > 0) {
                  <span class="badge">{{ match.unread_count }}</span>
                }
              </a>
            }
          </div>
        }
      } @else {
        @if (likes().length === 0) {
          <div class="empty card">
            <span class="big">👀</span>
            <h3>Aún nadie ha marcado tus prendas</h3>
            <p>Publica más prendas y agrega buenas fotografías para llamar la atención.</p>
          </div>
        } @else {
          <div class="stack">
            @for (like of likes(); track like.swipe_id) {
              <div class="card match">
                <img class="avatar big" [src]="like.avatar_url" alt="" />
                <div class="info">
                  <strong>{{ like.full_name }}</strong>
                  <p class="last muted">
                    Le gustó tu prenda <strong>{{ like.garment_title }}</strong>
                  </p>
                  <div class="row">
                    <span class="chip chip-muted">{{ like.created_at | date: 'dd/MM/yyyy' }}</span>
                    @if (like.direction === 'super') {
                      <span class="chip chip-warn">★ Super like</span>
                    }
                  </div>
                </div>
                <a class="btn btn-ghost btn-sm" [routerLink]="['/usuarios', like.user_id]">
                  Ver perfil
                </a>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 760px;
    }

    .tabs {
      display: flex;
      gap: 0.35rem;
    }

    .tab {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 0.45rem 1rem;
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
    }

    .tab.on {
      background: var(--ink);
      border-color: var(--ink);
      color: #fff;
    }

    .match {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      color: var(--ink);
      position: relative;
    }

    .match:hover {
      text-decoration: none;
      box-shadow: var(--shadow-lg);
    }

    .avatar.big {
      width: 56px;
      height: 56px;
    }

    .info {
      flex: 1;
      min-width: 0;
    }

    .row.between {
      justify-content: space-between;
    }

    .last {
      margin: 0.2rem 0 0.4rem;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge {
      background: var(--brand);
      color: #fff;
      border-radius: 999px;
      min-width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0 0.4rem;
    }
  `,
})
export class MatchesPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly matches = signal<MatchInfo[]>([]);
  readonly likes = signal<LikeReceived[]>([]);
  readonly loading = signal(true);
  readonly tab = signal<'matches' | 'likes'>('matches');

  ngOnInit() {
    this.api.listMatches().subscribe({
      next: (items) => {
        this.matches.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.likesReceived().subscribe((items) => this.likes.set(items));
  }
}
