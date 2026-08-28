import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ApiService } from '../../core/api.service';
import { AdminReport, LabelCount } from '../../core/models';
import { BarChart, ChartPoint, DonutChart, FunnelChart, KpiCard, LineChart } from '../../shared/charts';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const MODE_LABELS: Record<string, string> = {
  venta: 'Venta',
  intercambio: 'Intercambio',
  ambos: 'Venta o intercambio',
};

const CONDITION_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  como_nuevo: 'Como nuevo',
  buen_estado: 'Buen estado',
  usado: 'Usado',
};

const STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

@Component({
  selector: 'app-admin-analytics',
  imports: [DecimalPipe, KpiCard, BarChart, DonutChart, LineChart, FunnelChart],
  template: `
    @if (report(); as data) {
      <section class="block">
        <header>
          <h2>1. Embudo de conversión</h2>
          <p class="muted">Del descubrimiento al intercambio cerrado.</p>
        </header>

        <div class="metrics">
          <app-kpi-card [value]="likeRate()" label="Vista → me gusta" suffix="%" format="1.1-1" [accent]="true" />
          <app-kpi-card [value]="matchRate()" label="Me gusta → match" suffix="%" format="1.1-1" />
          <app-kpi-card [value]="closeRate()" label="Match → intercambio" suffix="%" format="1.1-1" />
          <app-kpi-card [value]="data.funnel.supers" label="Super likes activos" />
        </div>

        <app-funnel-chart
          title="Etapas del embudo"
          [data]="funnel()"
          [note]="funnelNote()"
        />
      </section>

      <section class="block">
        <header>
          <h2>2. Actividad mensual</h2>
          <p class="muted">Últimos 12 meses. Los meses sin movimiento se muestran en cero.</p>
        </header>

        <app-line-chart
          title="Altas de usuarios, prendas y matches"
          [categories]="months()"
          [series]="timelineSeries()"
          [note]="timelineNote()"
        />
      </section>

      <section class="block">
        <header>
          <h2>3. Catálogo e inventario</h2>
          <p class="muted">Composición de la oferta publicada.</p>
        </header>

        <div class="metrics">
          <app-kpi-card
            [value]="data.catalog.totals.inventory_value ?? 0"
            label="Valor del inventario"
            suffix=" USD"
            format="1.0-0"
            [accent]="true"
          />
          <app-kpi-card
            [value]="data.catalog.totals.avg_price ?? 0"
            label="Precio promedio"
            suffix=" USD"
            format="1.2-2"
          />
          <app-kpi-card [value]="data.catalog.totals.for_sale" label="Prendas con precio" />
          <app-kpi-card
            [value]="data.catalog.totals.with_photo"
            label="Prendas con foto"
            hint="Las publicaciones sin foto casi no reciben likes"
          />
        </div>

        <div class="grid">
          <app-bar-chart
            title="Prendas por categoría"
            [data]="points(data.catalog.by_category)"
            note="Compara este volumen con la tasa de match por categoría antes de pedir más stock."
          />
          <app-donut-chart
            title="Prendas por modalidad"
            [data]="points(data.catalog.by_mode, MODE_LABELS)"
            note="Si domina 'ambos', el selector de intención se usa mucho al dar me gusta."
          />
          <app-bar-chart
            title="Prendas por talla"
            [data]="points(data.catalog.by_size)"
            note="Las tallas con poca oferta limitan el alcance del feed para esos usuarios."
          />
          <app-donut-chart
            title="Prendas por estado"
            [data]="points(data.catalog.by_condition, CONDITION_LABELS)"
            note="Mucha ropa 'usada' presiona el precio promedio a la baja."
          />
        </div>
      </section>

      <section class="block">
        <header>
          <h2>4. Geografía y cobertura</h2>
          <p class="muted">Dónde está la comunidad y qué tan lejos se encuentran entre sí.</p>
        </header>

        <div class="metrics">
          <app-kpi-card
            [value]="data.geo.totals.avg_distance_km ?? 0"
            label="Distancia media por match"
            suffix=" km"
            format="1.1-1"
            [accent]="true"
          />
          <app-kpi-card [value]="data.geo.totals.with_coords" label="Usuarios con ubicación" />
          <app-kpi-card
            [value]="data.geo.totals.without_coords"
            label="Sin ubicación"
            hint="No reciben ordenamiento por cercanía"
          />
          <app-kpi-card [value]="coverage()" label="Cobertura geográfica" suffix="%" format="1.1-1" />
        </div>

        <div class="grid">
          <app-bar-chart
            title="Matches por parroquia"
            [data]="areaMatches()"
            [note]="geoNote()"
          />
          <app-donut-chart
            title="Matches por tipo de zona"
            [data]="points(data.geo.by_zone)"
            note="La parroquia se deduce de las coordenadas del usuario, no la escribe a mano. Las zonas rurales suelen necesitar puntos de entrega fisicos."
          />
          <app-bar-chart
            title="Usuarios por parroquia"
            [data]="areaUsers()"
            note="Las parroquias líderes son candidatas a puntos de entrega y eventos presenciales."
          />
          <app-bar-chart
            title="Prendas publicadas por parroquia"
            [data]="areaGarments()"
            note="Una parroquia con muchos usuarios pero pocas prendas necesita campañas de recolección."
          />
        </div>
      </section>

      <section class="block">
        <header>
          <h2>5. Comunidad y confianza</h2>
          <p class="muted">Salud de las conversaciones y reputación de los usuarios.</p>
        </header>

        <div class="metrics">
          <app-kpi-card
            [value]="data.community.totals.avg_rating ?? 0"
            label="Calificación promedio"
            suffix=" / 5"
            format="1.2-2"
            [accent]="true"
          />
          <app-kpi-card [value]="data.community.totals.total_reviews" label="Reseñas emitidas" />
          <app-kpi-card [value]="data.community.totals.active_users" label="Usuarios activos" />
          <app-kpi-card
            [value]="data.community.totals.suspended_users"
            label="Cuentas suspendidas"
          />
          <app-kpi-card
            [value]="data.community.totals.silent_matches"
            label="Matches sin mensajes"
            hint="Conversaciones que nunca arrancaron"
          />
        </div>

        <div class="grid">
          <app-bar-chart
            title="Distribución de calificaciones"
            [data]="ratings()"
            note="Una concentración en 4 y 5 estrellas respalda el uso de testimonios en campañas."
          />
          <app-donut-chart
            title="Matches por intención"
            [data]="points(data.community.by_intent, MODE_LABELS)"
            note="Revela si la plataforma se está usando más para comprar o para intercambiar."
          />
          <app-donut-chart
            title="Matches por estado"
            [data]="points(data.community.by_match_status, STATUS_LABELS)"
            note="Muchos matches 'activos' antiguos indican negociaciones que no se cierran."
          />
        </div>

        <div class="card">
          <h3>Top usuarios por reputación</h3>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th class="num">Calificación</th>
                <th class="num">Reseñas</th>
                <th class="num">Prendas</th>
              </tr>
            </thead>
            <tbody>
              @for (user of data.community.top_users; track user.username) {
                <tr>
                  <td class="who">
                    <img class="avatar" [src]="user.avatar_url" alt="" />
                    <span>
                      <strong>{{ user.full_name }}</strong><br />
                      <small class="muted">&#64;{{ user.username }}</small>
                    </span>
                  </td>
                  <td class="num">⭐ {{ user.rating_avg | number: '1.1-1' }}</td>
                  <td class="num">{{ user.rating_count }}</td>
                  <td class="num">{{ user.garments }}</td>
                </tr>
              }
            </tbody>
          </table>
          <p class="note muted">
            Los usuarios mejor calificados y con más prendas son los candidatos naturales a un
            programa de embajadores.
          </p>
        </div>
      </section>
    } @else if (error()) {
      <div class="alert alert-error">{{ error() }}</div>
    } @else {
      <div class="spinner"></div>
    }
  `,
  styles: `
    .block {
      margin-bottom: 2.2rem;
    }

    .block header {
      margin-bottom: 0.9rem;
    }

    .block h2 {
      margin: 0;
      font-size: 1.15rem;
    }

    .block header p {
      margin: 0.15rem 0 0;
      font-size: 0.85rem;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.8rem;
      margin-bottom: 1rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
      gap: 1rem;
      align-items: start;
    }

    .card {
      margin-top: 1rem;
    }

    .card h3 {
      margin: 0 0 0.8rem;
      font-size: 0.98rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    th,
    td {
      padding: 0.5rem 0.4rem;
      border-bottom: 1px solid var(--line);
      text-align: left;
    }

    th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .who {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .avatar {
      width: 32px;
      height: 32px;
    }

    .note {
      margin: 0.9rem 0 0;
      font-size: 0.78rem;
      line-height: 1.45;
    }
  `,
})
export class AdminAnalyticsPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly MODE_LABELS = MODE_LABELS;
  protected readonly CONDITION_LABELS = CONDITION_LABELS;
  protected readonly STATUS_LABELS = STATUS_LABELS;

  readonly report = signal<AdminReport | null>(null);
  readonly error = signal('');

  ngOnInit() {
    this.api.adminReport().subscribe({
      next: (data) => this.report.set(data),
      error: (err) => this.error.set(err?.error?.error ?? 'No se pudo cargar el reporte'),
    });
  }

  protected points(rows: LabelCount[], labels?: Record<string, string>): ChartPoint[] {
    return rows.map((row) => ({
      label: labels?.[row.label] ?? row.label,
      value: row.total,
    }));
  }

  readonly funnel = computed<ChartPoint[]>(() => {
    const f = this.report()?.funnel;
    if (!f) return [];
    return [
      { label: 'Vistas', value: f.views },
      { label: 'Me gusta', value: f.likes },
      { label: 'Matches', value: f.matches },
      { label: 'Chats activos', value: f.chats },
      { label: 'Intercambios', value: f.exchanges },
    ];
  });

  readonly likeRate = computed(() => this.rate('likes', 'views'));
  readonly matchRate = computed(() => this.rate('matches', 'likes'));
  readonly closeRate = computed(() => this.rate('exchanges', 'matches'));

  private rate(top: keyof AdminReport['funnel'], base: keyof AdminReport['funnel']): number {
    const f = this.report()?.funnel;
    if (!f || !f[base]) return 0;
    return (f[top] / f[base]) * 100;
  }

  readonly funnelNote = computed(() => {
    const step = this.funnel()
      .slice(1)
      .map((point, i) => ({ point, previous: this.funnel()[i] }))
      .reduce(
        (worst, current) => {
          const loss =
            current.previous.value > 0 ? 1 - current.point.value / current.previous.value : 0;
          return loss > worst.loss ? { label: current.point.label, loss } : worst;
        },
        { label: '', loss: 0 },
      );
    if (!step.label) return '';
    return `La mayor fuga ocurre al llegar a "${step.label}": se pierde el ${(step.loss * 100).toFixed(1)}% del paso anterior. Ahí conviene concentrar las mejoras de producto.`;
  });

  readonly months = computed(() =>
    (this.report()?.timeline ?? []).map((point) => {
      const date = new Date(point.month);
      return `${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
    }),
  );

  readonly timelineSeries = computed(() => {
    const timeline = this.report()?.timeline ?? [];
    return [
      { name: 'Usuarios nuevos', color: '#2f7fb0', points: timeline.map((p) => p.users) },
      { name: 'Prendas publicadas', color: '#34a37d', points: timeline.map((p) => p.garments) },
      { name: 'Matches', color: '#17394a', points: timeline.map((p) => p.matches) },
    ];
  });

  readonly timelineNote = computed(() => {
    const timeline = this.report()?.timeline ?? [];
    if (timeline.length === 0) return '';
    const best = timeline.reduce((a, b) => (b.matches > a.matches ? b : a));
    const date = new Date(best.month);
    return `El mes más activo fue ${MONTHS[date.getMonth()]} con ${best.matches} matches. Planifica las campañas de recolección el mes previo al pico para llegar con inventario suficiente.`;
  });

  readonly coverage = computed(() => {
    const geo = this.report()?.geo.totals;
    if (!geo) return 0;
    const total = geo.with_coords + geo.without_coords;
    return total ? (geo.with_coords / total) * 100 : 0;
  });

  readonly areaUsers = computed<ChartPoint[]>(() =>
    (this.report()?.geo.by_area ?? [])
      .map((row) => ({ label: row.label, value: row.users }))
      .sort((a, b) => b.value - a.value),
  );

  readonly areaGarments = computed<ChartPoint[]>(() =>
    (this.report()?.geo.by_area ?? [])
      .map((row) => ({ label: row.label, value: row.garments }))
      .sort((a, b) => b.value - a.value),
  );

  readonly areaMatches = computed<ChartPoint[]>(() =>
    (this.report()?.geo.by_area ?? []).map((row) => ({ label: row.label, value: row.matches })),
  );

  readonly geoNote = computed(() => {
    const areas = this.report()?.geo.by_area ?? [];
    const stuck = areas.filter((a) => a.users > 0 && a.matches === 0).map((a) => a.label);
    if (stuck.length === 0) {
      return 'Todas las parroquias con usuarios generan al menos un match.';
    }
    return `Con usuarios pero sin ningún match: ${stuck.slice(0, 4).join(', ')}. Suelen necesitar más oferta local o campañas de activación.`;
  });

  readonly ratings = computed<ChartPoint[]>(() =>
    (this.report()?.community.rating_distribution ?? []).map((row) => ({
      label: `${row.label} ⭐`,
      value: row.total,
    })),
  );
}
