import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartSeries {
  name: string;
  color: string;
  points: number[];
}

export const CHART_COLORS = [
  '#2f7fb0',
  '#34a37d',
  '#1d5b83',
  '#23805f',
  '#6ba9cc',
  '#7cc4a5',
  '#17394a',
  '#a8c8d8',
];

@Component({
  selector: 'app-kpi-card',
  imports: [DecimalPipe],
  template: `
    <div class="kpi" [class.accent]="accent()">
      <span class="value">
        {{ value() | number: format() }}<small>{{ suffix() }}</small>
      </span>
      <span class="label">{{ label() }}</span>
      @if (hint()) {
        <small class="hint">{{ hint() }}</small>
      }
    </div>
  `,
  styles: `
    .kpi {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 1rem;
      text-align: center;
      box-shadow: var(--shadow);
    }

    .kpi.accent {
      background: linear-gradient(135deg, rgba(52, 163, 125, 0.12), rgba(47, 127, 176, 0.12));
    }

    .value {
      display: block;
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--brand);
      line-height: 1.1;
    }

    .value small {
      font-size: 0.9rem;
      font-weight: 700;
    }

    .label {
      display: block;
      font-size: 0.82rem;
      color: var(--muted);
      margin-top: 0.2rem;
    }

    .hint {
      display: block;
      font-size: 0.7rem;
      color: var(--muted);
      margin-top: 0.35rem;
    }
  `,
})
export class KpiCard {
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  readonly suffix = input('');
  readonly hint = input('');
  readonly format = input('1.0-0');
  readonly accent = input(false);
}

@Component({
  selector: 'app-bar-chart',
  imports: [DecimalPipe],
  template: `
    <div class="chart">
      <h3>{{ title() }}</h3>
      @if (data().length === 0) {
        <p class="muted empty">Sin datos para mostrar.</p>
      } @else {
        <div class="rows">
          @for (row of data(); track row.label; let i = $index) {
            <div class="row">
              <span class="label" [title]="row.label">{{ row.label }}</span>
              <div class="track">
                <div
                  class="fill"
                  [style.width.%]="width(row.value)"
                  [style.background]="color(i)"
                ></div>
              </div>
              <span class="value">{{ row.value | number: '1.0-0' }}</span>
            </div>
          }
        </div>
      }
      @if (note()) {
        <p class="note muted">{{ note() }}</p>
      }
    </div>
  `,
  styles: `
    .chart {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 1.1rem;
      box-shadow: var(--shadow);
    }

    h3 {
      margin: 0 0 0.9rem;
      font-size: 0.98rem;
    }

    .rows {
      display: grid;
      gap: 0.45rem;
    }

    .row {
      display: grid;
      grid-template-columns: 130px 1fr 48px;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.83rem;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--muted);
    }

    .track {
      height: 12px;
      background: var(--line);
      border-radius: 999px;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    .value {
      text-align: right;
      font-weight: 700;
    }

    .empty,
    .note {
      font-size: 0.78rem;
    }

    .note {
      margin: 0.9rem 0 0;
      border-top: 1px solid var(--line);
      padding-top: 0.6rem;
      line-height: 1.45;
    }
  `,
})
export class BarChart {
  readonly title = input.required<string>();
  readonly data = input.required<ChartPoint[]>();
  readonly note = input('');

  private readonly max = computed(() => Math.max(...this.data().map((d) => d.value), 1));

  width(value: number): number {
    return (value / this.max()) * 100;
  }

  color(index: number): string {
    return CHART_COLORS[index % CHART_COLORS.length];
  }
}

