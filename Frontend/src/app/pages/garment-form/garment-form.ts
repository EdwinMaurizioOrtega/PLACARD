import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { CONDITIONS, Category, MODES, SIZES, STATUSES, STYLES } from '../../core/models';

@Component({
  selector: 'app-garment-form',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page narrow">
      <div class="page-head">
        <div>
          <h1>{{ id() ? 'Editar prenda' : 'Publicar prenda' }}</h1>
          <p class="subtitle">
            Mientras más detalles agregues, más fácil será encontrar un intercambio.
          </p>
        </div>
        <a class="btn btn-ghost" routerLink="/closet">Volver</a>
      </div>

      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

      <form class="card" (ngSubmit)="submit()">
        <div class="field">
          <label for="title">Título</label>
          <input id="title" name="title" [(ngModel)]="form.title" required maxlength="120" />
        </div>

        <div class="field">
          <label for="description">Descripción</label>
          <textarea
            id="description"
            name="description"
            [(ngModel)]="form.description"
            placeholder="Estado real, medidas, motivo por el que la liberas…"
          ></textarea>
        </div>

        <div class="grid-2">
          <div class="field">
            <label for="category">Categoría</label>
            <select id="category" name="category" [(ngModel)]="form.category_id">
              <option value="">Sin categoría</option>
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="size">Talla</label>
            <select id="size" name="size" [(ngModel)]="form.size" required>
              @for (size of sizes; track size) {
                <option [value]="size">{{ size }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="condition">Estado</label>
            <select id="condition" name="condition" [(ngModel)]="form.condition">
              @for (cond of conditions; track cond.value) {
                <option [value]="cond.value">{{ cond.label }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="mode">Modalidad</label>
            <select id="mode" name="mode" [(ngModel)]="form.mode">
              @for (mode of modes; track mode.value) {
                <option [value]="mode.value">{{ mode.label }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="price">Precio (USD, opcional)</label>
            <input id="price" name="price" type="number" min="0" step="0.5" [(ngModel)]="form.price" />
          </div>
          <div class="field">
            <label for="status">Disponibilidad</label>
            <select id="status" name="status" [(ngModel)]="form.status">
              @for (status of statuses; track status.value) {
                <option [value]="status.value">{{ status.label }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="brand">Marca</label>
            <input id="brand" name="brand" [(ngModel)]="form.brand" />
          </div>
          <div class="field">
            <label for="color">Color</label>
            <input id="color" name="color" [(ngModel)]="form.color" />
          </div>
          <div class="field">
            <label for="style">Estilo</label>
            <select id="style" name="style" [(ngModel)]="form.style">
              <option value="">Sin estilo</option>
              @for (style of styles; track style) {
                <option [value]="style">{{ style }}</option>
              }
            </select>
          </div>
        </div>

        <div class="field">
          <label>Fotografías (URL)</label>
          @for (image of images(); track $index) {
            <div class="img-row">
              <input
                [value]="image"
                (input)="setImage($index, $event)"
                placeholder="https://…"
                [attr.aria-label]="'Imagen ' + ($index + 1)"
              />
              <button type="button" class="btn btn-danger btn-sm" (click)="removeImage($index)">
                ✕
              </button>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-sm" (click)="addImage()">
            + Agregar fotografía
          </button>
        </div>

        @if (previews().length) {
          <div class="previews">
            @for (url of previews(); track url) {
              <img [src]="url" alt="Vista previa" />
            }
          </div>
        }

        <div class="row end">
          <a class="btn btn-ghost" routerLink="/closet">Cancelar</a>
          <button class="btn btn-primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Guardando…' : id() ? 'Guardar cambios' : 'Publicar prenda' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .narrow {
      max-width: 780px;
    }

    .img-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .previews {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .previews img {
      width: 92px;
      height: 122px;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid var(--line);
    }

    .row.end {
      justify-content: flex-end;
      gap: 0.6rem;
    }
  `,
})
export class GarmentFormPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly categories = signal<Category[]>([]);
  readonly images = signal<string[]>(['']);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly sizes = SIZES;
  readonly styles = STYLES;
  readonly conditions = CONDITIONS;
  readonly modes = MODES;
  readonly statuses = STATUSES;

  form = {
    title: '',
    description: '',
    category_id: '',
    size: 'M',
    condition: 'buen_estado',
    mode: 'ambos',
    status: 'disponible',
    price: null as number | null,
    brand: '',
    color: '',
    style: '',
  };

  ngOnInit() {
    this.api.listCategories().subscribe((cats) => this.categories.set(cats));

    const id = this.id();
    if (!id) return;

    this.api.getGarment(id).subscribe((garment) => {
      this.form = {
        title: garment.title,
        description: garment.description ?? '',
        category_id: garment.category_id ?? '',
        size: garment.size,
        condition: garment.condition,
        mode: garment.mode,
        status: garment.status,
        price: garment.price,
        brand: garment.brand ?? '',
        color: garment.color ?? '',
        style: garment.style ?? '',
      };
      this.images.set(garment.images.length ? garment.images.map((i) => i.url) : ['']);
    });
  }

  previews() {
    return this.images().filter((url) => url.trim().startsWith('http'));
  }

  addImage() {
    this.images.update((list) => [...list, '']);
  }

  removeImage(index: number) {
    this.images.update((list) => list.filter((_, i) => i !== index));
  }

  setImage(index: number, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.images.update((list) => list.map((url, i) => (i === index ? value : url)));
  }

  submit() {
    this.saving.set(true);
    this.error.set('');

    const payload = {
      ...this.form,
      category_id: this.form.category_id || null,
      style: this.form.style || null,
      price: this.form.price === null || this.form.price === undefined ? null : Number(this.form.price),
      images: this.previews(),
    };

    const id = this.id();
    const request = id
      ? this.api.updateGarment(id, payload)
      : this.api.createGarment(payload);

    request.subscribe({
      next: () => this.router.navigate(['/closet']),
      error: (err) => {
        this.error.set(err?.error?.error ?? 'No se pudo guardar la prenda');
        this.saving.set(false);
      },
    });
  }
}
