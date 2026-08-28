import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card">
      <h2>Usuarios</h2>
      <p class="muted subtitle">
        Suspender una cuenta impide el inicio de sesión y la retira del feed de los demás.
      </p>

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
  `,
  styles: `
    .subtitle {
      font-size: 0.85rem;
      margin-top: -0.3rem;
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
      margin-top: 0.8rem;
    }
  `,
})
export class AdminUsersPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly users = signal<User[]>([]);

  userQuery = '';

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.api
      .listUsers({ q: this.userQuery, per_page: 50 })
      .subscribe((res) => this.users.set(res.items));
  }

  toggleActive(user: User) {
    this.api.setUserActive(user.id, !user.is_active).subscribe(() => this.loadUsers());
  }
}
