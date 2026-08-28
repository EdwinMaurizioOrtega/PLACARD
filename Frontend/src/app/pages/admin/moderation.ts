import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { REPORT_REASONS, Report } from '../../core/models';

@Component({
  selector: 'app-admin-moderation',
  imports: [DatePipe, FormsModule],
  template: `
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

      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

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
                  <button class="btn btn-danger btn-sm" (click)="suspend(report.target_user_id!)">
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
  `,
  styles: `
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
  `,
})
export class AdminModerationPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly reports = signal<Report[]>([]);
  readonly error = signal('');

  reportStatus = 'pendiente';

  ngOnInit() {
    this.loadReports();
  }

  loadReports() {
    this.api.listReports(this.reportStatus).subscribe((items) => this.reports.set(items));
  }

  reasonLabel(reason: string): string {
    return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  }

  resolve(report: Report, status: string) {
    this.api.resolveReport(report.id, status).subscribe(() => this.loadReports());
  }

  hideGarment(garmentId: string) {
    if (!confirm('¿Ocultar esta prenda del catálogo?')) return;
    this.api.moderateGarment(garmentId, true).subscribe({
      error: (err) => this.error.set(err?.error?.error ?? 'No se pudo ocultar la prenda'),
    });
  }

  suspend(userId: string) {
    if (!confirm('¿Suspender esta cuenta? No podrá iniciar sesión.')) return;
    this.api.setUserActive(userId, false).subscribe({
      error: (err) => this.error.set(err?.error?.error ?? 'No se pudo suspender la cuenta'),
    });
  }
}
