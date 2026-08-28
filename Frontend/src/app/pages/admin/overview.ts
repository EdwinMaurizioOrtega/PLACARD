import { Component, OnInit, inject, signal } from '@angular/core';

import { ApiService } from '../../core/api.service';
import { Stats } from '../../core/models';
import { BarChart, KpiCard } from '../../shared/charts';

@Component({
  selector: 'app-admin-overview',
  imports: [KpiCard, BarChart],
  template: `
    @if (stats(); as data) {
      <div class="metrics">
        <app-kpi-card [value]="data.overview.total_users" label="Usuarios" [accent]="true" />
        <app-kpi-card [value]="data.overview.total_garments" label="Prendas" />
        <app-kpi-card [value]="data.overview.available_garments" label="Disponibles" />
        <app-kpi-card [value]="data.overview.total_swipes" label="Swipes" />
        <app-kpi-card [value]="data.overview.total_matches" label="Matches" [accent]="true" />
        <app-kpi-card [value]="data.overview.total_messages" label="Mensajes" />
        <app-kpi-card
          [value]="data.overview.pending_reports"
          label="Reportes pendientes"
          hint="Requieren revisión"
        />
      </div>

      <app-bar-chart
        title="Prendas por categoría"
        [data]="categories()"
        note="Las categorías con menos prendas son candidatas a campañas de recolección dirigidas."
      />
    } @else {
      <div class="spinner"></div>
    }
  `,
  styles: `
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.8rem;
      margin-bottom: 1.2rem;
    }
  `,
})
export class AdminOverviewPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly stats = signal<Stats | null>(null);
  readonly categories = signal<{ label: string; value: number }[]>([]);

  ngOnInit() {
    this.api.stats().subscribe((data) => {
      this.stats.set(data);
      this.categories.set(data.by_category.map((c) => ({ label: c.category, value: c.total })));
    });
  }
}
