import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { SalaryDashboardPort } from '../../application/salary-dashboard.port';
import type { SalaryDashboardOptions, SalaryDashboardReportPreview, SalaryDashboardSummary } from '../../domain/salary-dashboard.models';
import { SearchSelectComponent } from '../../../../shared/ui/search-select.component';
import { AppIconDirective } from '../../../../shared/icons/app-icon.directive';
import { DataGridModule, type GridColumn, type GridConfig } from '../../../../shared/data-grid';
import { PageDesignComponent } from '../../../../shared/ui/page-design';

@Component({
  selector: 'feature-dashboard-page',
  standalone: true,
  imports: [RouterLink, SearchSelectComponent, AppIconDirective, DataGridModule, PageDesignComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <engineers-salary-reference-page-design
      class="salary-dashboard-design"
      title="Market overview"
      sub="Engineering salary intelligence across Egypt"
      icon="bar-chart"
      [hideHeader]="true"
      [sharedToolbarShowCustomize]="false"
      toolbarAriaLabel="Salary dashboard actions"
    >
      <div toolbar-left class="dashboard-toolbar-context">
        <span>SALARY MARKET</span>
        <strong>Egypt</strong>
        <small>{{ summary()?.totalReports || 0 }} published reports</small>
      </div>
      <div toolbar-right-before-shared class="dashboard-toolbar-actions">
        <a class="btn sm proj-toolbar-btn" routerLink="/salary-reports">Browse reports</a>
        <a class="btn sm proj-toolbar-btn proj-toolbar-btn--primary" routerLink="/submit-report"><i appIcon="plus" aria-hidden="true"></i><span>Add salary report</span></a>
      </div>

    <main page-table class="market-dashboard" aria-labelledby="dashboard-title">
      <header class="dashboard-intro">
        <div><span>ENGINEERS REFERENCE</span><h1 id="dashboard-title">Market overview</h1><p>Compare current engineering salaries across disciplines and experience levels.</p></div>
      </header>

      <section class="filter-strip" aria-label="Market filters">
        <div class="filter-strip__title"><i appIcon="funnel" aria-hidden="true"></i><div><strong>Market lens</strong><span>Filter all insights</span></div></div>
        <label><span>Discipline</span><search-select [options]="options().disciplines" [value]="discipline() || null" (valueChange)="setDiscipline($event || '')" placeholder="All disciplines" [allowClear]="true" [allowInlineSearch]="true" /></label>
        <label><span>Seniority</span><search-select [options]="options().seniorities" [value]="seniority() || null" (valueChange)="setSeniority($event || '')" placeholder="All levels" [allowClear]="true" [allowInlineSearch]="true" /></label>
        <label><span>Work mode</span><search-select [options]="options().workModes" [value]="workMode() || null" (valueChange)="setWorkMode($event || '')" placeholder="All modes" [allowClear]="true" [allowInlineSearch]="true" /></label>
        <button class="apply" type="button" (click)="refresh()" [disabled]="isLoading()">{{ isLoading() ? 'Updating…' : 'Apply' }}</button>
      </section>

      @if (errorMessage()) {
        <section class="data-state" role="alert">
          <div class="data-state__main"><span class="data-state__icon"><i appIcon="cloud-off" aria-hidden="true"></i></span><p>DATA CONNECTION</p><h2>Market data is temporarily unavailable</h2><span class="data-state__error" dir="rtl">{{ errorMessage() }}</span><div><button class="action action--primary" type="button" (click)="refresh()">Try again</button><a class="action" routerLink="/submit-report">Add a salary report</a></div></div>
          <aside><strong>You can still contribute</strong><p>Your salary report will help build a clearer reference once the connection is restored.</p><ul><li><i appIcon="check" aria-hidden="true"></i> Anonymous submissions supported</li><li><i appIcon="check" aria-hidden="true"></i> Structured, comparable fields</li><li><i appIcon="check" aria-hidden="true"></i> Built for Egyptian engineers</li></ul></aside>
        </section>
      } @else if (!isLoading() && (summary()?.totalReports || 0) === 0) {
        <section class="data-state data-state--empty">
          <div class="data-state__main"><span class="data-state__icon"><i appIcon="bar-chart" aria-hidden="true"></i></span><p>FIRST MARKET SIGNAL</p><h2>Build the salary reference with us</h2><span>There are no published reports in this view yet. Add a structured, anonymous salary report to create the first benchmark.</span><div><a class="action action--primary" routerLink="/submit-report">Add the first report</a><a class="action" routerLink="/salary-reports">Browse all reports</a></div></div>
          <aside><strong>What the dashboard will reveal</strong><p>Every verified report improves the quality of the comparison.</p><ul><li><i appIcon="check" aria-hidden="true"></i> Discipline salary ranges</li><li><i appIcon="check" aria-hidden="true"></i> Seniority progression</li><li><i appIcon="check" aria-hidden="true"></i> Location and work-mode context</li></ul></aside>
        </section>
      } @else {

      <section class="snapshot" aria-label="Salary snapshot">
        <div class="snapshot__primary"><span>Average monthly net</span><strong>{{ money(summary()?.averageSalary) }}</strong><small>{{ summary()?.currency || 'EGP' }}</small></div>
        <dl><div><dt>Median</dt><dd>{{ money(summary()?.medianSalary) }} <small>{{ summary()?.currency || 'EGP' }}</small></dd></div><div><dt>Lowest reported</dt><dd>{{ money(summary()?.minSalary) }} <small>{{ summary()?.currency || 'EGP' }}</small></dd></div><div><dt>Highest reported</dt><dd>{{ money(summary()?.maxSalary) }} <small>{{ summary()?.currency || 'EGP' }}</small></dd></div><div><dt>Sample size</dt><dd>{{ summary()?.totalReports || 0 }} <small>reports</small></dd></div></dl>
      </section>

      <section class="analysis-grid">
        <article class="analysis analysis--discipline">
          <header><div><span>Salary by discipline</span><h2>Market comparison</h2></div><small>Average monthly net</small></header>
          @if (isLoading()) { <div class="loading-bars"><i></i><i></i><i></i><i></i><i></i></div> }
          @else if (summary()?.byDiscipline?.length) {
            <div class="discipline-chart">@for (item of summary()!.byDiscipline.slice(0, 7); track item.label; let index = $index) {
              <div class="discipline-row"><span class="discipline-row__index">{{ index + 1 }}</span><div class="discipline-row__name"><strong>{{ item.label }}</strong><small>{{ item.count }} reports</small></div><div class="track"><i [style.width.%]="barWidth(item.averageSalary, disciplineMax())"></i></div><b>{{ money(item.averageSalary) }}</b></div>
            }</div>
          } @else { <div class="empty"><i appIcon="bar-chart" aria-hidden="true"></i><strong>No discipline data yet</strong><p>Remove a filter or contribute the first report for this market lens.</p><a routerLink="/submit-report">Add a report</a></div> }
        </article>

        <article class="analysis analysis--seniority">
          <header><div><span>Salary progression</span><h2>Experience levels</h2></div><small>{{ summary()?.bySeniority?.length || 0 }} levels</small></header>
          @if (summary()?.bySeniority?.length) {
            <div class="seniority-chart">@for (item of summary()!.bySeniority.slice(0, 6); track item.label) { <div class="seniority-item"><div><strong>{{ item.label }}</strong><span>{{ item.count }} reports</span></div><b>{{ money(item.averageSalary) }} <small>{{ summary()?.currency || 'EGP' }}</small></b><div class="track"><i [style.width.%]="barWidth(item.averageSalary, seniorityMax())"></i></div></div> }</div>
          } @else { <div class="empty"><i appIcon="layers" aria-hidden="true"></i><strong>No seniority comparison yet</strong><p>Experience trends will appear when published data is available.</p></div> }
        </article>
      </section>

      <section class="recent">
        <header><div><span>Latest submissions</span><h2>Recent salary reports</h2></div><a routerLink="/salary-reports">Open report explorer <i appIcon="arrow-right" aria-hidden="true"></i></a></header>
        @if (latestReports().length) {
          <engineers-salary-reference-data-grid class="recent-grid" [data]="latestReports()" [columns]="reportColumns" [config]="reportGridConfig" />
        } @else if (!isLoading()) {
          <div class="empty empty--reports"><i appIcon="file-add" aria-hidden="true"></i><div><strong>No published reports yet</strong><p>Once a report is published, it will appear here using the shared reports grid.</p></div><a class="action action--primary" routerLink="/submit-report">Add first report</a></div>
        }
      </section>
      }
    </main>
    </engineers-salary-reference-page-design>
  `,
  styles: [`
    :host{display:block;min-height:100%;color:rgb(var(--fg));font-family:var(--app-font-family,Inter,"Segoe UI",sans-serif)}*{box-sizing:border-box}.market-dashboard{width:100%;padding:28px 32px 48px}.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:1px solid rgb(var(--border))}.page-head__meta{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:rgb(var(--muted));font-size:11px}.page-head__meta i{width:3px;height:3px;border-radius:50%;background:rgb(var(--primary))}.page-head h1{margin:0;font-size:28px;line-height:1.2;letter-spacing:-.025em}.page-head p{margin:7px 0 0;color:rgb(var(--muted));font-size:13px}.page-head__actions{display:flex;align-items:center;gap:8px}.action,.icon-action,.apply{height:40px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgb(var(--border));background:rgb(var(--panel));color:rgb(var(--fg));padding:0 14px;font:inherit;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer;transition:background .18s ease,border-color .18s ease}.action:hover,.icon-action:hover{border-color:rgb(var(--primary)/.6)}.action--primary,.apply{border-color:rgb(var(--primary));background:rgb(var(--primary));color:rgb(17 20 12)}.action i,.icon-action i{width:16px}.icon-action{width:40px;padding:0}.icon-action:disabled,.apply:disabled{opacity:.55;cursor:wait}.filter-strip{display:grid;grid-template-columns:minmax(165px,.8fr) repeat(3,minmax(160px,1fr)) auto;align-items:end;gap:12px;margin-top:16px;padding:14px 16px;border:1px solid rgb(var(--border));background:rgb(var(--panel))}.filter-strip__title{height:40px;display:flex;align-items:center;gap:10px}.filter-strip__title>i{width:17px;color:rgb(var(--primary))}.filter-strip__title div{display:grid;gap:2px}.filter-strip__title strong{font-size:12px}.filter-strip__title span,label>span{color:rgb(var(--muted));font-size:10px}label{display:grid;gap:6px;min-width:0}search-select{display:block;min-width:0}.apply{min-width:82px}.notice{display:flex;align-items:center;gap:10px;margin-top:12px;padding:11px 14px;border:1px solid rgb(205 74 74/.42);background:rgb(130 34 34/.12);color:rgb(235 134 134);font-size:12px}.notice i{width:16px}.notice span{flex:1}.notice button{border:0;background:transparent;color:inherit;font-weight:700;text-decoration:underline;cursor:pointer}.snapshot{display:grid;grid-template-columns:minmax(240px,.8fr) 2fr;margin-top:12px;border:1px solid rgb(var(--border));background:rgb(var(--panel))}.snapshot__primary{padding:22px 24px;border-inline-end:1px solid rgb(var(--border));background:rgb(var(--primary)/.07)}.snapshot__primary>span{display:block;color:rgb(var(--muted));font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.snapshot__primary strong{display:inline-block;margin-top:9px;font-size:34px;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.035em}.snapshot__primary small{margin-inline-start:7px;color:rgb(var(--primary));font-size:11px;font-weight:800}.snapshot dl{display:grid;grid-template-columns:repeat(4,1fr);margin:0}.snapshot dl>div{display:flex;flex-direction:column;justify-content:center;padding:16px 20px;border-inline-end:1px solid rgb(var(--border))}.snapshot dl>div:last-child{border:0}.snapshot dt{color:rgb(var(--muted));font-size:10px}.snapshot dd{margin:8px 0 0;font-size:17px;font-weight:750;font-variant-numeric:tabular-nums}.snapshot dd small{color:rgb(var(--muted));font-size:9px;font-weight:500}.analysis-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.85fr);gap:12px;margin-top:12px}.analysis{min-height:340px;padding:20px;border:1px solid rgb(var(--border));background:rgb(var(--panel))}.analysis>header,.recent>header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:15px;border-bottom:1px solid rgb(var(--border)/.75)}.analysis>header span,.recent>header span{color:rgb(var(--primary));font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em}.analysis h2,.recent h2{margin:5px 0 0;font-size:16px}.analysis>header>small{color:rgb(var(--muted));font-size:9px}.discipline-chart{display:grid;gap:17px;padding-top:20px}.discipline-row{display:grid;grid-template-columns:20px minmax(120px,.75fr) minmax(100px,1.4fr) 72px;align-items:center;gap:12px}.discipline-row__index{color:rgb(var(--muted));font-size:9px}.discipline-row__name{display:grid;gap:2px;min-width:0}.discipline-row__name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.discipline-row__name small{color:rgb(var(--muted));font-size:9px}.track{height:6px;background:rgb(var(--bg));overflow:hidden}.track i{display:block;height:100%;background:rgb(var(--primary));transition:width .22s cubic-bezier(.22,1,.36,1)}.discipline-row>b{font-size:11px;text-align:end;font-variant-numeric:tabular-nums}.seniority-chart{display:grid;padding-top:7px}.seniority-item{display:grid;grid-template-columns:1fr auto;gap:8px;padding:13px 0;border-bottom:1px solid rgb(var(--border)/.65)}.seniority-item:last-child{border:0}.seniority-item>div:first-child{display:grid;gap:3px}.seniority-item strong{font-size:11px}.seniority-item span{color:rgb(var(--muted));font-size:9px}.seniority-item>b{font-size:11px;font-variant-numeric:tabular-nums}.seniority-item>b small{color:rgb(var(--muted));font-size:8px}.seniority-item .track{grid-column:1/-1;height:4px}.empty{min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.empty>i{width:22px;color:rgb(var(--muted))}.empty strong{margin-top:13px;font-size:12px}.empty p{max-width:330px;margin:6px 0 0;color:rgb(var(--muted));font-size:10px;line-height:1.6}.empty>a:not(.action){margin-top:12px;color:rgb(var(--primary));font-size:10px;font-weight:700}.loading-bars{display:grid;gap:19px;padding-top:22px}.loading-bars i{height:25px;background:linear-gradient(90deg,rgb(var(--bg)),rgb(var(--border)),rgb(var(--bg)));background-size:200% 100%;animation:shimmer 1.2s infinite}.recent{margin-top:28px}.recent>header{align-items:flex-end;margin-bottom:10px;border:0;padding:0}.recent>header>a{display:flex;align-items:center;gap:7px;color:rgb(var(--primary));font-size:11px;font-weight:700;text-decoration:none}.recent>header>a i{width:14px}.recent-grid{display:block;min-height:260px;border:1px solid rgb(var(--border))}.empty--reports{min-height:180px;flex-direction:row;justify-content:flex-start;gap:14px;padding:24px;border:1px solid rgb(var(--border));text-align:start}.empty--reports>div{flex:1}.empty--reports strong{margin:0}.empty--reports p{margin-top:4px}.empty--reports .action{margin:0}.action:focus-visible,.icon-action:focus-visible,.apply:focus-visible,a:focus-visible{outline:2px solid rgb(var(--primary));outline-offset:2px}@keyframes shimmer{to{background-position:-200% 0}}
    @media(max-width:1100px){.filter-strip{grid-template-columns:repeat(3,1fr)}.filter-strip__title{grid-column:1/-1}.snapshot{grid-template-columns:1fr}.snapshot__primary{border-inline-end:0;border-bottom:1px solid rgb(var(--border))}.analysis-grid{grid-template-columns:1fr}.analysis{min-height:320px}}@media(max-width:720px){.market-dashboard{padding:20px 14px 36px}.page-head{align-items:flex-start}.page-head p{max-width:360px}.page-head__actions .action--quiet{display:none}.filter-strip{grid-template-columns:1fr 1fr}.filter-strip__title{grid-column:1/-1}.filter-strip label:first-of-type{grid-column:1/-1}.snapshot dl{grid-template-columns:repeat(2,1fr)}.snapshot dl>div:nth-child(2){border-inline-end:0}.snapshot dl>div:nth-child(-n+2){border-bottom:1px solid rgb(var(--border))}.discipline-row{grid-template-columns:18px 1fr auto}.discipline-row .track{grid-column:2/-1}.empty--reports{align-items:flex-start;flex-wrap:wrap}}@media(max-width:480px){.page-head{display:block}.page-head__actions{margin-top:18px}.page-head__actions .action--primary{flex:1}.filter-strip{grid-template-columns:1fr}.filter-strip__title,.filter-strip label:first-of-type{grid-column:auto}.snapshot dl{grid-template-columns:1fr 1fr}.analysis{padding:16px}.empty--reports .action{width:100%}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:1ms!important;transition-duration:1ms!important}}
  `, `
    :host{display:flex;flex:1 1 auto;min-width:0;min-height:0;height:100%}.salary-dashboard-design{display:flex;flex:1 1 auto;min-width:0;min-height:0;height:100%}.dashboard-toolbar-context{display:flex;align-items:center;gap:10px;white-space:nowrap}.dashboard-toolbar-context span{color:rgb(var(--primary));font-size:11px;font-weight:800;letter-spacing:.08em}.dashboard-toolbar-context strong{font-size:13px}.dashboard-toolbar-context small{padding-inline-start:10px;border-inline-start:1px solid rgb(var(--border));color:rgb(var(--muted));font-size:11px}.dashboard-toolbar-actions{display:flex;align-items:center;gap:8px}.dashboard-toolbar-actions i{width:15px}.dashboard-intro{margin-bottom:18px}.dashboard-intro span{color:rgb(var(--primary));font-size:11px;font-weight:800;letter-spacing:.1em}.dashboard-intro h1{margin:5px 0 0;font-size:30px;line-height:1.15;letter-spacing:-.025em}.dashboard-intro p{max-width:560px;margin:7px 0 0;color:rgb(var(--muted));font-size:14px;line-height:1.55}.filter-strip__title span,label>span,.snapshot dt,.analysis>header>small,.discipline-row__name small,.seniority-item span,.empty p{font-size:11px}.discipline-row__name strong,.discipline-row>b,.seniority-item strong,.seniority-item>b,.empty strong{font-size:13px}.analysis h2,.recent h2{font-size:18px}.data-state{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);min-height:360px;margin-top:14px;border:1px solid rgb(var(--border));background:rgb(var(--panel))}.data-state__main{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:42px 48px}.data-state__icon{display:grid;width:44px;height:44px;place-items:center;border:1px solid rgb(var(--border));background:rgb(var(--bg));color:rgb(var(--primary))}.data-state__icon i{width:20px}.data-state__main>p{margin:18px 0 0;color:rgb(var(--primary));font-size:11px;font-weight:800;letter-spacing:.1em}.data-state h2{max-width:560px;margin:7px 0 0;font-size:26px;line-height:1.2;letter-spacing:-.025em}.data-state__main>span:not(.data-state__icon){max-width:610px;margin-top:10px;color:rgb(var(--muted));font-size:14px;line-height:1.65}.data-state__error{text-align:start;direction:rtl}.data-state__main>div{display:flex;gap:8px;margin-top:22px}.data-state aside{display:flex;flex-direction:column;justify-content:center;padding:36px;border-inline-start:1px solid rgb(var(--border));background:rgb(var(--bg)/.45)}.data-state aside>strong{font-size:15px}.data-state aside>p{margin:7px 0 0;color:rgb(var(--muted));font-size:12px;line-height:1.55}.data-state ul{display:grid;gap:13px;margin:24px 0 0;padding:0;list-style:none}.data-state li{display:flex;align-items:center;gap:10px;color:rgb(var(--muted));font-size:12px}.data-state li i{width:15px;color:rgb(var(--primary))}@media(max-width:820px){.data-state{grid-template-columns:1fr}.data-state aside{border-inline-start:0;border-top:1px solid rgb(var(--border))}.data-state__main{padding:32px 26px}.data-state aside{padding:26px}.data-state h2{font-size:24px}}@media(max-width:720px){.dashboard-toolbar-context small{display:none}}
  `]
})
export class DashboardFeaturePageComponent {
  private readonly salaryDashboard = inject(SalaryDashboardPort);
  readonly summary = signal<SalaryDashboardSummary | null>(null);
  readonly latestReports = signal<SalaryDashboardReportPreview[]>([]);
  readonly options = signal<SalaryDashboardOptions>({ disciplines: [], seniorities: [], workModes: [], currencies: [] });
  readonly isLoading = signal(true); readonly errorMessage = signal('');
  readonly discipline = signal(''); readonly seniority = signal(''); readonly workMode = signal('');
  readonly disciplineMax = computed(() => Math.max(...(this.summary()?.byDiscipline.map(item => item.averageSalary) ?? [1]), 1));
  readonly seniorityMax = computed(() => Math.max(...(this.summary()?.bySeniority.map(item => item.averageSalary) ?? [1]), 1));
  readonly reportColumns: GridColumn<SalaryDashboardReportPreview>[] = [
    { field: 'roleTitle', header: 'Role', minWidth: 180, fillRemaining: true, sortable: true, filterable: true },
    { field: 'discipline', header: 'Discipline', width: 170, sortable: true, filterable: true },
    { field: 'seniority', header: 'Seniority', width: 130, sortable: true, filterable: true },
    { field: 'city', header: 'Location', width: 130, sortable: true, filterable: true },
    { field: 'workMode', header: 'Work mode', width: 120, sortable: true, filterable: true },
    { field: 'monthlyNetSalary', header: 'Monthly net', width: 150, type: 'number', align: 'right', sortable: true, format: value => this.money(Number(value)) }
  ];
  readonly reportGridConfig: GridConfig = { simpleMode: true, density: 'compact', pagination: false };
  constructor() { this.refresh(); }
  setDiscipline(value: string): void { this.discipline.set(value); }
  setSeniority(value: string): void { this.seniority.set(value); }
  setWorkMode(value: string): void { this.workMode.set(value); }
  refresh(): void {
    this.isLoading.set(true); this.errorMessage.set('');
    const filters = { discipline: this.discipline() || undefined, experience: this.seniority() || undefined, workMode: this.workMode() || undefined };
    this.salaryDashboard.loadSnapshot(filters).pipe(catchError(() => { this.errorMessage.set('تعذر تحميل بيانات الرواتب. تحقق من اتصال الخادم ثم أعد المحاولة.'); return of(null); })).subscribe(snapshot => {
      if (snapshot) { this.summary.set(snapshot.summary); this.latestReports.set(snapshot.latestReports); this.options.set(snapshot.options); }
      this.isLoading.set(false);
    });
  }
  money(value: number | null | undefined): string { return value == null || value === 0 ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value); }
  barWidth(value: number, max: number): number { return Math.max(5, Math.min(100, (value / max) * 100)); }
}
