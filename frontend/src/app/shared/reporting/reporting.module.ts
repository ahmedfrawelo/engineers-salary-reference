import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EngineersSalaryAreaRangeChartComponent } from '@shared/charts/area-range-chart.component';
import { EngineersSalaryBarChartComponent } from '@shared/charts/bar-chart.component';
import { EngineersSalaryBoxplotChartComponent } from '@shared/charts/boxplot-chart.component';
import { EngineersSalaryBulletChartComponent } from '@shared/charts/bullet-chart.component';
import { EngineersSalaryBumpChartComponent } from '@shared/charts/bump-chart.component';
import { EngineersSalaryCalendarHeatmapComponent } from '@shared/charts/calendar-heatmap-chart.component';
import { EngineersSalaryCandlestickChartComponent } from '@shared/charts/candlestick-chart.component';
import { EngineersSalaryChordChartComponent } from '@shared/charts/chord-chart.component';
import { EngineersSalaryDumbbellChartComponent } from '@shared/charts/dumbbell-chart.component';
import { EngineersSalaryFunnelChartComponent } from '@shared/charts/funnel-chart.component';
import { EngineersSalaryGanttChartComponent } from '@shared/charts/gantt-chart.component';
import { EngineersSalaryGaugeChartComponent } from '@shared/charts/gauge-chart.component';
import { EngineersSalaryHeatmapChartComponent } from '@shared/charts/heatmap-chart.component';
import { EngineersSalaryHistogramChartComponent } from '@shared/charts/histogram-chart.component';
import { EngineersSalaryLineChartComponent } from '@shared/charts/line-chart.component';
import { EngineersSalaryLollipopChartComponent } from '@shared/charts/lollipop-chart.component';
import { EngineersSalaryMekkoChartComponent } from '@shared/charts/mekko-chart.component';
import { EngineersSalaryNetworkChartComponent } from '@shared/charts/network-chart.component';
import { EngineersSalaryOhlcChartComponent } from '@shared/charts/ohlc-chart.component';
import { EngineersSalaryParallelCoordinatesChartComponent } from '@shared/charts/parallel-coordinates-chart.component';
import { EngineersSalaryParetoChartComponent } from '@shared/charts/pareto-chart.component';
import { EngineersSalaryPieChartComponent } from '@shared/charts/pie-chart.component';
import { EngineersSalaryPolarAreaChartComponent } from '@shared/charts/polar-area-chart.component';
import { EngineersSalaryPyramidChartComponent } from '@shared/charts/pyramid-chart.component';
import { EngineersSalaryRadarChartComponent } from '@shared/charts/radar-chart.component';
import { EngineersSalaryRadialBarChartComponent } from '@shared/charts/radial-bar-chart.component';
import { EngineersSalaryRangeBarChartComponent } from '@shared/charts/range-bar-chart.component';
import { EngineersSalaryRidgelineChartComponent } from '@shared/charts/ridgeline-chart.component';
import { EngineersSalarySankeyChartComponent } from '@shared/charts/sankey-chart.component';
import { EngineersSalaryScatterChartComponent } from '@shared/charts/scatter-chart.component';
import { EngineersSalarySlopeChartComponent } from '@shared/charts/slope-chart.component';
import { EngineersSalarySparklineChartComponent } from '@shared/charts/sparkline-chart.component';
import { EngineersSalaryStackedBarChartComponent } from '@shared/charts/stacked-bar-chart.component';
import { EngineersSalaryStepLineChartComponent } from '@shared/charts/step-line-chart.component';
import { EngineersSalaryStreamChartComponent } from '@shared/charts/stream-chart.component';
import { EngineersSalarySunburstChartComponent } from '@shared/charts/sunburst-chart.component';
import { EngineersSalaryTernaryChartComponent } from '@shared/charts/ternary-chart.component';
import { EngineersSalaryTileMapChartComponent } from '@shared/charts/tilemap-chart.component';
import { EngineersSalaryTimelineChartComponent } from '@shared/charts/timeline-chart.component';
import { EngineersSalaryTreeChartComponent } from '@shared/charts/tree-chart.component';
import { EngineersSalaryTreemapChartComponent } from '@shared/charts/treemap-chart.component';
import { EngineersSalaryUpsetChartComponent } from '@shared/charts/upset-chart.component';
import { EngineersSalaryVennChartComponent } from '@shared/charts/venn-chart.component';
import { EngineersSalaryViolinChartComponent } from '@shared/charts/violin-chart.component';
import { EngineersSalaryWaffleChartComponent } from '@shared/charts/waffle-chart.component';
import { EngineersSalaryWaterfallChartComponent } from '@shared/charts/waterfall-chart.component';
import { EngineersSalaryWordCloudComponent } from '@shared/charts/word-cloud-chart.component';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { ReportingChartDeckComponent } from './components/reporting-chart-deck/reporting-chart-deck.component';
import { ReportingDetailViewComponent } from './components/reporting-detail-view/reporting-detail-view.component';
import { ReportingFilterPanelComponent } from './components/reporting-filter-panel/reporting-filter-panel.component';
import { ReportingKpiPanelComponent } from './components/reporting-kpi-panel/reporting-kpi-panel.component';
import { ReportingRegisterComponent } from './components/reporting-register/reporting-register.component';

