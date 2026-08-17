import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MatchDetail, Message } from '../../core/models';

@Component({
  selector: 'app-chat',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  template: `
    <div class="page narrow">
      @if (match(); as detail) {
        <div class="page-head">
          <a class="row who" [routerLink]="['/usuarios', detail.other_user_id]">
            <img class="avatar big" [src]="detail.other_avatar_url" alt="" />
            <span>
              <strong>{{ detail.other_full_name }}</strong><br />
              <small class="muted">&#64;{{ detail.other_username }} · ⭐ {{ detail.other_rating }}</small>
            </span>
          </a>
          <div class="row">
            @if (detail.status === 'activo') {
              <button class="btn btn-accent btn-sm" (click)="close('cerrado')">
                Marcar intercambio realizado
              </button>
              <button class="btn btn-ghost btn-sm" (click)="close('cancelado')">Cancelar</button>
            } @else {
              <span class="chip chip-muted">Match {{ detail.status }}</span>
            }
            <a class="btn btn-ghost btn-sm" routerLink="/matches">Volver</a>
          </div>
        </div>

        <div class="garments card">
          <h3>Prendas del match</h3>
          <div class="row">
            @for (garment of detail.garments; track garment.id) {
              <div class="mini">
                <img [src]="garment.images[0]?.url" [alt]="garment.title" />
                <div>
                  <strong>{{ garment.title }}</strong>
                  <small class="muted">
                    de &#64;{{ garment.owner_username }} ·
                    {{ garment.price ? (garment.price | currency: 'USD') : 'Intercambio' }}
                  </small>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="card chat">
          <div class="messages">
            @for (message of messages(); track message.id) {
              <div class="bubble" [class.own]="message.sender_id === myId">
                <p>{{ message.body }}</p>
                <div class="meta">
                  <small>{{ message.created_at | date: 'dd/MM HH:mm' }}</small>
                  @if (message.sender_id === myId) {
                    <button type="button" (click)="edit(message)">editar</button>
                    <button type="button" (click)="remove(message)">borrar</button>
                  }
                </div>
              </div>
            } @empty {
              <p class="empty muted">Aún no hay mensajes. Propón un punto de encuentro seguro.</p>
            }
          </div>

          <form class="composer" (ngSubmit)="send()">
            <input
              name="body"
              [(ngModel)]="draft"
              placeholder="Escribe un mensaje…"
              autocomplete="off"
            />
            <button class="btn btn-primary" type="submit" [disabled]="!draft.trim()">Enviar</button>
          </form>
        </div>

        <div class="card review">
          <h3>Calificar a {{ detail.other_full_name }}</h3>
          <p class="muted">La reputación ayuda a que la comunidad confíe en los intercambios.</p>
          @if (reviewMessage()) {
            <div class="alert alert-ok">{{ reviewMessage() }}</div>
          }
          <div class="row">
            <div class="stars">
              @for (star of [1, 2, 3, 4, 5]; track star) {
                <button
                  type="button"
                  class="star"
                  [class.on]="star <= rating()"
                  (click)="rating.set(star)"
                  [attr.aria-label]="star + ' estrellas'"
                >
                  ★
                </button>
              }
            </div>
            <input [(ngModel)]="reviewComment" name="comment" placeholder="Comentario (opcional)" />
            <button class="btn btn-accent" (click)="sendReview(detail)">Enviar</button>
          </div>
        </div>
      } @else {
        <div class="spinner"></div>
      }
    </div>
  `,
  styles: `
    .narrow {
      max-width: 760px;
    }

    .who {
      color: var(--ink);
    }

    .who:hover {
      text-decoration: none;
    }

    .avatar.big {
      width: 52px;
      height: 52px;
    }

    .garments {
      margin-bottom: 1rem;
    }

    .mini {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .mini img {
      width: 54px;
      height: 68px;
      object-fit: cover;
      border-radius: 10px;
      background: #f1eaf3;
    }

    .mini small {
      display: block;
    }

    .chat {
      padding: 0;
      overflow: hidden;
      margin-bottom: 1rem;
    }

    .messages {
      height: 380px;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      background: #fbf9fc;
    }

    .bubble {
      max-width: 72%;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 14px 14px 14px 4px;
      padding: 0.55rem 0.8rem;
    }

    .bubble.own {
      align-self: flex-end;
      background: linear-gradient(135deg, var(--brand), #ff86ae);
      border-color: transparent;
      color: #fff;
      border-radius: 14px 14px 4px 14px;
    }

    .bubble p {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .meta {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.25rem;
      opacity: 0.75;
      font-size: 0.72rem;
    }

    .meta button {
      background: none;
      border: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }

    .composer {
      display: flex;
      gap: 0.6rem;
      padding: 0.8rem;
      border-top: 1px solid var(--line);
      background: #fff;
    }

    .stars {
      display: flex;
    }

    .star {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--line);
      cursor: pointer;
      padding: 0 0.1rem;
    }

    .star.on {
      color: #f5a524;
    }

    .review .row {
      flex-wrap: nowrap;
    }

    @media (max-width: 620px) {
      .review .row {
        flex-wrap: wrap;
      }
    }
  `,
})
export class ChatPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly match = signal<MatchDetail | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly rating = signal(5);
  readonly reviewMessage = signal('');

  draft = '';
  reviewComment = '';
  readonly myId = this.auth.user()?.id ?? '';

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.api.getMatch(this.id()).subscribe((detail) => this.match.set(detail));
    this.loadMessages();
    this.timer = setInterval(() => this.loadMessages(), 5000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  private loadMessages() {
    this.api.listMessages(this.id()).subscribe((items) => {
      this.messages.set(items);
      this.api.markRead(this.id()).subscribe();
    });
  }

  send() {
    const body = this.draft.trim();
    if (!body) return;
    this.draft = '';
    this.api.sendMessage(this.id(), body).subscribe((message) => {
      this.messages.update((list) => [...list, message]);
    });
  }

  edit(message: Message) {
    const body = prompt('Editar mensaje', message.body);
    if (!body?.trim()) return;
    this.api.editMessage(message.id, body.trim()).subscribe((updated) => {
      this.messages.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
    });
  }

  remove(message: Message) {
    if (!confirm('¿Eliminar este mensaje?')) return;
    this.api.deleteMessage(message.id).subscribe(() => {
      this.messages.update((list) => list.filter((m) => m.id !== message.id));
    });
  }

  close(status: string) {
    this.api.updateMatchStatus(this.id(), status).subscribe((info) => {
      this.match.update((current) => (current ? { ...current, status: info.status } : current));
    });
  }

  sendReview(detail: MatchDetail) {
    this.api
      .createReview({
        match_id: detail.id,
        reviewee_id: detail.other_user_id,
        rating: this.rating(),
        comment: this.reviewComment || null,
      })
      .subscribe({
        next: () => {
          this.reviewMessage.set('¡Gracias! Tu calificación fue registrada.');
          this.reviewComment = '';
        },
        error: (err) =>
          this.reviewMessage.set(err?.error?.error ?? 'Ya calificaste este intercambio.'),
      });
  }
}
