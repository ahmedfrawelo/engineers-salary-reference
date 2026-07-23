import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SearchSelectComponent } from '../../../shared/ui/search-select.component';
import { PageDesignComponent } from '../../../shared/ui/page-design';
import { SalaryReportsPort } from '../application/ports/salary-reports.port';
import {
  createSalaryReportDraft,
  emptySalaryOptions,
  SalaryOptions,
  SalaryReportNumberField,
  SalaryReportTextField
} from '../domain/salary-report.models';

@Component({
  selector: 'feature-submit-salary-report-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PageDesignComponent, SearchSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:flex;flex:1 1 auto;min-width:0;min-height:0;height:100%;' },
  template: `
    <engineers-salary-reference-page-design
      class="salary-submit-page-design"
      title="Salary contribution"
      sub="Add a structured salary record to the Engineers Reference"
      icon="file-add"
      [hideHeader]="true"
      [sharedToolbarShowCustomize]="false"
      toolbarAriaLabel="Salary report actions"
    >
      <div toolbar-left class="salary-submit-toolbar-context">
        <span class="salary-submit-toolbar-context__kicker">SALARY REPORTS</span>
        <strong>New contribution</strong>
      </div>
      <div toolbar-right-before-shared class="salary-submit-toolbar-actions">
        <a routerLink="/salary-reports">View reports</a>
        <button class="btn sm proj-toolbar-btn proj-toolbar-btn--primary" type="submit" form="salary-report-form" [disabled]="isSubmitting()">
          {{ isSubmitting() ? 'Publishing...' : 'Publish report' }}
        </button>
      </div>

      <section page-table class="salary-submit-page" aria-labelledby="salary-submit-title">
        <header class="salary-submit-page__intro">
          <div>
            <p class="salary-submit-page__eyebrow">ENGINEERS REFERENCE</p>
            <h1 id="salary-submit-title">Submit a salary report</h1>
            <p>Every field matches the supplied salary sheet so contributions remain directly comparable.</p>
          </div>
          <ol class="salary-submit-page__steps" aria-label="Report sections">
            <li><span>01</span>Role</li><li><span>02</span>Company</li><li><span>03</span>Package</li><li><span>04</span>Context</li>
          </ol>
        </header>

        @if (message()) {
          <p class="salary-submit-page__message" [class.is-error]="isError()" role="status" aria-live="polite">{{ message() }}</p>
        }

        <form id="salary-report-form" class="salary-submit-form" (ngSubmit)="submit()">
          <fieldset class="salary-submit-section">
            <legend><span>01</span> Role and compensation</legend>
            <p class="salary-submit-section__hint">Choose the same standardized values used in the existing salary records.</p>
            <div class="salary-submit-grid salary-submit-grid--four">
              <label class="salary-submit-field"><span>Discipline <b>*</b></span><search-select [options]="options().disciplines" [value]="draft.discipline" (valueChange)="setText('discipline', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Select discipline"></search-select></label>
              <label class="salary-submit-field"><span>Monthly net salary <b>*</b></span><search-select [options]="options().monthlyNetSalaries" [value]="$any(draft.monthlyNetSalary)" (valueChange)="setNumber('monthlyNetSalary', $any($event))" [displayFn]="salaryDisplay" [allowInlineSearch]="true" [allowClear]="true" placeholder="Select monthly salary"></search-select></label>
              <label class="salary-submit-field"><span>Currency <b>*</b></span><search-select [options]="options().currencies" [value]="draft.currency" (valueChange)="setText('currency', $event)" [allowInlineSearch]="true" [allowClear]="false" placeholder="Select currency"></search-select></label>
              <label class="salary-submit-field"><span>Years of experience <b>*</b></span><search-select [options]="options().yearsOfExperience" [value]="$any(draft.yearsOfExperience)" (valueChange)="setNumber('yearsOfExperience', $any($event))" [displayFn]="experienceDisplay" [allowInlineSearch]="true" [allowClear]="true" placeholder="Select experience"></search-select></label>
            </div>
          </fieldset>

          <fieldset class="salary-submit-section">
            <legend><span>02</span> Company and work setup</legend>
            <p class="salary-submit-section__hint">Use a registered company, location, and work setup so reports can be compared reliably.</p>
            <div class="salary-submit-grid salary-submit-grid--four">
              <label class="salary-submit-field"><span>Company type <b>*</b></span><search-select [options]="options().companyTypes" [value]="draft.companyType" (valueChange)="setText('companyType', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Select company type"></search-select></label>
              <label class="salary-submit-field"><span>City <b>*</b></span><search-select [options]="options().cities" [value]="draft.city" (valueChange)="setText('city', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Select city"></search-select></label>
              <label class="salary-submit-field"><span>Country <b>*</b></span><search-select [options]="options().countries" [value]="draft.country" (valueChange)="setText('country', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Select country"></search-select></label>
              <label class="salary-submit-field"><span>Work mode <b>*</b></span><search-select [options]="options().workModes" [value]="draft.workMode" (valueChange)="setText('workMode', $event)" [allowInlineSearch]="true" [allowClear]="false" placeholder="Select work mode"></search-select></label>
            </div>
          </fieldset>

          <fieldset class="salary-submit-section">
            <legend><span>03</span> Package details</legend>
            <p class="salary-submit-section__hint">These are optional, but make the comparison more useful than a salary number alone.</p>
            <div class="salary-submit-grid salary-submit-grid--four">
              <label class="salary-submit-field"><span>Housing provided</span><search-select [options]="options().housingProvided" [value]="draft.housingProvided" (valueChange)="setText('housingProvided', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
              <label class="salary-submit-field"><span>Transportation provided</span><search-select [options]="options().transportationProvided" [value]="draft.transportationProvided" (valueChange)="setText('transportationProvided', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
              <label class="salary-submit-field"><span>Annual bonus</span><search-select [options]="options().annualBonuses" [value]="draft.annualBonus" (valueChange)="setText('annualBonus', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
              <label class="salary-submit-field"><span>Salary feels fair</span><search-select [options]="options().salaryFairnessOptions" [value]="draft.salaryFairness" (valueChange)="setText('salaryFairness', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
              <label class="salary-submit-field"><span>Recommend this field</span><search-select [options]="options().recommendFieldOptions" [value]="draft.recommendField" (valueChange)="setText('recommendField', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
              <label class="salary-submit-field"><span>Professional certificate</span><search-select [options]="options().professionalCertificates" [value]="draft.professionalCertificate" (valueChange)="setText('professionalCertificate', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
              <label class="salary-submit-field"><span>Highest education</span><search-select [options]="options().highestEducations" [value]="draft.highestEducation" (valueChange)="setText('highestEducation', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
              <label class="salary-submit-field"><span>Daily work hours</span><search-select [options]="options().dailyWorkHours" [value]="$any(draft.dailyWorkHours)" (valueChange)="setNumber('dailyWorkHours', $any($event))" [displayFn]="hoursDisplay" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
              <label class="salary-submit-field"><span>Additional day off</span><search-select [options]="options().extraDaysOff" [value]="draft.extraDayOff" (valueChange)="setText('extraDayOff', $event)" [allowInlineSearch]="true" [allowClear]="true" placeholder="Not specified"></search-select></label>
            </div>
          </fieldset>

          <fieldset class="salary-submit-section salary-submit-section--context">
            <legend><span>04</span> Context for other engineers</legend>
            <p class="salary-submit-section__hint">Benefits and negotiation advice remain free text exactly as provided by the source form.</p>
            <div class="salary-submit-grid salary-submit-grid--context">
              <label class="salary-submit-field"><span>Benefits</span><textarea name="benefits" [ngModel]="draft.benefits" (ngModelChange)="setText('benefits', $event)" rows="5" placeholder="Insurance, allowances, leave, tools..."></textarea></label>
              <label class="salary-submit-field"><span>Negotiation advice</span><textarea name="negotiationAdvice" [ngModel]="draft.negotiationAdvice" (ngModelChange)="setText('negotiationAdvice', $event)" rows="5" placeholder="What should an engineer know before accepting?"></textarea></label>
            </div>
          </fieldset>
        </form>
      </section>
    </engineers-salary-reference-page-design>
  `,
  styles: [`
    :host { background: rgb(var(--bg)); color: rgb(var(--fg)); }
    :host ::ng-deep engineers-salary-reference-page-design.salary-submit-page-design { display:flex; flex:1 1 auto; flex-direction:column; width:100%; min-width:0; min-height:0; height:100%; }
    :host ::ng-deep engineers-salary-reference-page-design.salary-submit-page-design .table-area { display:flex; flex:1 1 auto; min-width:0; min-height:0; overflow:hidden; }
    .salary-submit-toolbar-context, .salary-submit-toolbar-actions { display:flex; align-items:center; gap:12px; }
    .salary-submit-toolbar-context__kicker { color:rgb(var(--primary)); font-size:10px; font-weight:800; letter-spacing:.1em; }
    .salary-submit-toolbar-context strong { font-size:12px; }
    .salary-submit-toolbar-actions a { color:rgb(var(--muted)); font-size:12px; text-decoration:none; }
    .salary-submit-page { display:flex; flex:1 1 auto; flex-direction:column; width:100%; min-width:0; min-height:0; overflow:auto; background:rgb(var(--bg)); }
    .salary-submit-page__intro { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:28px; align-items:end; padding:28px; border-bottom:1px solid rgb(var(--border)); background:rgb(var(--panel)); }
    .salary-submit-page__intro h1, .salary-submit-page__intro p { margin:0; }
    .salary-submit-page__eyebrow { color:rgb(var(--primary)); font-size:10px; font-weight:800; letter-spacing:.12em; }
    .salary-submit-page__intro h1 { margin-top:8px; font-size:30px; line-height:1.15; }
    .salary-submit-page__intro > div > p:last-child { max-width:700px; margin-top:10px; color:rgb(var(--muted)); font-size:13px; line-height:1.6; }
    .salary-submit-page__steps { display:grid; grid-template-columns:repeat(4,minmax(74px,1fr)); margin:0; padding:0; list-style:none; border:1px solid rgb(var(--border)); }
    .salary-submit-page__steps li { display:grid; gap:4px; padding:10px 12px; border-right:1px solid rgb(var(--border)); font-size:11px; font-weight:700; }
    .salary-submit-page__steps li:last-child { border-right:0; }.salary-submit-page__steps span { color:rgb(var(--primary)); font-size:10px; }
    .salary-submit-page__message { margin:0; padding:11px 28px; border-bottom:1px solid rgb(var(--primary)); color:rgb(var(--primary)); font-size:12px; }.salary-submit-page__message.is-error { border-color:rgb(225 90 90); color:rgb(255 181 181); }
    .salary-submit-form { width:100%; min-width:0; }.salary-submit-section { min-width:0; margin:0; padding:0; border:0; border-bottom:1px solid rgb(var(--border)); }.salary-submit-section legend { width:100%; box-sizing:border-box; padding:22px 28px 4px; font-size:16px; font-weight:800; }.salary-submit-section legend span { margin-right:8px; color:rgb(var(--primary)); font-size:11px; }.salary-submit-section__hint { margin:0; padding:0 28px 18px; color:rgb(var(--muted)); font-size:12px; line-height:1.5; }
    .salary-submit-grid { display:grid; border-top:1px solid rgb(var(--border)); }.salary-submit-grid--three { grid-template-columns:repeat(3,minmax(0,1fr)); }.salary-submit-grid--four { grid-template-columns:repeat(4,minmax(0,1fr)); }.salary-submit-grid--context { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .salary-submit-field { display:grid; gap:9px; min-width:0; min-height:112px; padding:16px 20px; border-right:1px solid rgb(var(--border)); border-bottom:1px solid rgb(var(--border)); background:rgb(var(--bg)); }.salary-submit-grid--three .salary-submit-field:nth-child(3n), .salary-submit-grid--four .salary-submit-field:nth-child(4n), .salary-submit-grid--context .salary-submit-field:nth-child(2n) { border-right:0; }.salary-submit-field > span { color:rgb(var(--muted)); font-size:10px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }.salary-submit-field b { color:rgb(var(--primary)); }
    :host ::ng-deep .salary-submit-field search-select, :host ::ng-deep .salary-submit-field .ss, :host ::ng-deep .salary-submit-field .ss-origin, :host ::ng-deep .salary-submit-field .ss-inline-trigger { min-width:0; width:100%; }.salary-submit-field textarea { box-sizing:border-box; width:100%; min-height:132px; resize:vertical; border:1px solid rgb(var(--border)); background:rgb(var(--panel)); color:rgb(var(--fg)); padding:10px 11px; font:inherit; font-size:13px; line-height:1.5; }.salary-submit-field textarea:focus { outline:0; border-color:rgb(var(--primary)); box-shadow:0 0 0 2px rgb(var(--primary) / .18); }
    @media (max-width:980px) { .salary-submit-page__intro { grid-template-columns:1fr; }.salary-submit-grid--four { grid-template-columns:repeat(2,minmax(0,1fr)); }.salary-submit-grid--four .salary-submit-field:nth-child(4n) { border-right:1px solid rgb(var(--border)); }.salary-submit-grid--four .salary-submit-field:nth-child(2n) { border-right:0; } }
    @media (max-width:640px) { .salary-submit-toolbar-context__kicker, .salary-submit-toolbar-actions a { display:none; }.salary-submit-page__intro, .salary-submit-section legend, .salary-submit-section__hint, .salary-submit-page__message { padding-left:16px; padding-right:16px; }.salary-submit-page__steps li { min-width:0; padding:9px 7px; }.salary-submit-grid--three, .salary-submit-grid--four, .salary-submit-grid--context { grid-template-columns:1fr; }.salary-submit-field, .salary-submit-grid--three .salary-submit-field:nth-child(3n), .salary-submit-grid--four .salary-submit-field:nth-child(4n), .salary-submit-grid--four .salary-submit-field:nth-child(2n) { border-right:0; } }
  `]
})
export class SubmitSalaryReportPageComponent {
  private readonly salaryReports = inject(SalaryReportsPort);
  private submissionIdempotencyKey: string | null = null;
  readonly options = signal<SalaryOptions>(emptySalaryOptions());
  readonly isSubmitting = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly salaryDisplay = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  readonly experienceDisplay = (value: number) => `${value} ${value === 1 ? 'year' : 'years'}`;
  readonly hoursDisplay = (value: number) => `${value} hours`;
  draft = createSalaryReportDraft();