@Component({
  selector: 'app-donut-chart',
  imports: [DecimalPipe],
  template: `
    <div class="chart">
      <h3>{{ title() }}</h3>
      @if (total() === 0) {
        <p class="muted empty">Sin datos para mostrar.</p>
      } @else {
        <div class="body">
          <svg viewBox="0 0 42 42" class="donut">
            @for (slice of slices(); track slice.label) {
              <circle
                class="segment"
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                [attr.stroke]="slice.color"
                stroke-width="6"
                [attr.stroke-dasharray]="slice.dash"
                [attr.stroke-dashoffset]="slice.offset"
              />
            }
            <text x="21" y="20.5" class="center-value">{{ total() | number: '1.0-0' }}</text>
            <text x="21" y="24.5" class="center-label">total</text>
          </svg>
          <ul class="legend">
            @for (slice of slices(); track slice.label) {
              <li>
                <span class="dot" [style.background]="slice.color"></span>
                <span class="name">{{ slice.label }}</span>
                <strong>{{ slice.value | number: '1.0-0' }}</strong>
                <small class="muted">{{ slice.percent | number: '1.1-1' }}%</small>
              </li>
            }
          </ul>
        </div>
      }
      @if (note()) {
        <p class="note muted">{{ note() }}</p>
      }
    </div>
  `,
  styles: `
    .chart {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 1.1rem;
      box-shadow: var(--shadow);
    }

    h3 {
      margin: 0 0 0.9rem;
      font-size: 0.98rem;
    }

    .body {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      flex-wrap: wrap;
    }

    .donut {
      width: 150px;
      height: 150px;
      flex-shrink: 0;
      transform: rotate(-90deg);
    }

    .segment {
      transition: stroke-dasharray 0.4s ease;
    }

    .center-value,
    .center-label {
      transform: rotate(90deg);
      transform-origin: 21px 21px;
      text-anchor: middle;
      fill: var(--ink);
    }

    .center-value {
      font-size: 5px;
      font-weight: 800;
    }

    .center-label {
      font-size: 2.6px;
      fill: var(--muted);
    }

    .legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
      flex: 1;
      min-width: 160px;
    }

    .legend li {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.82rem;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .name {
      flex: 1;
      text-transform: capitalize;
    }

    .empty,
    .note {
      font-size: 0.78rem;
    }

    .note {
      margin: 0.9rem 0 0;
      border-top: 1px solid var(--line);
      padding-top: 0.6rem;
      line-height: 1.45;
    }
  `,
})
export class DonutChart {
  readonly title = input.required<string>();
  readonly data = input.required<ChartPoint[]>();
  readonly note = input('');

  readonly total = computed(() => this.data().reduce((sum, d) => sum + d.value, 0));

  // El circulo tiene circunferencia 100 (r = 15.915) para trabajar en porcentajes directos.
  readonly slices = computed(() => {
    const total = this.total() || 1;
    let acc = 0;
    return this.data().map((point, i) => {
      const percent = (point.value / total) * 100;
      const slice = {
        label: point.label,
        value: point.value,
        percent,
        color: CHART_COLORS[i % CHART_COLORS.length],
        dash: `${percent} ${100 - percent}`,
        offset: `${-acc}`,
      };
      acc += percent;
      return slice;
    });
  });
}

@Component({
  selector: 'app-line-chart',
  template: `
    <div class="chart">
      <h3>{{ title() }}</h3>
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="plot">
        @for (tick of gridLines(); track tick.y) {
          <line class="grid" x1="34" [attr.y1]="tick.y" [attr.x2]="width - 6" [attr.y2]="tick.y" />
          <text class="axis" x="30" [attr.y]="tick.y + 3">{{ tick.value }}</text>
        }
        @for (serie of series(); track serie.name) {
          <polyline
            class="line"
            [attr.points]="path(serie.points)"
            [attr.stroke]="serie.color"
            fill="none"
          />
        }
        @for (label of labels(); track label.x) {
          <text class="axis" [attr.x]="label.x" [attr.y]="height - 4" text-anchor="middle">
            {{ label.text }}
          </text>
        }
      </svg>
      <ul class="legend">
        @for (serie of series(); track serie.name) {
          <li>
            <span class="dot" [style.background]="serie.color"></span>
            {{ serie.name }}
          </li>
        }
      </ul>
      @if (note()) {
        <p class="note muted">{{ note() }}</p>
      }
    </div>
  `,
  styles: `
    .chart {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 1.1rem;
      box-shadow: var(--shadow);
    }

    h3 {
      margin: 0 0 0.9rem;
      font-size: 0.98rem;
    }

    .plot {
      width: 100%;
      height: auto;
    }

    .grid {
      stroke: var(--line);
      stroke-width: 1;
    }

    .axis {
      font-size: 8px;
      fill: var(--muted);
      text-anchor: end;
    }

    .line {
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }

    .legend {
      list-style: none;
      margin: 0.6rem 0 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.9rem;
      font-size: 0.8rem;
      color: var(--muted);
    }

    .legend li {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .dot {
      width: 10px;
      height: 3px;
      border-radius: 2px;
    }

    .note {
      margin: 0.9rem 0 0;
      border-top: 1px solid var(--line);
      padding-top: 0.6rem;
      font-size: 0.78rem;
      line-height: 1.45;
    }
  `,
})
export class LineChart {
  readonly title = input.required<string>();
  readonly categories = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();
  readonly note = input('');

