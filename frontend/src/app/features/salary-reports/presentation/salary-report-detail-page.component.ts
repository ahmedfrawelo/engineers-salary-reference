import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageDesignComponent } from '../../../shared/ui/page-design';
import { SalaryReportsPort } from '../application/ports/salary-reports.port';
import { SalaryReportDetail } from '../domain/salary-report.models';

@Component({
  selector: 'feature-salary-report-detail-page',
  standalone: true,
  imports: [PageDesignComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <engineers-salary-reference-page-design class="salary-detail-design" title="Salary Report" sub="A published community salary signal" icon="chart" [sharedToolbarShowCustomize]="false">
      <div page-table class="salary-detail">
        @if (isLoading()) { <div class="salary-detail__state">Loading report...</div> }
        @else if (error()) { <div class="salary-detail__state is-error">This report is unavailable.</div> }
        @else if (report(); as item) {
          <header class="salary-detail__hero">
            <div>
              <span>{{ item.discipline }}</span>
              <h1>{{ item.discipline }}</h1>
              <p>{{ item.yearsOfExperience }} years experience · {{ item.workMode }} · Submitted {{ item.submittedAt }}</p>
            </div>
            <strong>{{ money(item.monthlyNetSalary) }} {{ item.currency }}</strong>
          </header>

          <div class="salary-detail__grid">
            <section>
              <h2>Role and work setup</h2>
              <dl>
                <div><dt>Discipline</dt><dd>{{ item.discipline }}</dd></div>
                <div><dt>Experience</dt><dd>{{ item.yearsOfExperience }} years</dd></div>
                <div><dt>Company type</dt><dd>{{ item.companyType }}</dd></div>
                <div><dt>Work mode</dt><dd>{{ item.workMode }}</dd></div>
                <div><dt>City</dt><dd>{{ item.city }}</dd></div>
                <div><dt>Country</dt><dd>{{ item.country }}</dd></div>
              </dl>
            </section>

            <section>
              <h2>Compensation and schedule</h2>
              <dl>
                <div><dt>Monthly net salary</dt><dd>{{ money(item.monthlyNetSalary) }} {{ item.currency }}</dd></div>
                <div><dt>Daily work hours</dt><dd>{{ value(item.dailyWorkHours) }}</dd></div>
                <div><dt>Housing provided</dt><dd>{{ value(item.housingProvided) }}</dd></div>
                <div><dt>Transportation</dt><dd>{{ value(item.transportationProvided) }}</dd></div>
                <div><dt>Annual bonus</dt><dd>{{ value(item.annualBonus) }}</dd></div>
                <div><dt>Extra day off</dt><dd>{{ value(item.extraDayOff) }}</dd></div>
              </dl>
            </section>

            <section>
              <h2>Career context</h2>
              <dl>
                <div><dt>Salary fairness</dt><dd>{{ value(item.salaryFairness) }}</dd></div>
                <div><dt>Recommend field</dt><dd>{{ value(item.recommendField) }}</dd></div>
                <div><dt>Certificate</dt><dd>{{ value(item.professionalCertificate) }}</dd></div>
                <div><dt>Education</dt><dd>{{ value(item.highestEducation) }}</dd></div>
                <div class="salary-detail__wide"><dt>Benefits</dt><dd>{{ value(item.benefits) }}</dd></div>
              </dl>
            </section>

            <section>
              <h2>Contributor advice</h2>
              <dl class="salary-detail__prose">
                <div><dt>Negotiation advice</dt><dd>{{ value(item.negotiationAdvice) }}</dd></div>
              </dl>
            </section>
          </div>
        }
      </div>
    </engineers-salary-reference-page-design>
  `,
  styles: [`:host{display:flex;flex:1 1 auto;min-width:0;min-height:0}:host ::ng-deep engineers-salary-reference-page-design{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;width:100%!important;min-width:0!important;min-height:0!important}:host ::ng-deep engineers-salary-reference-page-design .table-area{display:flex!important;flex:1 1 auto!important;width:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important}.salary-detail{flex:1 1 auto;width:100%;min-width:0;min-height:0;overflow:auto;padding:24px 28px;background:rgb(var(--bg));}.salary-detail__hero{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:22px;border:1px solid rgb(var(--border));background:rgb(var(--panel));}.salary-detail__hero span{color:rgb(var(--primary));font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}.salary-detail h1,.salary-detail h2,.salary-detail p{margin:0}.salary-detail h1{margin-top:7px;font-size:30px;letter-spacing:0}.salary-detail__hero p{margin-top:8px;color:rgb(var(--muted));font-size:12px}.salary-detail__hero>strong{color:rgb(var(--primary));font-size:25px;font-variant-numeric:tabular-nums;white-space:nowrap}.salary-detail__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.salary-detail section{min-width:0;padding:20px;border:1px solid rgb(var(--border));background:rgb(var(--panel))}.salary-detail h2{font-size:16px;letter-spacing:0}.salary-detail dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:20px 0 0}.salary-detail dt{color:rgb(var(--muted));font-size:10px;text-transform:uppercase}.salary-detail dd{margin:5px 0 0;overflow-wrap:anywhere;font-size:13px;line-height:1.55}.salary-detail__wide{grid-column:1/-1}.salary-detail__prose{grid-template-columns:1fr!important}.salary-detail__state{padding:44px;color:rgb(var(--muted));text-align:center}.salary-detail__state.is-error{color:rgb(255 181 181)}@media(max-width:700px){.salary-detail{padding:16px}.salary-detail__hero{display:block}.salary-detail__hero>strong{display:block;margin-top:18px}.salary-detail__grid{grid-template-columns:1fr}.salary-detail dl{grid-template-columns:1fr 1fr}}@media(max-width:430px){.salary-detail dl{grid-template-columns:1fr}}`]
})
export class SalaryReportDetailPageComponent {
  private readonly salaryReports = inject(SalaryReportsPort);
  private readonly route = inject(ActivatedRoute);
  readonly report = signal<SalaryReportDetail | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal(false);
  constructor() { const id = this.route.snapshot.paramMap.get('id'); if (!id) { this.isLoading.set(false); this.error.set(true); } else { this.salaryReports.getById(id).subscribe({ next: report => { this.report.set(report); this.isLoading.set(false); }, error: () => { this.error.set(true); this.isLoading.set(false); } }); } }
  money(value: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value); }
  value(value: string | number | null | undefined): string { return value == null || value === '' ? 'Not specified' : String(value); }
}