const CHART_IMPORTS = [
  EngineersSalaryAreaRangeChartComponent,
  EngineersSalaryBarChartComponent,
  EngineersSalaryBoxplotChartComponent,
  EngineersSalaryBulletChartComponent,
  EngineersSalaryBumpChartComponent,
  EngineersSalaryCalendarHeatmapComponent,
  EngineersSalaryCandlestickChartComponent,
  EngineersSalaryChordChartComponent,
  EngineersSalaryDumbbellChartComponent,
  EngineersSalaryFunnelChartComponent,
  EngineersSalaryGanttChartComponent,
  EngineersSalaryGaugeChartComponent,
  EngineersSalaryHeatmapChartComponent,
  EngineersSalaryHistogramChartComponent,
  EngineersSalaryLineChartComponent,
  EngineersSalaryLollipopChartComponent,
  EngineersSalaryMekkoChartComponent,
  EngineersSalaryNetworkChartComponent,
  EngineersSalaryOhlcChartComponent,
  EngineersSalaryParallelCoordinatesChartComponent,
  EngineersSalaryParetoChartComponent,
  EngineersSalaryPieChartComponent,
  EngineersSalaryPolarAreaChartComponent,
  EngineersSalaryPyramidChartComponent,
  EngineersSalaryRadarChartComponent,
  EngineersSalaryRadialBarChartComponent,
  EngineersSalaryRangeBarChartComponent,
  EngineersSalaryRidgelineChartComponent,
  EngineersSalarySankeyChartComponent,
  EngineersSalaryScatterChartComponent,
  EngineersSalarySlopeChartComponent,
  EngineersSalarySparklineChartComponent,
  EngineersSalaryStackedBarChartComponent,
  EngineersSalaryStepLineChartComponent,
  EngineersSalaryStreamChartComponent,
  EngineersSalarySunburstChartComponent,
  EngineersSalaryTernaryChartComponent,
  EngineersSalaryTileMapChartComponent,
  EngineersSalaryTimelineChartComponent,
  EngineersSalaryTreeChartComponent,
  EngineersSalaryTreemapChartComponent,
  EngineersSalaryUpsetChartComponent,
  EngineersSalaryVennChartComponent,
  EngineersSalaryViolinChartComponent,
  EngineersSalaryWaffleChartComponent,
  EngineersSalaryWaterfallChartComponent,
  EngineersSalaryWordCloudComponent
];

@NgModule({
  declarations: [
    ReportingChartDeckComponent,
    ReportingDetailViewComponent,
    ReportingFilterPanelComponent,
    ReportingKpiPanelComponent,
    ReportingRegisterComponent
  ],
  imports: [CommonModule, FormsModule, RouterLink, AppIconDirective, ...CHART_IMPORTS],
  exports: [
    ReportingChartDeckComponent,
    ReportingDetailViewComponent,
    ReportingFilterPanelComponent,
    ReportingKpiPanelComponent,
    ReportingRegisterComponent
  ]
})
export class ReportingModule {}
