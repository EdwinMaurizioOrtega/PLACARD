import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { Category } from '../../core/models';

@Component({
  selector: 'app-admin-catalog',
  imports: [FormsModule],
  template: `
    <section class="card">
      <h2>Categorías</h2>
      <p class="muted subtitle">
        Las categorías alimentan los filtros de Descubrir y Explorar, y el puntaje de afinidad del
        feed.
      </p>

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
          <button class="btn btn-ghost btn-sm" type="button" (click)="cancelEdit()">Cancelar</button>
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
  `,
  styles: `
    .subtitle {
      font-size: 0.85rem;
      margin-top: -0.3rem;
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
    }

    .spacer {
      flex: 1;
    }
  `,
})
export class AdminCatalogPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly categories = signal<Category[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly error = signal('');

  categoryForm = { name: '', icon: '' };

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.api.listCategories().subscribe((items) => this.categories.set(items));
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
