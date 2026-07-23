import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy
} from '@angular/core';
import type * as ECharts from 'echarts';

type EchartsRuntime = typeof import('echarts');

/* --- Dark theme (registered once via module-level flag) --- */
const ABR_DARK: Record<string, unknown> = {
  backgroundColor: 'transparent',
  textStyle: { color: '#cbd5e1' },
  title: { textStyle: { color: '#e2e8f0' }, subtextStyle: { color: '#94a3b8' } },
  legend: { textStyle: { color: '#cbd5e1' } },
  tooltip: {
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderColor: 'rgba(148,163,184,0.25)',
    textStyle: { color: '#e2e8f0' }
  },
  grid: { containLabel: true },
  axisPointer: { lineStyle: { color: '#94a3b8' } },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#64748b' } },
    axisLabel: { color: '#cbd5e1' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } }
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#64748b' } },
    axisLabel: { color: '#cbd5e1' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } }
  },
  visualMap: { textStyle: { color: '#cbd5e1' } },
  dataZoom: {
    textStyle: { color: '#cbd5e1' },
    borderColor: 'rgba(148,163,184,0.25)'
  },
  color: ['#22c55e', '#60a5fa', '#f59e0b', '#a78bfa', '#ef4444', '#34d399', '#eab308']
};

// module-scoped flag (NOT on the echarts namespace)
let ECHARTS_ABR_DARK_REGISTERED = false;
function ensureSalaryDarkThemeRegistered(echarts: EchartsRuntime) {
  if (!ECHARTS_ABR_DARK_REGISTERED) {
    echarts.registerTheme('abr-dark', ABR_DARK);
    ECHARTS_ABR_DARK_REGISTERED = true;
  }
}

@Component({
  selector: 'echart',
  standalone: true,
  imports: [],
  template: `<div class="echart-host"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .echart-host {
        width: 100%;
        height: 100%;
        min-height: 260px;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EchartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() options: ECharts.EChartsOption = {};
  /** 'auto' | 'dark' | 'light' | registered theme name */
  @Input() theme: 'auto' | 'dark' | 'light' | string = 'auto';
  @Input() renderer: 'canvas' | 'svg' = 'canvas';
  @Input() height = 320;

  private chart?: ECharts.ECharts;
  private echarts?: EchartsRuntime;
  private echartsLoad?: Promise<EchartsRuntime>;
  private destroyed = false;
  private ro?: ResizeObserver;
  private mo?: MutationObserver;
  private resizeFrameId: number | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    void this.initChart();
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['height'] && !ch['height'].firstChange) {
      this.host().style.height = `${this.height}px`;
      this.queueResize();
    }
    if (!this.chart) return;
    if (ch['theme'] && !ch['theme'].firstChange) {
      void this.retheme();
      return;
    }
    if (ch['options']) this.applyOptions();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.resizeFrameId !== null) {
      cancelAnimationFrame(this.resizeFrameId);
      this.resizeFrameId = null;
    }
    this.ro?.disconnect();
    this.mo?.disconnect();
    try {
      this.chart?.dispose();
    } catch {}
    this.chart = undefined;
  }

  // ----- helpers -----
  private host() {
    return this.el.nativeElement.querySelector('.echart-host') as HTMLDivElement;
  }

  private async loadEcharts(): Promise<EchartsRuntime> {
    if (this.echarts) return this.echarts;
    this.echartsLoad ??= import('echarts');
    this.echarts = await this.echartsLoad;
    return this.echarts;
  }

  private async initChart(): Promise<void> {
    const host = this.host();
    host.style.height = `${this.height}px`;

    const echarts = await this.loadEcharts();
    if (this.destroyed) return;

    ensureSalaryDarkThemeRegistered(echarts);
    this.chart = echarts.init(host, this.resolveThemeName(), { renderer: this.renderer });
    this.applyOptions();

    // auto-resize
    this.ro = new ResizeObserver(() => this.queueResize());
    this.ro.observe(host);

    // re-theme on <html data-theme> or .dark toggle
    this.mo = new MutationObserver(() => void this.retheme());
    this.mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    });
  }

  private resolveThemeName(): string | undefined {
    if (this.theme !== 'auto') return this.theme === 'dark' ? 'abr-dark' : this.theme;
    const html = document.documentElement;
    const dt = html.getAttribute('data-theme');
    const isDark = dt ? dt === 'dark' : html.classList.contains('dark');
    return isDark ? 'abr-dark' : undefined; // undefined => default light
  }

  private applyOptions() {
    if (!this.chart) return;
    const final = { backgroundColor: 'transparent', ...this.options } as ECharts.EChartsOption;
    this.chart.setOption(final, true);
  }

  private queueResize(): void {
    if (!this.chart) return;
    if (this.resizeFrameId !== null) return;
    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = null;
      this.chart?.resize();
    });
  }

  private async retheme(): Promise<void> {
    if (!this.chart) return;
    const echarts = await this.loadEcharts();
    if (this.destroyed || !this.chart) return;

    const host = this.host();
    const state = this.chart.getOption();
    try {
      this.chart.dispose();
    } catch {}
    this.chart = echarts.init(host, this.resolveThemeName(), { renderer: this.renderer });
    this.chart.setOption(state as ECharts.EChartsOption, true);
  }
}
