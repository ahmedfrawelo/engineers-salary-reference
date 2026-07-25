import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { SalaryDashboardPort } from '../../application/salary-dashboard.port';
import type { SalaryDashboardOptions, SalaryDashboardReportPreview, SalaryDashboardSummary } from '../../domain/salary-dashboard.models';
import { SalaryReportsPort } from '../../../salary-reports/application/ports/salary-reports.port';
import type { SalaryReportDetail } from '../../../salary-reports/domain/salary-report.models';
import { SearchSelectComponent } from '../../../../shared/ui/search-select.component';
import { AppIconDirective } from '../../../../shared/icons/app-icon.directive';
import { PageDesignComponent } from '../../../../shared/ui/page-design';
import { OverlayPanelComponent } from '../../../../shared/ui/overlay-panel.component';

@Component({
  selector: 'feature-dashboard-page',
  standalone: true,
  imports: [RouterLink, SearchSelectComponent, AppIconDirective, PageDesignComponent, OverlayPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <engineers-salary-reference-page-design
      class="salary-dashboard-design"
      title="Dashboard"
      sub="Engineering salary market intelligence"
      icon="nav-dashboard"
      [hideHeader]="true"
      [sharedToolbarShowCustomize]="false"
      toolbarAriaLabel="Dashboard actions"
    >
      <main page-table class="market-dashboard" aria-labelledby="dashboard-title">
        <section class="dashboard-bento" aria-label="Dashboard bento overview">
          <article class="bento-tile bento-tile--hero">
            <span class="eyebrow">Salary intelligence</span>
            <h1 id="dashboard-title">Egypt engineering market dashboard</h1>
            <p>
              Live salary benchmarks built from published engineering reports. Compare pay by
              discipline, experience, location, and work setup before accepting your next offer.
            </p>
            <div class="hero-actions">
              <a class="dash-button dash-button--ghost" routerLink="/salary-reports">View reports</a>
              <a class="dash-button dash-button--primary" routerLink="/submit-report">
                <i appIcon="plus" aria-hidden="true"></i>
                <span>Submit report</span>
              </a>
            </div>
          </article>
        </section>

        <section class="dashboard-bento dashboard-bento--filters" aria-label="Market filters">
          <div class="bento-tile filter-strip__title">
            <i appIcon="funnel" aria-hidden="true"></i>
            <div>
              <strong>Market filters</strong>
              <span>Updates automatically after each selection</span>
            </div>
          </div>

          <label class="bento-tile filter-field">
            <span>Discipline</span>
            <search-select
              [options]="options().disciplines"
              [value]="discipline() || null"
              (valueChange)="setDiscipline($event || '')"
              placeholder="All disciplines"
              [allowClear]="true"
              [allowInlineSearch]="true"
              [overlayMinWidth]="420"
              overlayPanelClass="dashboard-filter-select-overlay"
            />
          </label>

          <label class="bento-tile filter-field">
            <span>Experience</span>
            <search-select
              [options]="options().seniorities"
              [value]="seniority() || null"
              (valueChange)="setSeniority($event || '')"
              placeholder="All levels"
              [allowClear]="true"
              [allowInlineSearch]="true"
              [overlayMinWidth]="340"
              overlayPanelClass="dashboard-filter-select-overlay"
            />
          </label>

          <label class="bento-tile filter-field">
            <span>Work mode</span>
            <search-select
              [options]="options().workModes"
              [value]="workMode() || null"
              (valueChange)="setWorkMode($event || '')"
              placeholder="All modes"
              [allowClear]="true"
              [allowInlineSearch]="true"
              [overlayMinWidth]="340"
              overlayPanelClass="dashboard-filter-select-overlay"
            />
          </label>
        </section>

        @if (errorMessage()) {
          <section class="data-state" role="alert">
            <div>
              <span class="data-state__icon"><i appIcon="cloud-off" aria-hidden="true"></i></span>
              <p>Data connection</p>
              <h2>Market data is temporarily unavailable</h2>
              <small>{{ errorMessage() }}</small>
              <button class="dash-button dash-button--primary" type="button" (click)="refresh()">Try again</button>
            </div>
          </section>
        } @else if (!isLoading() && (summary()?.totalReports || 0) === 0) {
          <section class="data-state data-state--empty">
            <div>
              <span class="data-state__icon"><i appIcon="bar-chart" aria-hidden="true"></i></span>
              <p>First market signal</p>
              <h2>No published reports in this view yet</h2>
              <small>Remove a filter or submit a structured salary report to create the first benchmark.</small>
              <a class="dash-button dash-button--primary" routerLink="/submit-report">Submit first report</a>
            </div>
          </section>
        } @else {
          <section class="bento-analysis-grid">
            <article class="bento-tile analysis-panel analysis-panel--wide">
              <header>
                <div>
                  <span>Market comparison</span>
                  <h2>Salary by discipline</h2>
                </div>
                <small>Average monthly net</small>
              </header>

              @if (isLoading()) {
                <div class="loading-bars"><i></i><i></i><i></i><i></i><i></i></div>
              } @else if (summary()?.byDiscipline?.length) {
                <div class="bar-list">
                  @for (item of summary()!.byDiscipline.slice(0, 8); track item.label; let index = $index) {
                    <div class="bar-row">
                      <span class="rank">{{ twoDigits(index + 1) }}</span>
                      <div class="bar-name">
                        <strong>{{ item.label }}</strong>
                        <small>{{ item.count }} reports</small>
                      </div>
                      <div class="track"><i [style.width.%]="barWidth(item.averageSalary, disciplineMax())"></i></div>
                      <b>{{ money(item.averageSalary) }}</b>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-panel">
                  <i appIcon="bar-chart" aria-hidden="true"></i>
                  <strong>No discipline data yet</strong>
                  <p>Try removing a filter or adding a report.</p>
                </div>
              }
            </article>

            <article class="bento-tile analysis-panel">
              <header>
                <div>
                  <span>Experience levels</span>
                  <h2>Pay progression</h2>
                </div>
                <small>{{ summary()?.bySeniority?.length || 0 }} groups</small>
              </header>

              @if (summary()?.bySeniority?.length) {
                <div class="level-list">
                  @for (item of summary()!.bySeniority.slice(0, 7); track item.label) {
                    <div class="level-item">
                      <div>
                        <strong>{{ item.label }}</strong>
                        <span>{{ item.count }} reports</span>
                      </div>
                      <b>{{ money(item.averageSalary) }}</b>
                      <div class="track"><i [style.width.%]="barWidth(item.averageSalary, seniorityMax())"></i></div>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-panel">
                  <i appIcon="layers" aria-hidden="true"></i>
                  <strong>No experience comparison yet</strong>
                  <p>Progression appears when matching reports exist.</p>
                </div>
              }
            </article>
          </section>

          <section class="bento-tile recent-panel">
            <header>
              <div>
                <span>Latest submissions</span>
                <h2>Recent salary reports</h2>
              </div>
              <a routerLink="/salary-reports">
                Open report explorer
                <i appIcon="arrow-right" aria-hidden="true"></i>
              </a>
            </header>

            @if (latestReports().length) {
              <div class="recent-list" aria-label="Recent salary report list">
                @for (report of latestReports(); track report.id) {
                  <button class="recent-item" type="button" (click)="openRecentReport(report)">
                    <span class="recent-item__icon"><i appIcon="cash-stack" aria-hidden="true"></i></span>
                    <span class="recent-item__main">
                      <strong>{{ report.discipline || 'Engineering role' }}</strong>
                      <small>{{ report.city || 'Egypt' }} / {{ report.workMode || 'Work mode not specified' }} / {{ report.seniority }}</small>
                      <small>Submitted {{ value(report.submittedAt) }}</small>
                    </span>
                    <span class="recent-item__salary">
                      <b>{{ money(report.monthlyNetSalary) }}</b>
                      <small>{{ report.currency || 'EGP' }}</small>
                    </span>
                  </button>
                }
              </div>
            } @else if (!isLoading()) {
              <div class="empty-panel empty-panel--row">
                <i appIcon="file-add" aria-hidden="true"></i>
                <div>
                  <strong>No recent reports yet</strong>
                  <p>Published reports will appear here.</p>
                </div>
                <a class="dash-button dash-button--primary" routerLink="/submit-report">Submit report</a>
              </div>
            }
          </section>
        }

        @if (selectedReport(); as report) {
          <overlay-panel
            [open]="true"
            title="Salary report"
            [showHeader]="false"
            [draggable]="false"
            [autoFitContent]="false"
            [minWidth]="320"
            [maxWidth]="620"
            [maxHeight]="680"
            [fitRatioWDesktop]="0.42"
            [fitRatioHDesktop]="0.78"
            [fitRatioWMobile]="0.94"
            [fitRatioHMobile]="0.9"
            (closed)="closeRecentReport()"
          >
            <article class="report-sheet">
              @if (selectedReportLoading()) {
                <p class="report-sheet__loading">Loading full report...</p>
              }

              @if (selectedReportError()) {
                <p class="report-sheet__error">{{ selectedReportError() }}</p>
              }

              @let item = selectedReportDetail() || report;
              <div class="report-sheet__grid">
                <header class="report-card report-card--hero">
                  <span class="report-card__eyebrow">Recent report</span>
                  <h2>{{ item.discipline || 'Engineering role' }}</h2>
                  <p>{{ item.city || 'Egypt' }} / {{ item.workMode || 'Work mode not specified' }} / {{ experienceLabel(item) }}</p>
                </header>

                <section class="report-card report-card--salary" aria-label="Monthly net salary">
                  <span><i appIcon="cash-stack" aria-hidden="true"></i> Monthly net</span>
                  <strong>{{ money(item.monthlyNetSalary) }}</strong>
                  <small>{{ item.currency || 'EGP' }}</small>
                </section>

                <dl class="report-card report-card--role">
                  <div class="report-card__title"><i appIcon="briefcase" aria-hidden="true"></i><span>Role setup</span></div>
                  <div class="report-field"><dt>Discipline</dt><dd>{{ item.discipline || 'Not specified' }}</dd></div>
                  <div class="report-field"><dt>Experience</dt><dd>{{ experienceLabel(item) }}</dd></div>
                  <div class="report-field"><dt>Company type</dt><dd>{{ value($any(item).companyType || $any(item).companyName) }}</dd></div>
                  <div class="report-field"><dt>Work mode</dt><dd>{{ item.workMode || 'Not specified' }}</dd></div>
                </dl>

                <dl class="report-card report-card--location">
                  <div class="report-card__title"><i appIcon="calendar3" aria-hidden="true"></i><span>Location</span></div>
                  <div class="report-field"><dt>Country</dt><dd>{{ value($any(item).country) }}</dd></div>
                  <div class="report-field"><dt>City</dt><dd>{{ item.city || 'Not specified' }}</dd></div>
                  <div class="report-field report-field--wide"><dt>Submitted</dt><dd>{{ value($any(item).submittedAt) }}</dd></div>
                </dl>

                <dl class="report-card report-card--package">
                  <div class="report-card__title"><i appIcon="gem" aria-hidden="true"></i><span>Package details</span></div>
                  <div class="report-field"><dt>Housing</dt><dd>{{ value($any(item).housingProvided) }}</dd></div>
                  <div class="report-field"><dt>Transport</dt><dd>{{ value($any(item).transportationProvided) }}</dd></div>
                  <div class="report-field"><dt>Annual bonus</dt><dd>{{ value($any(item).annualBonus) }}</dd></div>
                  <div class="report-field"><dt>Extra day off</dt><dd>{{ value($any(item).extraDayOff) }}</dd></div>
                  <div class="report-field report-field--wide"><dt>Daily work hours</dt><dd>{{ value($any(item).dailyWorkHours) }}</dd></div>
                </dl>

                <dl class="report-card report-card--signal">
                  <div class="report-card__title"><i appIcon="award" aria-hidden="true"></i><span>Career signal</span></div>
                  <div class="report-field"><dt>Feels fair</dt><dd>{{ value($any(item).salaryFairness) }}</dd></div>
                  <div class="report-field"><dt>Recommend field</dt><dd>{{ value($any(item).recommendField) }}</dd></div>
                  <div class="report-field"><dt>Certificate</dt><dd>{{ value($any(item).professionalCertificate) }}</dd></div>
                  <div class="report-field"><dt>Education</dt><dd>{{ value($any(item).highestEducation) }}</dd></div>
                </dl>

                <section class="report-card report-card--note">
                  <div class="report-card__title"><i appIcon="home" aria-hidden="true"></i><span>Benefits</span></div>
                  <p>{{ value($any(item).benefits) }}</p>
                </section>

                <section class="report-card report-card--note report-card--advice">
                  <div class="report-card__title"><i appIcon="truck" aria-hidden="true"></i><span>Negotiation advice</span></div>
                  <p>{{ value($any(item).negotiationAdvice) }}</p>
                </section>
              </div>

            </article>
          </overlay-panel>
        }
      </main>
    </engineers-salary-reference-page-design>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
      color: rgb(var(--fg));
      font-family: var(--app-font-family, Inter, "Segoe UI", sans-serif);
    }

    :host ::ng-deep engineers-salary-reference-page-design {
      display: flex !important;
      flex: 1 1 auto !important;
      flex-direction: column !important;
      width: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      background: rgb(var(--bg)) !important;
      overflow: hidden !important;
      height: 100% !important;
      max-height: 100% !important;
    }

    :host ::ng-deep engineers-salary-reference-page-design .table-area {
      display: flex !important;
      flex: 1 1 auto !important;
      width: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      height: 100% !important;
      max-height: 100% !important;
      position: relative !important;
      overflow: hidden !important;
    }

    :host ::ng-deep engineers-salary-reference-page-design.salary-dashboard-design .wsh__toolbar {
      display: none !important;
    }

    * {
      box-sizing: border-box;
    }

    .market-dashboard {
      --dashboard-radius: 18px;
      --dashboard-tile-bg: rgb(var(--panel));
      --dashboard-tile-bg-raised: color-mix(in oklab, rgb(var(--panel)) 92%, rgb(var(--fg)) 8%);
      --dashboard-tile-bg-soft: color-mix(in oklab, rgb(var(--panel)) 88%, rgb(var(--bg)) 12%);
    }

    .hero-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 16px;
    }

    .market-dashboard {
      position: absolute;
      inset: 0;
      width: auto;
      min-width: 0;
      min-height: 0;
      height: auto;
      overflow-x: hidden;
      overflow-y: scroll;
      scrollbar-gutter: stable;
      padding: 14px 16px 20px;
      background:
        radial-gradient(circle at 18% 0%, rgb(var(--primary) / 0.08), transparent 28%),
        linear-gradient(180deg, rgb(var(--bg)) 0%, color-mix(in oklab, rgb(var(--bg)) 94%, black 6%) 100%);
    }

    .dashboard-bento {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-auto-rows: minmax(88px, auto);
      gap: 8px;
      width: 100%;
      min-width: 0;
    }

    .dashboard-bento--filters {
      grid-template-columns: minmax(150px, 0.72fr) minmax(0, 1.34fr) minmax(0, 1fr) minmax(0, 1fr);
      grid-auto-rows: minmax(72px, auto);
      margin-top: 8px;
    }

    .bento-tile {
      position: relative;
      min-width: 0;
      overflow: hidden;
      border: 1px solid rgb(var(--border) / 0.78);
      border-radius: var(--dashboard-radius);
      background:
        linear-gradient(180deg, var(--dashboard-tile-bg-raised), var(--dashboard-tile-bg)),
        var(--dashboard-tile-bg);
      box-shadow: inset 0 1px 0 rgb(var(--fg) / 0.035);
    }

    .bento-tile--hero {
      grid-column: 1 / -1;
      grid-row: auto;
      min-height: 154px;
      padding: 18px 20px;
      background:
        radial-gradient(circle at 5% 10%, rgb(var(--primary) / 0.15), transparent 32%),
        linear-gradient(135deg, var(--dashboard-tile-bg-raised) 0%, var(--dashboard-tile-bg-soft) 100%);
    }

    .eyebrow,
    .filter-strip__title strong,
    label > span,
    .analysis-panel header span,
    .recent-panel header span,
    .data-state p {
      color: rgb(var(--primary));
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .bento-tile--hero h1 {
      max-width: 1040px;
      margin: 9px 0 0;
      font-size: clamp(25px, 2.85vw, 40px);
      line-height: 0.96;
      letter-spacing: -0.055em;
    }

    .bento-tile--hero p {
      max-width: 720px;
      margin: 12px 0 0;
      color: rgb(var(--muted));
      font-size: 12px;
      line-height: 1.62;
    }

    .dash-button {
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid rgb(var(--border));
      border-radius: 10px;
      background: rgb(var(--panel));
      color: rgb(var(--fg));
      padding: 0 11px;
      font: inherit;
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
    }

    .dash-button:hover {
      transform: translateY(-1px);
      border-color: rgb(var(--primary) / 0.56);
    }

    .dash-button--primary {
      border-color: rgb(var(--primary));
      background: rgb(var(--primary));
      color: rgb(var(--primary-contrast, 17 20 13));
    }

    .dash-button--ghost {
      background: rgb(var(--bg) / 0.65);
      color: rgb(var(--fg) / 0.8);
    }

    .dash-button i {
      width: 14px;
    }

    .dash-button:disabled {
      opacity: 0.55;
      cursor: wait;
      transform: none;
    }

    .filter-strip__title {
      grid-column: span 1;
      min-height: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
    }

    .filter-strip__title > i {
      width: 17px;
      color: rgb(var(--primary));
    }

    .filter-strip__title div,
    label {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .filter-field {
      grid-column: span 1;
      justify-content: center;
      padding: 10px;
    }

    .filter-strip__title span {
      color: rgb(var(--muted));
      font-size: 11px;
      letter-spacing: 0;
      text-transform: none;
      font-weight: 600;
    }

    label > span {
      color: rgb(var(--fg) / 0.86);
      letter-spacing: 0;
      text-transform: none;
      font-size: 11px;
    }

    search-select {
      display: block;
      min-width: 0;
      width: 100%;
    }

    :host ::ng-deep .dashboard-bento--filters search-select .search-select-trigger,
    :host ::ng-deep .dashboard-bento--filters search-select button {
      min-height: 32px !important;
      height: 32px !important;
      border-radius: 8px !important;
      font-size: 11px !important;
      width: 100% !important;
    }

    ::ng-deep .dashboard-filter-select-overlay,
    ::ng-deep .dashboard-filter-select-overlay .ss-panel,
    ::ng-deep .dashboard-filter-select-overlay .ss-list {
      max-width: min(520px, calc(100vw - 40px)) !important;
      overflow-x: hidden !important;
    }

    ::ng-deep .dashboard-filter-select-overlay .ss-item,
    ::ng-deep .dashboard-filter-select-overlay .ss-label,
    ::ng-deep .dashboard-filter-select-overlay .ss-inline-input {
      min-width: 0 !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
    }

    .bento-tile--accent {
      background:
        linear-gradient(135deg, rgb(var(--primary) / 0.18), transparent 64%),
        var(--dashboard-tile-bg-raised);
    }

    .bento-analysis-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(260px, 0.85fr);
      gap: 8px;
      margin-top: 8px;
      min-width: 0;
    }

    .analysis-panel,
    .recent-panel {
      min-width: 0;
    }

    .analysis-panel {
      min-height: 290px;
      padding: 14px;
    }

    .analysis-panel header,
    .recent-panel header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgb(var(--border) / 0.58);
    }

    .analysis-panel h2,
    .recent-panel h2 {
      margin: 5px 0 0;
      font-size: 16px;
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .analysis-panel header small {
      color: rgb(var(--muted));
      font-size: 11px;
      font-weight: 700;
    }

    .bar-list {
      display: grid;
      gap: 13px;
      padding-top: 15px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 26px minmax(120px, 0.75fr) minmax(120px, 1.4fr) 82px;
      align-items: center;
      gap: 11px;
    }

    .rank {
      color: rgb(var(--primary));
      font-size: 11px;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
    }

    .bar-name {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .bar-name strong,
    .level-item strong {
      overflow: hidden;
      color: rgb(var(--fg) / 0.92);
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar-name small,
    .level-item span {
      color: rgb(var(--muted));
      font-size: 11px;
    }

    .track {
      height: 7px;
      overflow: hidden;
      border-radius: 999px;
      background: rgb(var(--bg));
    }

    .track i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgb(var(--primary)), color-mix(in oklab, rgb(var(--primary)) 72%, white 28%));
      transition: width 0.22s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .bar-row b,
    .level-item b {
      color: rgb(var(--fg));
      font-size: 12px;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }

    .level-list {
      display: grid;
      padding-top: 5px;
    }

    .level-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      padding: 12px 0;
      border-bottom: 1px solid rgb(var(--border) / 0.52);
    }

    .level-item:last-child {
      border-bottom: 0;
    }

    .level-item > div {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .level-item .track {
      grid-column: 1 / -1;
      height: 5px;
    }

    .recent-panel {
      margin-top: 8px;
      padding: 14px;
    }

    .recent-panel header {
      align-items: flex-end;
      margin-bottom: 12px;
      padding-bottom: 0;
      border-bottom: 0;
    }

    .recent-panel header a {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: rgb(var(--primary));
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
    }

    .recent-panel header a i {
      width: 14px;
    }

    .recent-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      min-width: 0;
    }

    .recent-item {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      min-width: 0;
      min-height: 56px;
      padding: 9px;
      border: 1px solid rgb(var(--border) / 0.7);
      border-radius: var(--dashboard-radius);
      background: var(--dashboard-tile-bg-soft);
      color: rgb(var(--fg));
      font: inherit;
      text-align: start;
      text-decoration: none;
      cursor: pointer;
      transition: border-color 0.16s ease, transform 0.16s ease, background 0.16s ease;
    }

    .recent-item:hover {
      transform: translateY(-1px);
      border-color: rgb(var(--primary) / 0.48);
      background: var(--dashboard-tile-bg-raised);
    }

    .recent-item__icon {
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border-radius: 12px;
      background: rgb(var(--primary) / 0.12);
      color: rgb(var(--primary));
    }

    .recent-item__icon i {
      width: 15px;
    }

    .recent-item__main,
    .recent-item__salary {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .recent-item__main strong {
      overflow: hidden;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .recent-item__main small,
    .recent-item__salary small {
      color: rgb(var(--muted));
      font-size: 10px;
    }

    .recent-item__salary {
      justify-items: end;
      font-variant-numeric: tabular-nums;
    }

    .recent-item__salary b {
      font-size: 13px;
    }

    .report-sheet {
      --report-accent: rgb(var(--primary));
      --report-accent-soft: rgb(var(--primary) / 0.14);
      display: block;
      min-width: 0;
      padding: 10px;
      overflow: hidden;
    }

    .report-sheet h2,
    .report-sheet p,
    .report-sheet dl {
      margin: 0;
    }

    .report-sheet__grid {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
      gap: 8px;
      min-width: 0;
    }

    .report-card {
      position: relative;
      display: grid;
      min-width: 0;
      gap: 7px;
      padding: 10px;
      overflow: hidden;
      border: 1px solid rgb(var(--border) / 0.72);
      border-radius: 16px;
      background:
        linear-gradient(135deg, rgb(var(--panel)) 0%, rgb(var(--bg)) 100%),
        rgb(var(--panel));
      box-shadow: 0 12px 32px rgb(0 0 0 / 0.2);
      animation: reportCardIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        background 180ms ease;
    }

    .report-card:hover {
      transform: translateY(-1px);
      border-color: rgb(var(--primary) / 0.42);
      background:
        linear-gradient(135deg, rgb(var(--panel)) 0%, rgb(var(--primary) / 0.055) 100%),
        rgb(var(--panel));
    }

    .report-card::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(circle at 12% 0%, rgb(var(--primary) / 0.16), transparent 36%);
      opacity: 0.72;
    }

    .report-card > * {
      position: relative;
      z-index: 1;
    }

    .report-card--hero {
      grid-column: span 1;
      min-height: 116px;
      align-content: end;
      background:
        linear-gradient(145deg, rgb(var(--primary) / 0.2), rgb(var(--panel)) 58%),
        rgb(var(--panel));
    }

    .report-card--salary {
      align-content: space-between;
      min-height: 116px;
      border-color: rgb(var(--primary) / 0.35);
      background:
        radial-gradient(circle at 80% 18%, rgb(var(--primary) / 0.32), transparent 38%),
        linear-gradient(145deg, rgb(var(--panel)), rgb(var(--primary) / 0.13));
    }

    .report-card__eyebrow,
    .report-card--salary span,
    .report-card__title,
    .report-field dt {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .report-card__eyebrow {
      width: max-content;
      padding: 5px 7px;
      border: 1px solid rgb(var(--primary) / 0.36);
      border-radius: 999px;
      color: var(--report-accent);
      background: var(--report-accent-soft);
    }

    .report-card--hero h2 {
      font-size: 18px;
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .report-card--hero p,
    .report-card--note p {
      color: rgb(var(--muted));
      font-size: 10px;
      line-height: 1.35;
    }

    .report-card--salary span,
    .report-card__title {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: rgb(var(--muted));
    }

    .report-card--salary i,
    .report-card__title i {
      width: 15px;
      height: 15px;
      color: var(--report-accent);
    }

    .report-card--salary strong {
      color: rgb(var(--text));
      font-size: clamp(24px, 4vw, 36px);
      line-height: 0.88;
      letter-spacing: -0.045em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    .report-card--salary small {
      width: max-content;
      padding: 5px 8px;
      border-radius: 999px;
      color: rgb(var(--primary));
      background: rgb(var(--primary) / 0.14);
      font-size: 10px;
      font-weight: 900;
    }

    .report-card--role,
    .report-card--location,
    .report-card--package,
    .report-card--signal {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }

    .report-card--package,
    .report-card--signal,
    .report-card--note {
      animation-delay: 45ms;
    }

    .report-card--note {
      grid-column: span 1;
      align-content: start;
      min-height: 86px;
    }

    .report-card__title {
      grid-column: 1 / -1;
      margin-bottom: 1px;
      color: rgb(var(--text));
    }

    .report-field {
      min-width: 0;
      padding: 8px;
      border: 1px solid rgb(var(--border) / 0.46);
      border-radius: 12px;
      background: rgb(var(--bg) / 0.38);
    }

    .report-field--wide {
      grid-column: 1 / -1;
    }

    .report-field dt {
      color: rgb(var(--muted));
      letter-spacing: 0.08em;
    }

    .report-field dd {
      margin: 4px 0 0;
      overflow-wrap: anywhere;
      color: rgb(var(--text));
      font-size: 12px;
      font-weight: 800;
      line-height: 1.35;
    }

    .report-sheet__loading,
    .report-sheet__error {
      margin-bottom: 8px;
      padding: 9px 10px;
      border-radius: 12px;
      background: rgb(var(--primary) / 0.1);
      color: rgb(var(--primary));
      font-size: 11px;
      font-weight: 800;
    }

    .report-sheet__error {
      background: rgb(248 113 113 / 0.12);
      color: rgb(248 113 113);
    }

    @keyframes reportCardIn {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.985);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .data-state {
      display: grid;
      min-height: 300px;
      margin-top: 8px;
      place-items: center;
      border: 1px solid rgb(var(--border) / 0.86);
      border-radius: 18px;
      background: rgb(var(--panel));
      text-align: center;
    }

    .data-state > div {
      max-width: 560px;
      padding: 28px;
    }

    .data-state__icon {
      display: inline-grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border: 1px solid rgb(var(--border));
      border-radius: 14px;
      color: rgb(var(--primary));
      background: rgb(var(--bg));
    }

    .data-state__icon i {
      width: 20px;
    }

    .data-state h2 {
      margin: 8px 0 0;
      font-size: 22px;
      line-height: 1.15;
      letter-spacing: -0.025em;
    }

    .data-state small {
      display: block;
      margin: 10px auto 20px;
      color: rgb(var(--muted));
      font-size: 13px;
      line-height: 1.65;
    }

    .empty-panel {
      min-height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .empty-panel > i {
      width: 22px;
      color: rgb(var(--muted));
    }

    .empty-panel strong {
      margin-top: 12px;
      font-size: 13px;
    }

    .empty-panel p {
      max-width: 330px;
      margin: 6px 0 0;
      color: rgb(var(--muted));
      font-size: 12px;
      line-height: 1.55;
    }

    .empty-panel--row {
      min-height: 132px;
      flex-direction: row;
      justify-content: flex-start;
      gap: 14px;
      padding: 18px;
      border: 1px solid rgb(var(--border) / 0.72);
      border-radius: 14px;
      text-align: start;
    }

    .empty-panel--row > div {
      flex: 1;
    }

    .empty-panel--row strong {
      margin-top: 0;
    }

    .loading-bars {
      display: grid;
      gap: 14px;
      padding-top: 18px;
    }

    .loading-bars i {
      height: 22px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgb(var(--bg)), rgb(var(--border)), rgb(var(--bg)));
      background-size: 200% 100%;
      animation: shimmer 1.2s infinite;
    }

    .dash-button:focus-visible,
    a:focus-visible {
      outline: 2px solid rgb(var(--primary));
      outline-offset: 2px;
    }

    @keyframes shimmer {
      to { background-position: -200% 0; }
    }

    @media (max-width: 1160px) {
      .filter-strip__title {
        grid-column: 1 / -1;
      }

      .dashboard-bento {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .bento-tile--hero {
        grid-column: 1 / -1;
      }

      .bento-analysis-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .market-dashboard {
        padding: 12px 10px 18px;
      }

      .dashboard-bento {
        grid-template-columns: 1fr;
      }

      .bento-tile--hero {
        padding: 16px;
      }

      .bento-tile--hero {
        grid-column: auto;
        grid-row: auto;
      }

      .bar-row {
        grid-template-columns: 24px minmax(0, 1fr) auto;
      }

      .bar-row .track {
        grid-column: 2 / -1;
      }

      .recent-panel header {
        display: grid;
      }

      .empty-panel--row {
        align-items: flex-start;
        flex-wrap: wrap;
      }

      .recent-list,
      .report-sheet__grid,
      .report-card--role,
      .report-card--location,
      .report-card--package,
      .report-card--signal {
        grid-template-columns: 1fr;
      }

      .report-card--hero,
      .report-card--salary,
      .report-card--note,
      .report-field--wide {
        grid-column: auto;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 1ms !important;
        transition-duration: 1ms !important;
      }
    }
  `]
})
export class DashboardFeaturePageComponent {
  private readonly salaryDashboard = inject(SalaryDashboardPort);
  private readonly salaryReports = inject(SalaryReportsPort);

  readonly summary = signal<SalaryDashboardSummary | null>(null);
  readonly latestReports = signal<SalaryDashboardReportPreview[]>([]);
  readonly selectedReport = signal<SalaryDashboardReportPreview | null>(null);
  readonly selectedReportDetail = signal<SalaryReportDetail | null>(null);
  readonly selectedReportLoading = signal(false);
  readonly selectedReportError = signal('');
  readonly options = signal<SalaryDashboardOptions>({ disciplines: [], seniorities: [], workModes: [], currencies: [] });
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly discipline = signal('');
  readonly seniority = signal('');
  readonly workMode = signal('');

  readonly disciplineMax = computed(() => Math.max(...(this.summary()?.byDiscipline.map(item => item.averageSalary) ?? [1]), 1));
  readonly seniorityMax = computed(() => Math.max(...(this.summary()?.bySeniority.map(item => item.averageSalary) ?? [1]), 1));

  constructor() {
    this.refresh();
  }

  setDiscipline(value: string): void {
    this.discipline.set(value);
    this.refresh();
  }

  setSeniority(value: string): void {
    this.seniority.set(value);
    this.refresh();
  }

  setWorkMode(value: string): void {
    this.workMode.set(value);
    this.refresh();
  }

  openRecentReport(report: SalaryDashboardReportPreview): void {
    this.selectedReport.set(report);
    this.selectedReportDetail.set(null);
    this.selectedReportError.set('');
    this.selectedReportLoading.set(true);
    this.salaryReports.getById(report.id).pipe(
      catchError(() => {
        this.selectedReportError.set('Full report details could not be loaded.');
        return of(null);
      })
    ).subscribe(detail => {
      this.selectedReportDetail.set(detail);
      this.selectedReportLoading.set(false);
    });
  }

  closeRecentReport(): void {
    this.selectedReport.set(null);
    this.selectedReportDetail.set(null);
    this.selectedReportError.set('');
    this.selectedReportLoading.set(false);
  }

  refresh(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const filters = {
      discipline: this.discipline() || undefined,
      experience: this.seniority() || undefined,
      workMode: this.workMode() || undefined
    };

    this.salaryDashboard.loadSnapshot(filters).pipe(
      catchError(() => {
        this.errorMessage.set('Could not load salary market data. Check the API connection and try again.');
        return of(null);
      })
    ).subscribe(snapshot => {
      if (snapshot) {
        this.summary.set(snapshot.summary);
        this.latestReports.set(snapshot.latestReports);
        this.options.set(snapshot.options);
      }

      this.isLoading.set(false);
    });
  }

  money(value: number | null | undefined): string {
    return value == null || value === 0 ? '-' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }

  twoDigits(value: number): string {
    return value.toString().padStart(2, '0');
  }

  experienceLabel(item: SalaryReportDetail | SalaryDashboardReportPreview): string {
    if ('seniority' in item) return item.seniority || 'Not specified';
    return `${item.yearsOfExperience} ${item.yearsOfExperience === 1 ? 'year' : 'years'}`;
  }

  value(value: string | number | null | undefined): string {
    return value === null || value === undefined || value === '' ? 'Not specified' : String(value);
  }

  barWidth(value: number, max: number): number {
    return Math.max(5, Math.min(100, (value / max) * 100));
  }
}