  constructor() {
    this.salaryReports.loadOptions().subscribe({ next: options => this.options.set(options) });
  }

  setText(field: SalaryReportTextField, value: string | null): void { this.draft[field] = value ?? ''; this.submissionIdempotencyKey = null; }
  setNumber(field: SalaryReportNumberField, value: number | null): void { this.draft[field] = value; this.submissionIdempotencyKey = null; }

  submit(): void {
    if (!this.draft.discipline || !this.draft.companyType || !this.draft.city || !this.draft.country || !this.draft.monthlyNetSalary || this.draft.yearsOfExperience == null) {
      this.isError.set(true);
      this.message.set('Complete all required fields before publishing.');
      return;
    }
    this.isSubmitting.set(true);
    this.message.set('');
    this.submissionIdempotencyKey ??= this.createIdempotencyKey();
    this.salaryReports.submit(this.draft, this.submissionIdempotencyKey).subscribe({
      next: () => { this.isSubmitting.set(false); this.isError.set(false); this.message.set('Your salary report was published. Thank you for contributing.'); this.draft = createSalaryReportDraft(); this.submissionIdempotencyKey = null; },
      error: () => { this.isSubmitting.set(false); this.isError.set(true); this.message.set('We could not publish the report. Review the form and try again.'); }
    });
  }

  private createIdempotencyKey(): string {
    return globalThis.crypto?.randomUUID?.() ?? `salary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