  protected readonly width = 320;
  protected readonly height = 140;
  private readonly left = 36;
  private readonly top = 8;
  private readonly bottom = 18;

  private readonly max = computed(() =>
    Math.max(...this.series().flatMap((s) => s.points), 1),
  );

  protected gridLines() {
    const max = this.max();
    const usable = this.height - this.top - this.bottom;
    return [0, 0.5, 1].map((ratio) => ({
      y: this.top + usable * (1 - ratio),
      value: Math.round(max * ratio),
    }));
  }

  protected labels() {
    const cats = this.categories();
    // Solo se rotulan algunos meses para que el eje no se amontone.
    const step = Math.max(1, Math.ceil(cats.length / 6));
    return cats
      .map((text, i) => ({ text, x: this.x(i, cats.length), index: i }))
      .filter((label) => label.index % step === 0);
  }

  protected path(points: number[]): string {
    return points.map((value, i) => `${this.x(i, points.length)},${this.y(value)}`).join(' ');
  }

  private x(index: number, count: number): number {
    if (count <= 1) return this.left;
    const usable = this.width - this.left - 8;
    return this.left + (usable / (count - 1)) * index;
  }

  private y(value: number): number {
    const usable = this.height - this.top - this.bottom;
    return this.top + usable * (1 - value / this.max());
  }
}

@Component({
  selector: 'app-funnel-chart',
  imports: [DecimalPipe],
  template: `
    <div class="chart">
      <h3>{{ title() }}</h3>
      <div class="steps">
        @for (step of steps(); track step.label; let i = $index) {
          <div class="step">
            <div class="bar" [style.width.%]="step.width" [style.background]="step.color">
              <span>{{ step.value | number: '1.0-0' }}</span>
            </div>
            <div class="meta">
              <strong>{{ step.label }}</strong>
              @if (i > 0) {
                <small class="muted">
                  {{ step.conversion | number: '1.1-1' }}% desde {{ step.previous }}
                </small>
              }
            </div>
          </div>
        }
      </div>
      @if (note()) {
        <p class="note muted">{{ note() }}</p>
      }
    </div>
  `,
  styles: `
    .chart {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 1.1rem;
      box-shadow: var(--shadow);
    }

    h3 {
      margin: 0 0 0.9rem;
      font-size: 0.98rem;
    }

    .steps {
      display: grid;
      gap: 0.55rem;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }

    .bar {
      height: 34px;
      min-width: 54px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 0.6rem;
      color: #fff;
      font-weight: 800;
      font-size: 0.85rem;
      transition: width 0.4s ease;
    }

    .meta strong {
      display: block;
      font-size: 0.85rem;
    }

    .meta small {
      font-size: 0.72rem;
    }

    .note {
      margin: 0.9rem 0 0;
      border-top: 1px solid var(--line);
      padding-top: 0.6rem;
      font-size: 0.78rem;
      line-height: 1.45;
    }
  `,
})
export class FunnelChart {
  readonly title = input.required<string>();
  readonly data = input.required<ChartPoint[]>();
  readonly note = input('');

  protected steps() {
    const points = this.data();
    const max = Math.max(...points.map((p) => p.value), 1);
    return points.map((point, i) => ({
      label: point.label,
      value: point.value,
      width: Math.max(14, (point.value / max) * 100),
      color: CHART_COLORS[i % CHART_COLORS.length],
      previous: i > 0 ? points[i - 1].label.toLowerCase() : '',
      conversion: i > 0 && points[i - 1].value > 0 ? (point.value / points[i - 1].value) * 100 : 0,
    }));
  }
}
