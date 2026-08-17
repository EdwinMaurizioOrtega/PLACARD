import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Category, Garment, MatchInfo } from '../../core/models';

const SWIPE_THRESHOLD = 110;

@Component({
  selector: 'app-discover',
  imports: [CurrencyPipe, DecimalPipe, FormsModule],
  template: `
    <div class="page discover">
      <div class="page-head">
        <div>
          <h1>Descubrir</h1>
          <p class="subtitle">
            Prendas cercanas a ti, ordenadas por tus tallas, estilos y distancia.
          </p>
        </div>
        <div class="row filters">
          <select [(ngModel)]="mode" (ngModelChange)="reload()" aria-label="Modalidad">
            <option value="">Todas las modalidades</option>
            <option value="intercambio">Solo intercambio</option>
            <option value="venta">Solo venta</option>
          </select>
          <select [(ngModel)]="categoryId" (ngModelChange)="reload()" aria-label="Categoría">
            <option value="">Todas las categorías</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
            }
          </select>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (!current()) {
        <div class="empty card">
          <span class="big">🧺</span>
          <h3>No quedan prendas por revisar</h3>
          <p>Cambia los filtros, amplía tu radio o vuelve más tarde: la comunidad publica a diario.</p>
          <button class="btn btn-primary" (click)="reload()">Recargar baraja</button>
        </div>
      } @else {
        <div class="deck">
          <div class="stack">
            @for (garment of visible(); track garment.id; let i = $index) {
              <article
                class="swipe-card"
                [class.top]="i === 0"
                [style.transform]="cardTransform(i)"
                [style.transition]="i === 0 && dragging() ? 'none' : 'transform .3s ease'"
                [style.zIndex]="10 - i"
                (pointerdown)="i === 0 ? onPointerDown($event) : null"
                (pointermove)="i === 0 ? onPointerMove($event) : null"
                (pointerup)="i === 0 ? onPointerUp() : null"
                (pointercancel)="i === 0 ? onPointerUp() : null"
              >
                <div class="photo">
                  <img [src]="photo(garment)" [alt]="garment.title" draggable="false" />
                  @if (garment.images.length > 1 && i === 0) {
                    <div class="dots">
                      @for (img of garment.images; track img.id; let d = $index) {
                        <button
                          type="button"
                          class="dot"
                          [class.on]="d === photoIndex()"
                          (click)="photoIndex.set(d); $event.stopPropagation()"
                          [attr.aria-label]="'Foto ' + (d + 1)"
                        ></button>
                      }
                    </div>
                  }
                  @if (i === 0) {
                    <span class="stamp like" [style.opacity]="likeOpacity()">ME GUSTA</span>
                    <span class="stamp nope" [style.opacity]="nopeOpacity()">PASO</span>
                  }
                  <div class="badges">
                    <span class="chip">{{ modeLabel(garment.mode) }}</span>
                    @if (garment.distance_km !== null) {
                      <span class="chip chip-accent">
                        {{ garment.distance_km | number: '1.1-1' }} km
                      </span>
                    }
                  </div>
                </div>

                <div class="info">
                  <div class="row between">
                    <h2>{{ garment.title }}</h2>
                    <strong class="price">
                      {{ garment.price ? (garment.price | currency: 'USD') : 'Intercambio' }}
                    </strong>
                  </div>
                  <p class="desc">{{ garment.description }}</p>
                  <div class="row">
                    <span class="chip chip-muted">Talla {{ garment.size }}</span>
                    <span class="chip chip-muted">{{ conditionLabel(garment.condition) }}</span>
                    @if (garment.category_name) {
                      <span class="chip chip-muted">{{ garment.category_name }}</span>
                    }
                    @if (garment.brand) {
                      <span class="chip chip-muted">{{ garment.brand }}</span>
                    }
                  </div>
                  <div class="owner" (click)="openUser(garment.owner_id)">
                    <img class="avatar" [src]="garment.owner_avatar_url" alt="" />
                    <div>
                      <strong>{{ garment.owner_full_name }}</strong>
                      <span class="muted"
                        >&#64;{{ garment.owner_username }} · ⭐
                        {{ garment.owner_rating | number: '1.1-1' }}</span
                      >
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>

          <div class="actions">
            <button class="round pass" (click)="decide('pass')" title="Pasar (←)">✕</button>
            <button class="round super" (click)="decide('super')" title="Super like (↑)">★</button>
            <button class="round like" (click)="decide('like')" title="Me gusta (→)">♥</button>
          </div>
          <p class="hint muted">Arrastra la tarjeta o usa las flechas del teclado ← ↑ →</p>
        </div>
      }

      @if (matched(); as info) {
        <div class="modal-backdrop" (click)="matched.set(null)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <span class="big">🎉</span>
            <h2>¡Es un match!</h2>
            <p>
              A ti y a <strong>{{ info.other_full_name }}</strong> les gustaron sus prendas.
              Coordinen el intercambio por el chat.
            </p>
            <div class="row center">
              <button class="btn btn-ghost" (click)="matched.set(null)">Seguir deslizando</button>
              <button class="btn btn-primary" (click)="goToChat(info)">Abrir chat</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .discover {
      max-width: 720px;
    }

    .filters select {
      width: auto;
      min-width: 180px;
    }

    .deck {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stack {
      position: relative;
      width: min(420px, 100%);
      height: 620px;
    }

    .swipe-card {
      position: absolute;
      inset: 0;
      background: var(--surface);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    .swipe-card.top {
      cursor: grab;
      touch-action: none;
    }

    .photo {
      position: relative;
      height: 62%;
      background: #f1eaf3;
    }

    .photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }

    .badges {
      position: absolute;
      left: 0.9rem;
      bottom: 0.9rem;
      display: flex;
      gap: 0.4rem;
    }

    .badges .chip {
      background: rgba(255, 255, 255, 0.92);
      color: var(--ink);
    }

    .dots {
      position: absolute;
      top: 0.7rem;
      left: 0.7rem;
      right: 0.7rem;
      display: flex;
      gap: 0.3rem;
    }

    .dot {
      flex: 1;
      height: 4px;
      border: none;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.45);
      cursor: pointer;
      padding: 0;
    }

    .dot.on {
      background: #fff;
    }

    .stamp {
      position: absolute;
      top: 1.5rem;
      font-size: 1.4rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      padding: 0.3rem 0.8rem;
      border-radius: 10px;
      border: 4px solid;
      opacity: 0;
      pointer-events: none;
    }

    .stamp.like {
      left: 1.2rem;
      color: var(--accent-dark);
      border-color: var(--accent-dark);
      transform: rotate(-14deg);
    }

    .stamp.nope {
      right: 1.2rem;
      color: var(--danger);
      border-color: var(--danger);
      transform: rotate(14deg);
    }

    .info {
      padding: 1rem 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      overflow: hidden;
    }

    .info h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .row.between {
      justify-content: space-between;
      align-items: baseline;
    }

    .price {
      color: var(--brand);
      white-space: nowrap;
    }

    .desc {
      margin: 0;
      color: var(--muted);
      font-size: 0.9rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .owner {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-top: auto;
      padding-top: 0.5rem;
      border-top: 1px solid var(--line);
      cursor: pointer;
    }

    .owner span {
      display: block;
      font-size: 0.8rem;
    }

    .actions {
      display: flex;
      gap: 1.1rem;
      margin-top: 1.4rem;
    }

    .round {
      width: 62px;
      height: 62px;
      border-radius: 50%;
      border: 1px solid var(--line);
      background: #fff;
      font-size: 1.5rem;
      cursor: pointer;
      box-shadow: var(--shadow);
      transition: transform 0.15s ease;
    }

    .round:hover {
      transform: scale(1.08);
    }

    .round.pass {
      color: var(--danger);
    }

    .round.super {
      color: #f5a524;
      width: 52px;
      height: 52px;
      align-self: center;
    }

    .round.like {
      color: var(--accent-dark);
    }

    .hint {
      font-size: 0.82rem;
      margin-top: 0.9rem;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(36, 28, 38, 0.55);
      display: grid;
      place-items: center;
      z-index: 60;
      padding: 1rem;
    }

    .modal {
      max-width: 400px;
      text-align: center;
      padding: 2rem;
    }

    .modal .big {
      font-size: 3rem;
      display: block;
    }

    .row.center {
      justify-content: center;
      margin-top: 1rem;
    }
  `,
})
export class DiscoverPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cards = signal<Garment[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly matched = signal<MatchInfo | null>(null);
  readonly photoIndex = signal(0);
  readonly dragX = signal(0);
  readonly dragY = signal(0);
  readonly dragging = signal(false);

  mode = '';
  categoryId = '';

  private pointerStart: { x: number; y: number } | null = null;

  readonly current = computed(() => this.cards()[0] ?? null);
  readonly visible = computed(() => this.cards().slice(0, 3));
  readonly likeOpacity = computed(() => Math.min(1, Math.max(0, this.dragX() / SWIPE_THRESHOLD)));
  readonly nopeOpacity = computed(() => Math.min(1, Math.max(0, -this.dragX() / SWIPE_THRESHOLD)));

  ngOnInit() {
    this.api.listCategories().subscribe((cats) => this.categories.set(cats));
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.api.feed({ mode: this.mode, category_id: this.categoryId, limit: 30 }).subscribe({
      next: (items) => {
        this.cards.set(items);
        this.photoIndex.set(0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  photo(garment: Garment): string {
    const index = garment.id === this.current()?.id ? this.photoIndex() : 0;
    return garment.images[index]?.url ?? garment.images[0]?.url ?? '';
  }

  cardTransform(index: number): string {
    if (index === 0) {
      const rotation = this.dragX() / 18;
      return `translate(${this.dragX()}px, ${this.dragY()}px) rotate(${rotation}deg)`;
    }
    return `translateY(${index * 12}px) scale(${1 - index * 0.04})`;
  }

  onPointerDown(event: PointerEvent) {
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.dragging.set(true);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent) {
    if (!this.pointerStart) return;
    this.dragX.set(event.clientX - this.pointerStart.x);
    this.dragY.set(event.clientY - this.pointerStart.y);
  }

  onPointerUp() {
    if (!this.pointerStart) return;
    const dx = this.dragX();
    const dy = this.dragY();
    this.pointerStart = null;
    this.dragging.set(false);

    if (dy < -SWIPE_THRESHOLD && Math.abs(dx) < SWIPE_THRESHOLD) {
      this.decide('super');
    } else if (dx > SWIPE_THRESHOLD) {
      this.decide('like');
    } else if (dx < -SWIPE_THRESHOLD) {
      this.decide('pass');
    } else {
      this.resetDrag();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (this.matched() || !this.current()) return;
    if (event.key === 'ArrowRight') this.decide('like');
    if (event.key === 'ArrowLeft') this.decide('pass');
    if (event.key === 'ArrowUp') this.decide('super');
  }

  decide(direction: 'like' | 'pass' | 'super') {
    const garment = this.current();
    if (!garment) return;

    this.api.swipe(garment.id, direction).subscribe({
      next: (result) => {
        if (result.matched && result.match_info) {
          this.matched.set(result.match_info);
        }
      },
    });

    this.cards.update((cards) => cards.slice(1));
    this.photoIndex.set(0);
    this.resetDrag();

    if (this.cards().length <= 2) {
      this.topUp();
    }
  }

  private topUp() {
    this.api
      .feed({ mode: this.mode, category_id: this.categoryId, limit: 30 })
      .subscribe((items) => {
        const known = new Set(this.cards().map((c) => c.id));
        this.cards.update((cards) => [...cards, ...items.filter((i) => !known.has(i.id))]);
      });
  }

  private resetDrag() {
    this.dragX.set(0);
    this.dragY.set(0);
  }

  goToChat(info: MatchInfo) {
    this.matched.set(null);
    this.router.navigate(['/matches', info.id]);
  }

  openUser(id: string) {
    if (id === this.auth.user()?.id) {
      this.router.navigate(['/perfil']);
    } else {
      this.router.navigate(['/usuarios', id]);
    }
  }

  modeLabel(mode: string): string {
    return { venta: 'Venta', intercambio: 'Intercambio', ambos: 'Venta o intercambio' }[mode] ?? mode;
  }

  conditionLabel(condition: string): string {
    return (
      {
        nuevo: 'Nuevo',
        como_nuevo: 'Como nuevo',
        buen_estado: 'Buen estado',
        usado: 'Usado',
      }[condition] ?? condition
    );
  }
}
