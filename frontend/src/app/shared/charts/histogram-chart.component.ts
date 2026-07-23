import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed
} from '@angular/core';
import { EngineersSalaryBarChartComponent } from './bar-chart.component';
import { ChartDatum } from './chart-types';

@Component({
  selector: 'engineers-salary-reference-histogram-chart',
  standalone: true,
  imports: [EngineersSalaryBarChartComponent],
  template: `
    <engineers-salary-reference-bar-chart
      [height]="height"
      [data]="bins()"
      [compactTicks]="compactTicks"
      (itemClick)="itemClick.emit($event)"
      [exportable]="exportable"
      [exportName]="exportName"
    >
    </engineers-salary-reference-bar-chart>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineersSalaryHistogramChartComponent {
  @Input() values: number[] = [];
  @Input() height = 240;
  @Input() binsCount = 10;
  @Input() compactTicks = true;
  @Input() exportable = false;
  @Input() exportName = 'chart';
  @Output() itemClick = new EventEmitter<ChartDatum>();

  bins = computed<ChartDatum[]>(() => {
    const values = this.values.filter(v => Number.isFinite(v));
    if (!values.length) {
      return [];
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binsCount = Math.max(3, this.binsCount);
    const span = max - min || 1;
    const size = span / binsCount;

    const counts = new Array(binsCount).fill(0);
    values.forEach(v => {
      const idx = Math.min(binsCount - 1, Math.floor((v - min) / size));
      counts[idx] += 1;
    });

    return counts.map((count, idx) => {
      const start = min + idx * size;
      const end = start + size;
      const label = `${Math.round(start)}-${Math.round(end)}`;
      return { label, value: count };
    });
  });
}
