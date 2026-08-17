import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { REPORT_REASONS } from '../core/models';

@Component({
  selector: 'app-report-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div class="card dialog" (click)="$event.stopPropagation()">
        <h3>Reportar {{ label() }}</h3>
        <p class="muted">
          El equipo de PLACARD revisará el caso. Tu reporte es confidencial.
        </p>

        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }

        @if (sent()) {
          <div class="alert alert-ok">Reporte enviado. Gracias por cuidar la comunidad.</div>
          <button class="btn btn-primary btn-block" (click)="closed.emit()">Cerrar</button>
        } @else {
          <div class="field">
            <label for="reason">Motivo</label>
            <select id="reason" [(ngModel)]="reason">
              @for (item of reasons; track item.value) {
                <option [value]="item.value">{{ item.label }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="details">Detalles (opcional)</label>
            <textarea id="details" [(ngModel)]="details" placeholder="Cuéntanos qué ocurrió…"></textarea>
          </div>
          <div class="row end">
            <button class="btn btn-ghost" (click)="closed.emit()">Cancelar</button>
            <button class="btn btn-danger" [disabled]="sending()" (click)="submit()">
              {{ sending() ? 'Enviando…' : 'Enviar reporte' }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(36, 28, 38, 0.55);
      display: grid;
      place-items: center;
      z-index: 70;
      padding: 1rem;
    }

    .dialog {
      width: min(440px, 100%);
      padding: 1.6rem;
    }

    .row.end {
      justify-content: flex-end;
      gap: 0.6rem;
    }
  `,
})
export class ReportDialog {
  private readonly api = inject(ApiService);

  readonly garmentId = input<string | null>(null);
  readonly userId = input<string | null>(null);
  readonly label = input('publicación');
  readonly closed = output<void>();

  readonly reasons = REPORT_REASONS;
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  reason: string = REPORT_REASONS[0].value;
  details = '';

  submit() {
    this.sending.set(true);
    this.error.set('');
    this.api
      .createReport({
        target_garment_id: this.garmentId(),
        target_user_id: this.userId(),
        reason: this.reason,
        details: this.details || null,
      })
      .subscribe({
        next: () => {
          this.sent.set(true);
          this.sending.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error ?? 'No se pudo enviar el reporte');
          this.sending.set(false);
        },
      });
  }
}
