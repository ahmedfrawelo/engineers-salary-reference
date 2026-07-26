import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppIconDirective } from '../../../shared/icons/app-icon.directive';
import { StatefulIconComponent } from '../../../shared/icons/stateful-icon.component';
import { resolveAppIconSpec } from '../../../shared/icons/app-icon.registry';
import { SearchSelectComponent } from '../../../shared/ui/search-select.component';
import { AppTipDirective } from '../../../shared/ui/tip';
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
  imports: [
    FormsModule,
    RouterLink,
    AppIconDirective,
    StatefulIconComponent,
    PageDesignComponent,
    SearchSelectComponent,
    AppTipDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:flex;flex:1 1 auto;min-width:0;min-height:0;height:100%;' },
  template: `
    <engineers-salary-reference-page-design
      class="salary-submit-page-design"
      sub="Add a structured salary record to the Engineers Reference"
      icon="file-add"
      [hideHeader]="true"
      [sharedToolbarShowCustomize]="false"
    >
      <section page-table class="salary-submit-page" aria-labelledby="salary-submit-title">
        <header class="salary-submit-page__intro">
          <div>
            <p class="salary-submit-page__eyebrow salary-submit-ui-tip" tabindex="0" data-ui-tip="This page adds a clean salary signal to the shared reference." (focus)="showSubmitTip($event)">CONTRIBUTE TO THE REFERENCE</p>
            <h1 id="salary-submit-title" class="salary-submit-ui-tip" tabindex="0" data-ui-tip="Submit one salary report with role, company, package, and context." (focus)="showSubmitTip($event)">
              <app-stateful-icon
                class="salary-submit-title-icon"
                [outlineIcon]="submitReportIcon.outline"
                [filledIcon]="submitReportIcon.filled"
                [active]="true"
                [size]="38"
                [strokeWidth]="submitReportIcon.strokeWidth"
                aria-hidden="true"
              ></app-stateful-icon>
              <span>Submit a salary report</span>
            </h1>
            <p class="salary-submit-page__description">
              Add one clean salary signal with role, company setup, package benefits, and practical
              context so other engineers can compare offers with confidence. Fields marked with
              <b>*</b> are required.
            </p>
          </div>
          <div class="salary-submit-page__meta salary-submit-ui-tip" tabindex="0" aria-label="Submission details" data-ui-tip="Four short sections create one salary contribution." (focus)="showSubmitTip($event)">
            <span><b>04</b> sections</span>
            <span><b>01</b> contribution</span>
          </div>
        </header>

        @if (message()) {
          <p
            class="salary-submit-page__message"
            [class.is-error]="isError()"
            role="status"
            aria-live="polite"
          >
            {{ message() }}
          </p>
        }
        <div class="salary-submit-studio">
        <nav class="salary-submit-progress" aria-label="Salary report sections">
          <div class="salary-submit-progress__counter salary-submit-ui-tip" tabindex="0" aria-label="Current section" data-ui-tip="Shows which section you are editing now." [appTip]="'Shows which section you are editing now.'" [appTipDelay]="0">
            <strong>0{{ activeStep() }}</strong><span>/04</span>
            <small>current section</small>
          </div>
          <div
            class="salary-submit-wizard-nav__list"
            [class.is-progress-step-1]="activeStep() === 1"
            [class.is-progress-step-2]="activeStep() === 2"
            [class.is-progress-step-3]="activeStep() === 3"
            [class.is-progress-step-4]="activeStep() === 4"
          >
            <button class="tab-btn salary-submit-ui-tip" type="button" data-ui-tip="Role, salary, currency, and experience." [appTip]="'Role, salary, currency, and experience.'" [appTipDelay]="0" [class.active]="activeStep() === 1" [class.is-visited]="activeStep() >= 1" [class.is-complete]="isStepComplete(1)"
              [attr.aria-current]="activeStep() === 1 ? 'step' : null"
              (click)="setStep(1)"
            >
              <span>01</span><i appIcon="person-badge" aria-hidden="true"></i
              ><strong>Role &amp; salary</strong>
            </button>
            <button class="tab-btn salary-submit-ui-tip" type="button" data-ui-tip="Company type, city, country, and work mode." [appTip]="'Company type, city, country, and work mode.'" [appTipDelay]="0" [class.active]="activeStep() === 2" [class.is-visited]="activeStep() >= 2" [class.is-complete]="isStepComplete(2)"
              [attr.aria-current]="activeStep() === 2 ? 'step' : null"
              (click)="setStep(2)"
            >
              <span>02</span><i appIcon="shop" aria-hidden="true"></i><strong>Company</strong>
            </button>
            <button class="tab-btn salary-submit-ui-tip" type="button" data-ui-tip="Package benefits and practical offer details." [appTip]="'Package benefits and practical offer details.'" [appTipDelay]="0" [class.active]="activeStep() === 3" [class.is-visited]="activeStep() >= 3" [class.is-complete]="isStepComplete(3)"
              [attr.aria-current]="activeStep() === 3 ? 'step' : null"
              (click)="setStep(3)"
            >
              <span>03</span><i appIcon="package" aria-hidden="true"></i><strong>Package</strong>
            </button>
            <button class="tab-btn salary-submit-ui-tip" type="button" data-ui-tip="Free-text benefits and negotiation advice." [appTip]="'Free-text benefits and negotiation advice.'" [appTipDelay]="0" [class.active]="activeStep() === 4" [class.is-visited]="activeStep() >= 4" [class.is-complete]="isStepComplete(4)"
              [attr.aria-current]="activeStep() === 4 ? 'step' : null"
              (click)="setStep(4)"
            >
              <span>04</span><i appIcon="journal-text" aria-hidden="true"></i><strong>Context</strong>
            </button>
          </div>
        </nav>
        <form
          id="salary-report-form"
          class="salary-submit-form"
          [class.is-step-forward]="stepDirection() === 'forward'"
          [class.is-step-backward]="stepDirection() === 'backward'"
          (ngSubmit)="submit()"
        >
          <fieldset
            id="salary-role"
            class="salary-submit-section"
            [class.is-active-step]="activeStep() === 1"
          >
            <legend class="salary-submit-ui-tip" tabindex="0" data-ui-tip="Start with the core compensation facts." (focus)="showSubmitTip($event)"><span>01</span> Role and compensation</legend>
            <p class="salary-submit-section__hint">
              Choose the same standardized values used in the existing salary records.
            </p>
            <div class="salary-submit-grid salary-submit-grid--four">
              <label class="salary-submit-field"
                ><span><i appIcon="briefcase" aria-hidden="true"></i>Discipline <b>*</b><button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Choose the engineering discipline that best matches the role." [appTip]="'Choose the engineering discipline that best matches the role.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().disciplines"
                  [value]="draft.discipline"
                  (valueChange)="setText('discipline', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Select discipline"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="cash-stack" aria-hidden="true"></i>Monthly net salary <b>*</b><button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Use the monthly net amount after deductions, not gross salary." [appTip]="'Use the monthly net amount after deductions, not gross salary.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().monthlyNetSalaries"
                  [value]="$any(draft.monthlyNetSalary)"
                  (valueChange)="setNumber('monthlyNetSalary', $any($event))"
                  [displayFn]="salaryDisplay"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Select monthly salary"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="coin" aria-hidden="true"></i>Currency <b>*</b><button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Select the currency used for the salary amount." [appTip]="'Select the currency used for the salary amount.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().currencies"
                  [value]="draft.currency"
                  (valueChange)="setText('currency', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="false"
                  placeholder="Select currency"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="clock-history" aria-hidden="true"></i>Years of experience <b>*</b><button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Pick the total relevant engineering experience at the time of this offer." [appTip]="'Pick the total relevant engineering experience at the time of this offer.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().yearsOfExperience"
                  [value]="$any(draft.yearsOfExperience)"
                  (valueChange)="setNumber('yearsOfExperience', $any($event))"
                  [displayFn]="experienceDisplay"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Select experience"
                ></search-select
              ></label>
            </div>
          </fieldset>

          <fieldset
            id="salary-company"
            class="salary-submit-section"
            [class.is-active-step]="activeStep() === 2"
          >
            <legend class="salary-submit-ui-tip" tabindex="0" data-ui-tip="Add workplace context so reports compare fairly." (focus)="showSubmitTip($event)"><span>02</span> Company and work setup</legend>
            <p class="salary-submit-section__hint">
              Use a registered company, location, and work setup so reports can be compared
              reliably.
            </p>
            <div class="salary-submit-grid salary-submit-grid--four">
              <label class="salary-submit-field"
                ><span><i appIcon="building" aria-hidden="true"></i>Company type <b>*</b><button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Use the company category so similar workplaces can be compared." [appTip]="'Use the company category so similar workplaces can be compared.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().companyTypes"
                  [value]="draft.companyType"
                  (valueChange)="setText('companyType', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Select company type"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="geo-alt" aria-hidden="true"></i>City <b>*</b><button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Select the work city or main office location for this role." [appTip]="'Select the work city or main office location for this role.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().cities"
                  [value]="draft.city"
                  (valueChange)="setText('city', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Select city"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="globe" aria-hidden="true"></i>Country <b>*</b><button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Select the country where the role is based." [appTip]="'Select the country where the role is based.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().countries"
                  [value]="draft.country"
                  (valueChange)="setText('country', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Select country"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="person-gear" aria-hidden="true"></i>Work mode <b>*</b><button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Clarify whether the role is onsite, hybrid, or remote." [appTip]="'Clarify whether the role is onsite, hybrid, or remote.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().workModes"
                  [value]="draft.workMode"
                  (valueChange)="setText('workMode', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="false"
                  placeholder="Select work mode"
                ></search-select
              ></label>
            </div>
          </fieldset>

          <fieldset
            id="salary-package"
            class="salary-submit-section"
            [class.is-active-step]="activeStep() === 3"
          >
            <legend class="salary-submit-ui-tip" tabindex="0" data-ui-tip="Optional benefits that explain the total package." (focus)="showSubmitTip($event)"><span>03</span> Package details</legend>
            <p class="salary-submit-section__hint">
              These are optional, but make the comparison more useful than a salary number alone.
            </p>
            <div class="salary-submit-grid salary-submit-grid--four">
              <label class="salary-submit-field"
                ><span><i appIcon="home" aria-hidden="true"></i>Housing provided<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Mark whether housing is included in the compensation package." [appTip]="'Mark whether housing is included in the compensation package.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().housingProvided"
                  [value]="draft.housingProvided"
                  (valueChange)="setText('housingProvided', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="truck" aria-hidden="true"></i>Transportation provided<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Mark whether transportation, shuttle, or allowance is provided." [appTip]="'Mark whether transportation, shuttle, or allowance is provided.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().transportationProvided"
                  [value]="draft.transportationProvided"
                  (valueChange)="setText('transportationProvided', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="trophy" aria-hidden="true"></i>Annual bonus<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Include the typical annual bonus arrangement if known." [appTip]="'Include the typical annual bonus arrangement if known.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().annualBonuses"
                  [value]="draft.annualBonus"
                  (valueChange)="setText('annualBonus', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="check-circle-fill" aria-hidden="true"></i>Salary feels fair<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Share whether the salary felt fair for the role, market, and workload." [appTip]="'Share whether the salary felt fair for the role, market, and workload.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().salaryFairnessOptions"
                  [value]="draft.salaryFairness"
                  (valueChange)="setText('salaryFairness', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="star" aria-hidden="true"></i>Recommend this field<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Tell others whether you would recommend this role or field." [appTip]="'Tell others whether you would recommend this role or field.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().recommendFieldOptions"
                  [value]="draft.recommendField"
                  (valueChange)="setText('recommendField', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="award" aria-hidden="true"></i>Professional certificate<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Add the most relevant professional certification if it affected the offer." [appTip]="'Add the most relevant professional certification if it affected the offer.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().professionalCertificates"
                  [value]="draft.professionalCertificate"
                  (valueChange)="setText('professionalCertificate', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="school" aria-hidden="true"></i>Highest education<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Select the highest education level relevant to this compensation signal." [appTip]="'Select the highest education level relevant to this compensation signal.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().highestEducations"
                  [value]="draft.highestEducation"
                  (valueChange)="setText('highestEducation', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="stopwatch" aria-hidden="true"></i>Daily work hours<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Use the normal daily work hours expected in this role." [appTip]="'Use the normal daily work hours expected in this role.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().dailyWorkHours"
                  [value]="$any(draft.dailyWorkHours)"
                  (valueChange)="setNumber('dailyWorkHours', $any($event))"
                  [displayFn]="hoursDisplay"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
              <label class="salary-submit-field"
                ><span><i appIcon="calendar-check" aria-hidden="true"></i>Additional day off<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Mention any extra day off beyond the standard weekly schedule." [appTip]="'Mention any extra day off beyond the standard weekly schedule.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><search-select
                  [options]="options().extraDaysOff"
                  [value]="draft.extraDayOff"
                  (valueChange)="setText('extraDayOff', $event)"
                  [allowInlineSearch]="true"
                  [allowClear]="true"
                  placeholder="Not specified"
                ></search-select
              ></label>
            </div>
          </fieldset>

          <fieldset
            id="salary-context"
            class="salary-submit-section salary-submit-section--context"
            [class.is-active-step]="activeStep() === 4"
          >
            <legend class="salary-submit-ui-tip" tabindex="0" data-ui-tip="Advice and benefits that help other engineers decide." (focus)="showSubmitTip($event)"><span>04</span> Context for other engineers</legend>
            <p class="salary-submit-section__hint">
              Benefits and negotiation advice remain free text exactly as provided by the source
              form.
            </p>
            <div class="salary-submit-grid salary-submit-grid--context">
              <div class="salary-submit-field salary-submit-benefits-field">
                <span><i appIcon="gem" aria-hidden="true"></i>Benefits<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Pick all benefits that apply, or add a custom one." [appTip]="'Pick all benefits that apply, or add a custom one.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span>
                <div class="salary-submit-benefits-box" role="group" aria-label="Benefits">
                  <div class="salary-submit-benefits-selected" aria-live="polite">
                    <strong>{{ selectedBenefits().length || 'No' }} selected</strong>
                    <span>Select every benefit included in the package.</span>
                  </div>
                  <div class="salary-submit-benefits-options">
                    @for (benefit of benefitOptions; track benefit) {
                      <button
                        type="button"
                        class="salary-submit-benefit-option"
                        [class.is-selected]="hasBenefit(benefit)"
                        [style.--benefit-tone]="benefitTone(benefit)"
                        [attr.aria-pressed]="hasBenefit(benefit)"
                        (click)="toggleBenefit(benefit)"
                      >
                        <i class="salary-submit-benefit-option__check" aria-hidden="true"></i>
                        <span>{{ benefit }}</span>
                      </button>
                    }
                  </div>
                  <div class="salary-submit-benefits-tools" aria-label="Benefit selection tools">
                    <button class="app-icon-action app-icon-action--wide salary-submit-benefits-tool" type="button" aria-label="Reset benefits" [appTip]="'Reset benefits'" [appTipDelay]="0" (click)="resetBenefits()">
                      <i appIcon="arrow-clockwise" aria-hidden="true"></i>
                      <span class="app-icon-action-label">Reset</span>
                    </button>
                    <button class="app-icon-action app-icon-action--wide salary-submit-benefits-tool" type="button" aria-label="Select all benefits" [appTip]="'Select all benefits'" [appTipDelay]="0" (click)="selectAllBenefits()">
                      <i appIcon="check2-all" aria-hidden="true"></i>
                      <span class="app-icon-action-label">All</span>
                    </button>
                    <button class="app-icon-action app-icon-action--wide salary-submit-benefits-tool" type="button" aria-label="Invert benefits selection" [appTip]="'Invert benefits selection'" [appTipDelay]="0" (click)="invertBenefits()">
                      <i appIcon="arrow-repeat" aria-hidden="true"></i>
                      <span class="app-icon-action-label">Invert</span>
                    </button>
                  </div>
                  <div class="salary-submit-benefits-custom">
                    <input
                      name="benefitCustom"
                      type="text"
                      autocomplete="off"
                      spellcheck="false"
                      placeholder="Add custom benefit..."
                      [(ngModel)]="benefitDraftInput"
                      [ngModelOptions]="{ standalone: true }"
                      (keydown.enter)="addCustomBenefit($event)"
                    />
                    <button type="button" class="salary-submit-benefits-add" (click)="addCustomBenefit()">
                      <i class="salary-submit-benefits-add__icon" aria-hidden="true"></i>
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
              <label class="salary-submit-field"
                ><span><i appIcon="quote" aria-hidden="true"></i>Negotiation advice<button class="app-icon-action salary-submit-field__tip" type="button" aria-label="Share practical advice an engineer should know before accepting." [appTip]="'Share practical advice an engineer should know before accepting.'" [appTipDelay]="0"><span class="salary-submit-tip-mark" aria-hidden="true">!</span><span class="app-icon-action-label">Tip</span></button></span
                ><textarea
                  name="negotiationAdvice"
                  [ngModel]="draft.negotiationAdvice"
                  (ngModelChange)="setText('negotiationAdvice', $event)"
                  rows="5"
                  placeholder="What should an engineer know before accepting?"
                ></textarea>
              </label>
            </div>
          </fieldset>
        <footer class="salary-submit-form__actions">
            <a routerLink="/salary-reports" class="salary-submit-ui-tip" data-ui-tip="Return to all published salary reports." [appTip]="'Return to all published salary reports.'" [appTipDelay]="0"><i appIcon="file-earmark-bar-graph" aria-hidden="true"></i>View reports</a>
            <div>
              @if (activeStep() > 1) {
                <button class="btn proj-toolbar-btn salary-submit-ui-tip" type="button" data-ui-tip="Go back to the previous section." [appTip]="'Go back to the previous section.'" [appTipDelay]="0" (click)="previousStep()">
                  <i appIcon="arrow-left" aria-hidden="true"></i>Back
                </button>
              }
              @if (activeStep() < 4) {
                <button
                  class="btn proj-toolbar-btn proj-toolbar-btn--primary salary-submit-ui-tip" type="button" data-ui-tip="Continue to the next section." [appTip]="'Continue to the next section.'" [appTipDelay]="0"
                  (click)="nextStep()"
                >
                  Continue <i appIcon="arrow-right" aria-hidden="true"></i>
                </button>
              } @else {
                <button
                  class="btn proj-toolbar-btn proj-toolbar-btn--primary salary-submit-ui-tip" type="submit" data-ui-tip="Publish this salary report to the reference." [appTip]="'Publish this salary report to the reference.'" [appTipDelay]="0"
                  form="salary-report-form"
                  [disabled]="isSubmitting()"
                >
                  <i appIcon="cloud-arrow-up" aria-hidden="true"></i>{{ isSubmitting() ? 'Publishing...' : 'Publish report' }}
                </button>
              }
            </div>
          </footer>
        </form>
        </div>
      </section>
    </engineers-salary-reference-page-design>
  `,
  styles: [
    `
      :host {
        background: rgb(var(--bg));
        color: rgb(var(--fg));
      }
      :host ::ng-deep engineers-salary-reference-page-design.salary-submit-page-design {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        width: 100%;
        min-width: 0;
        min-height: 0;
        height: 100%;
      }
      :host ::ng-deep engineers-salary-reference-page-design.salary-submit-page-design .table-area {
        display: flex;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }
      :host
        ::ng-deep
        engineers-salary-reference-page-design.salary-submit-page-design
        .wsh__toolbar {
        display: none;
      }
      .salary-submit-page {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        width: 100%;
        min-width: 0;
        min-height: 0;
        overflow: auto;
        background: rgb(var(--bg));
      }
      .salary-submit-page__intro {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 32px;
        padding: 36px 28px 26px;

        background: rgb(var(--panel));
      }
      .salary-submit-page__intro h1,
      .salary-submit-page__intro p {
        margin: 0;
      }
      .salary-submit-page__eyebrow {
        color: rgb(var(--primary));
        font-size: 10px;
        font-weight: 850;
        letter-spacing: 0.14em;
      }
      .salary-submit-page__intro h1 {
        margin-top: 10px;
        font-size: 30px;
        font-weight: 760;
        letter-spacing: -0.035em;
        line-height: 1.1;
      }
      .salary-submit-page__intro > div > p:last-child {
        max-width: none;
        margin-top: 10px;
        color: rgb(var(--muted));
        font-size: 13px;
        line-height: 1.55;
      }
      .salary-submit-page__intro b {
        color: rgb(var(--primary));
      }
      .salary-submit-page__meta {
        display: flex;
        gap: 24px;
        padding-bottom: 3px;
        color: rgb(var(--muted));
        font-size: 11px;
        white-space: nowrap;
      }
      .salary-submit-page__meta span {
        display: grid;
        gap: 3px;
      }
      .salary-submit-page__meta b {
        color: rgb(var(--fg));
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
      }
      .salary-submit-page__message {
        width: min(1184px, calc(100% - 56px));
        box-sizing: border-box;
        margin: 20px auto 0;
        padding: 11px 14px;
        border: 1px solid rgb(var(--primary) / 0.4);
        background: rgb(var(--primary) / 0.08);
        color: rgb(var(--primary));
        font-size: 12px;
      }
      .salary-submit-page__message.is-error {
        border-color: rgb(225 90 90 / 0.55);
        background: rgb(225 90 90 / 0.1);
        color: rgb(255 181 181);
      }
      .salary-submit-form {
        display: grid;
        grid-template-columns: 188px minmax(0, 1fr);
        gap: 34px;
        width: min(1184px, calc(100% - 56px));
        margin: 0 auto;
        padding: 32px 0 52px;
      }
      .salary-submit-form__rail {
        position: sticky;
        top: 18px;
        align-self: start;
        display: grid;
        gap: 18px;
        padding-top: 5px;
      }
      .salary-submit-form__rail > p {
        margin: 0;
        color: rgb(var(--muted));
        font-size: 10px;
        font-weight: 850;
        letter-spacing: 0.1em;
      }
      .salary-submit-form__rail nav {
        display: grid;
        gap: 1px;
      }
      .salary-submit-form__rail a {
        display: flex;
        gap: 9px;
        padding: 9px 8px;
        color: rgb(var(--muted));
        font-size: 12px;
        text-decoration: none;
        transition:
          color 0.16s ease,
          background 0.16s ease;
      }
      .salary-submit-form__rail a:hover,
      .salary-submit-form__rail a:focus-visible {
        color: rgb(var(--fg));
        background: rgb(var(--panel));
        outline: 0;
      }
      .salary-submit-form__rail a span {
        color: rgb(var(--primary));
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        font-weight: 800;
      }
      .salary-submit-form__rail small {
        max-width: 155px;
        color: rgb(var(--muted));
        font-size: 11px;
        line-height: 1.55;
      }
      .salary-submit-form__content {
        display: grid;
        gap: 22px;
        min-width: 0;
      }
      .salary-submit-section {
        min-width: 0;
        margin: 0;
        padding: 26px 28px 28px;
        border: 1px solid rgb(var(--border));
        background: rgb(var(--panel));
        scroll-margin-top: 18px;
      }
      .salary-submit-section legend {
        width: 100%;
        box-sizing: border-box;
        padding: 0 0 4px;
        font-size: 17px;
        font-weight: 760;
        letter-spacing: -0.018em;
      }
      .salary-submit-section legend span {
        margin-right: 9px;
        color: rgb(var(--primary));
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        letter-spacing: 0.08em;
      }
      .salary-submit-section__hint {
        max-width: 590px;
        margin: 0 0 22px;
        color: rgb(var(--muted));
        font-size: 12px;
        line-height: 1.55;
      }
      .salary-submit-grid {
        display: grid;
        gap: 18px;
      }
      .salary-submit-grid--three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .salary-submit-grid--four {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .salary-submit-grid--context {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .salary-submit-field {
        display: grid;
        align-content: start;
        gap: 8px;
        min-width: 0;
      }
      .salary-submit-field > span {
        color: rgb(var(--muted));
        font-size: 10px;
        font-weight: 850;
        letter-spacing: 0.065em;
        text-transform: uppercase;
      }
      .salary-submit-field b {
        color: rgb(var(--primary));
      }
      .salary-submit-benefits-field {
        grid-column: auto;
      }
      :host ::ng-deep .salary-submit-field search-select,
      :host ::ng-deep .salary-submit-field .ss,
      :host ::ng-deep .salary-submit-field .ss-origin,
      :host ::ng-deep .salary-submit-field .ss-inline-trigger {
        min-width: 0;
        width: 100%;
      }
      .salary-submit-field textarea {
        box-sizing: border-box;
        width: 100%;
        min-height: 142px;
        resize: vertical;
        border: 1px solid rgb(var(--border));
        background: rgb(var(--bg));
        color: rgb(var(--fg));
        padding: 11px 12px;
        font: inherit;
        font-size: 13px;
        line-height: 1.55;
        transition:
          border-color 0.16s ease,
          box-shadow 0.16s ease;
      }
      .salary-submit-field textarea:hover {
        border-color: rgb(var(--fg) / 0.32);
      }
      .salary-submit-field textarea:focus {
        outline: 0;
        border-color: rgb(var(--primary));
        box-shadow: 0 0 0 3px rgb(var(--primary) / 0.14);
      }
      .salary-submit-benefits-box {
        display: grid;
        gap: 0;
        box-sizing: border-box;
        min-height: 150px;
        padding: 0;
        border: 1px solid rgb(var(--border));
        border-radius: 10px;
        background:
          linear-gradient(180deg, color-mix(in oklab, rgb(var(--fg)) 3%, transparent), transparent 52%),
          rgb(var(--bg));
        color: rgb(var(--fg));
        overflow: hidden;
      }
      .salary-submit-benefits-selected,
      .salary-submit-benefits-options {
        display: flex;
        align-items: flex-start;
        align-content: flex-start;
        flex-wrap: wrap;
        gap: 8px;
        min-width: 0;
      }
      .salary-submit-benefits-selected {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 36px;
        padding: 8px 12px;
        border-bottom: 1px solid color-mix(in oklab, rgb(var(--fg)) 12%, transparent);
        background: color-mix(in oklab, rgb(var(--fg)) 3%, transparent);
      }
      .salary-submit-benefits-selected strong {
        color: rgb(var(--fg));
        font-size: 12px;
        font-weight: 850;
        letter-spacing: 0.01em;
      }
      .salary-submit-benefits-selected span {
        color: rgb(var(--muted));
        font-size: 11px;
        font-weight: 650;
      }
      .salary-submit-benefits-options {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        max-height: none;
        overflow: visible;
        padding: 8px 10px 8px;
        background: color-mix(in oklab, rgb(var(--fg)) 2%, transparent);
      }
      .salary-submit-benefits-empty {
        color: rgb(var(--muted));
        font-size: 12px;
        line-height: 28px;
      }
      .salary-submit-benefit-chip {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        --benefit-tone: rgb(var(--fg));
        max-width: 100%;
        min-height: 30px;
        padding: 0 7px 0 10px;
        border: 1px solid color-mix(in oklab, var(--benefit-tone) 38%, transparent);
        border-radius: 999px;
        background:
          linear-gradient(180deg, color-mix(in oklab, var(--benefit-tone) 18%, transparent), color-mix(in oklab, var(--benefit-tone) 9%, transparent)),
          color-mix(in oklab, rgb(var(--bg)) 92%, var(--benefit-tone));
        color: rgb(var(--fg));
        font: inherit;
        font-size: 12px;
        font-weight: 720;
        line-height: 1.2;
        white-space: nowrap;
        cursor: pointer;
        transition:
          border-color 140ms ease,
          background-color 140ms ease,
          color 140ms ease,
          transform 140ms ease;
      }
      .salary-submit-benefit-chip::before {
        content: '';
        display: block;
        width: 7px;
        height: 7px;
        flex: 0 0 auto;
        border-radius: 999px;
        background: var(--benefit-tone);
      }
      .salary-submit-benefit-chip:hover,
      .salary-submit-benefit-chip:focus-visible {
        outline: 0;
        border-color: color-mix(in oklab, var(--benefit-tone) 64%, rgb(var(--fg)) 16%);
        background:
          linear-gradient(180deg, color-mix(in oklab, var(--benefit-tone) 24%, transparent), color-mix(in oklab, var(--benefit-tone) 12%, transparent)),
          color-mix(in oklab, rgb(var(--bg)) 88%, var(--benefit-tone));
        color: rgb(var(--fg));
        transform: translateY(-1px);
      }
      .salary-submit-benefit-chip.is-selected {
        border-color: color-mix(in oklab, var(--benefit-tone) 54%, rgb(var(--fg)) 10%);
        color: rgb(var(--fg));
      }
      .salary-submit-benefit-chip span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .salary-submit-benefit-chip__remove,
      .salary-submit-benefit-option__add,
      .salary-submit-benefits-add__icon {
        display: inline-grid;
        place-items: center;
        position: relative;
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        border-radius: 999px;
        background: color-mix(in oklab, var(--benefit-tone, rgb(var(--fg))) 18%, transparent);
        color: rgb(var(--fg) / 0.82);
        font-style: normal;
        line-height: 1;
      }
      .salary-submit-benefit-chip__remove::before,
      .salary-submit-benefit-chip__remove::after,
      .salary-submit-benefit-option__add::before,
      .salary-submit-benefit-option__add::after,
      .salary-submit-benefits-add__icon::before,
      .salary-submit-benefits-add__icon::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 8px;
        height: 1.5px;
        border-radius: 999px;
        background: currentColor;
        transform: translate(-50%, -50%);
      }
      .salary-submit-benefit-chip__remove::before {
        transform: translate(-50%, -50%) rotate(45deg);
      }
      .salary-submit-benefit-chip__remove::after {
        transform: translate(-50%, -50%) rotate(-45deg);
      }
      .salary-submit-benefit-option__add::after,
      .salary-submit-benefits-add__icon::after {
        transform: translate(-50%, -50%) rotate(90deg);
      }
      .salary-submit-benefit-option {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        --benefit-tone: rgb(var(--fg));
        min-width: 0;
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid color-mix(in oklab, var(--benefit-tone) 18%, transparent);
        border-radius: 8px;
        background: color-mix(in oklab, var(--benefit-tone) 6%, transparent);
        color: rgb(var(--fg) / 0.84);
        font: inherit;
        font-size: 11px;
        font-weight: 640;
        text-align: left;
        cursor: pointer;
        transition:
          background-color 140ms ease,
          color 140ms ease,
          border-color 140ms ease;
      }
      .salary-submit-benefit-option__check {
        position: relative;
        display: inline-grid;
        place-items: center;
        width: 15px;
        height: 15px;
        flex: 0 0 15px;
        border: 1px solid color-mix(in oklab, var(--benefit-tone) 45%, rgb(var(--fg)) 12%);
        border-radius: 4px;
        background: color-mix(in oklab, rgb(var(--bg)) 86%, var(--benefit-tone));
      }
      .salary-submit-benefit-option__check::after {
        content: '';
        width: 7px;
        height: 3.5px;
        border: solid rgb(var(--bg));
        border-width: 0 0 2px 2px;
        opacity: 0;
        transform: translateY(-1px) rotate(-45deg);
      }
      .salary-submit-benefit-option.is-selected {
        border-color: color-mix(in oklab, var(--benefit-tone) 58%, rgb(var(--fg)) 10%);
        background:
          linear-gradient(180deg, color-mix(in oklab, var(--benefit-tone) 19%, transparent), color-mix(in oklab, var(--benefit-tone) 9%, transparent)),
          color-mix(in oklab, rgb(var(--bg)) 92%, var(--benefit-tone));
        color: rgb(var(--fg));
        font-weight: 760;
      }
      .salary-submit-benefit-option.is-selected .salary-submit-benefit-option__check {
        border-color: var(--benefit-tone);
        background: var(--benefit-tone);
      }
      .salary-submit-benefit-option.is-selected .salary-submit-benefit-option__check::after {
        opacity: 1;
      }
      .salary-submit-benefit-option:hover,
      .salary-submit-benefit-option:focus-visible {
        outline: 0;
        border-color: color-mix(in oklab, var(--benefit-tone) 42%, transparent);
        background: color-mix(in oklab, var(--benefit-tone) 13%, transparent);
        color: rgb(var(--fg));
      }
      .salary-submit-benefit-option span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .salary-submit-benefits-tools {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        padding: 0 10px 9px;
        background: color-mix(in oklab, rgb(var(--fg)) 2%, transparent);
      }
      .salary-submit-benefits-tool.app-icon-action {
        --app-icon-action-expand-width: 82px;
        --app-icon-action-label-max: 56px;
        --app-icon-action-fg: rgb(var(--fg) / 0.72);
        --app-icon-action-fg-hover: rgb(var(--fg) / 0.96);
        --app-icon-action-outline: color-mix(in oklab, rgb(var(--fg)) 15%, transparent);
        --app-icon-action-outline-hover: color-mix(in oklab, rgb(var(--fg)) 32%, transparent);
        --app-icon-action-bg: color-mix(in oklab, rgb(var(--fg)) 3%, transparent);
        --app-icon-action-hover-bg: color-mix(in oklab, rgb(var(--fg)) 7%, transparent);
        appearance: none !important;
        -webkit-appearance: none !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0 !important;
        width: 28px !important;
        height: 28px !important;
        min-height: 28px !important;
        padding: 0 !important;
        border: 1px solid var(--app-icon-action-outline) !important;
        border-radius: 7px;
        background: var(--app-icon-action-bg) !important;
        color: var(--app-icon-action-fg) !important;
        flex: 0 0 auto !important;
        font-size: 11px;
        overflow: visible !important;
        transition:
          width 170ms cubic-bezier(0.2, 0.82, 0.24, 1),
          gap 170ms cubic-bezier(0.2, 0.82, 0.24, 1),
          padding 170ms cubic-bezier(0.2, 0.82, 0.24, 1),
          border-color 0.15s ease,
          background 0.15s ease,
          color 0.15s ease !important;
      }
      .salary-submit-benefits-tool.app-icon-action:hover,
      .salary-submit-benefits-tool.app-icon-action:focus-visible,
      .salary-submit-benefits-tool.app-icon-action:active {
        width: var(--app-icon-action-expand-width) !important;
        gap: 6px !important;
        padding: 0 8px !important;
        border-color: var(--app-icon-action-outline-hover) !important;
        background: var(--app-icon-action-hover-bg) !important;
        color: var(--app-icon-action-fg-hover) !important;
        outline: 0 !important;
      }
      .salary-submit-benefits-tool.app-icon-action i {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 14px !important;
        height: 14px !important;
        flex: 0 0 14px !important;
        margin: 0 !important;
        line-height: 0 !important;
      }
      .salary-submit-benefits-tool.app-icon-action .app-icon-action-label {
        display: block !important;
        max-width: 0 !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow-x: clip !important;
        overflow-y: visible !important;
        opacity: 0 !important;
        color: inherit !important;
        font-size: 10px;
        font-weight: 780;
        line-height: 1;
        letter-spacing: 0.01em;
        white-space: nowrap !important;
        pointer-events: none !important;
        transform: translateX(-3px) !important;
        transition:
          max-width 170ms cubic-bezier(0.2, 0.82, 0.24, 1),
          opacity 120ms ease,
          transform 170ms cubic-bezier(0.2, 0.82, 0.24, 1) !important;
      }
      .salary-submit-benefits-tool.app-icon-action:hover .app-icon-action-label,
      .salary-submit-benefits-tool.app-icon-action:focus-visible .app-icon-action-label,
      .salary-submit-benefits-tool.app-icon-action:active .app-icon-action-label {
        max-width: var(--app-icon-action-label-max) !important;
        opacity: 1 !important;
        transform: translateX(0) !important;
      }
      .salary-submit-benefits-tool__icon {
        position: relative;
        display: inline-grid;
        place-items: center;
        width: 15px;
        height: 15px;
        flex: 0 0 15px;
        border-radius: 999px;
        background: color-mix(in oklab, rgb(var(--fg)) 10%, transparent);
        color: currentColor;
      }
      .salary-submit-benefits-tool__icon::before,
      .salary-submit-benefits-tool__icon::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        border-radius: 999px;
        background: currentColor;
        transform: translate(-50%, -50%);
      }
      .salary-submit-benefits-tool__icon.is-reset::before {
        width: 8px;
        height: 8px;
        border: 1.5px solid currentColor;
        border-right-color: transparent;
        background: transparent;
      }
      .salary-submit-benefits-tool__icon.is-reset::after {
        width: 4px;
        height: 4px;
        clip-path: polygon(0 0, 100% 50%, 0 100%);
        transform: translate(1px, -6px) rotate(-18deg);
      }
      .salary-submit-benefits-tool__icon.is-all::before {
        width: 8px;
        height: 4px;
        border: solid currentColor;
        border-width: 0 0 1.5px 1.5px;
        background: transparent;
        transform: translate(-50%, -62%) rotate(-45deg);
      }
      .salary-submit-benefits-tool__icon.is-invert::before,
      .salary-submit-benefits-tool__icon.is-invert::after {
        width: 8px;
        height: 1.5px;
      }
      .salary-submit-benefits-tool__icon.is-invert::before {
        transform: translate(-50%, -50%) rotate(45deg);
      }
      .salary-submit-benefits-tool__icon.is-invert::after {
        transform: translate(-50%, -50%) rotate(-45deg);
      }
      .salary-submit-benefits-custom {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid color-mix(in oklab, rgb(var(--fg)) 10%, transparent);
        background: color-mix(in oklab, rgb(var(--bg)) 78%, rgb(var(--fg)) 4%);
      }
      .salary-submit-benefits-custom input,
      .salary-submit-benefits-custom button {
        min-height: 32px;
        border: 1px solid color-mix(in oklab, rgb(var(--fg)) 18%, transparent);
        border-radius: 7px;
        background: rgb(var(--bg));
        color: rgb(var(--fg));
        font: inherit;
        font-size: 12px;
      }
      .salary-submit-benefits-custom input {
        min-width: 0;
        padding: 0 10px;
      }
      .salary-submit-benefits-custom input::placeholder {
        color: rgb(var(--muted));
      }
      .salary-submit-benefits-custom input:focus,
      .salary-submit-benefits-custom button:hover,
      .salary-submit-benefits-custom button:focus-visible {
        outline: 0;
        border-color: color-mix(in oklab, rgb(var(--fg)) 34%, transparent);
        background: color-mix(in oklab, rgb(var(--fg)) 5%, transparent);
      }
      .salary-submit-benefits-custom button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-width: 78px;
        padding: 0 13px;
        cursor: pointer;
        font-weight: 780;
        background:
          linear-gradient(180deg, color-mix(in oklab, rgb(var(--fg)) 12%, transparent), color-mix(in oklab, rgb(var(--fg)) 6%, transparent)),
          rgb(var(--bg));
      }
      .salary-submit-benefits-add__icon {
        width: 17px;
        height: 17px;
        flex-basis: 17px;
        background: color-mix(in oklab, rgb(var(--fg)) 12%, transparent);
        color: rgb(var(--fg));
      }
      .salary-submit-form__actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding-top: 4px;
      }
      .salary-submit-form__actions a {
        color: rgb(var(--muted));
        font-size: 12px;
        text-decoration: none;
      }
      .salary-submit-form__actions a:hover,
      .salary-submit-form__actions a:focus-visible {
        color: rgb(var(--fg));
      }
      .salary-submit-form__actions button {
        min-height: 40px;
        padding-inline: 20px;
      }
      @media (max-width: 980px) {
        .salary-submit-page__intro {
          padding-inline: 28px;
        }
        .salary-submit-form {
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .salary-submit-form__rail {
          position: static;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 16px;
          padding: 0;
        }
        .salary-submit-form__rail nav {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .salary-submit-form__rail small {
          display: none;
        }
        .salary-submit-grid--four {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro {
          align-items: start;
          flex-direction: column;
          gap: 18px;
          padding: 28px 18px 20px;
        }
        .salary-submit-page__intro h1 {
          font-size: 27px;
        }
        .salary-submit-page__meta {
          gap: 18px;
        }
        .salary-submit-page__message,
        .salary-submit-form {
          width: calc(100% - 32px);
        }
        .salary-submit-form {
          padding-top: 20px;
        }
        .salary-submit-form__rail {
          display: block;
        }
        .salary-submit-form__rail > p,
        .salary-submit-form__rail small {
          display: none;
        }
        .salary-submit-form__rail nav {
          display: flex;
          overflow-x: auto;
          gap: 12px;
        }
        .salary-submit-form__rail a {
          flex: 0 0 auto;
          padding: 8px 0;
        }
        .salary-submit-section {
          padding: 21px 16px;
        }
        .salary-submit-grid--three,
        .salary-submit-grid--four,
        .salary-submit-grid--context {
          grid-template-columns: 1fr;
        }
        .salary-submit-form__actions {
          align-items: stretch;
          flex-direction: column-reverse;
        }
        .salary-submit-form__actions button {
          width: 100%;
        }
        .salary-submit-form__actions a {
          align-self: center;
          padding: 8px;
        }
      }

      :host ::ng-deep .salary-submit-studio .ss-inline-trigger {
        height: 64px;
        border-color: color-mix(in oklab, var(--app-color-card-border) 92%, var(--app-color-body));
        border-radius: 2px;
        background: color-mix(in oklab, var(--app-color-canvas) 72%, var(--app-color-card-bg));
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger:hover {
        border-color: color-mix(in oklab, var(--app-color-primary) 56%, var(--app-color-card-border));
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger:focus-within,
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger.focused {
        border-color: var(--app-color-primary);
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--app-color-primary) 13%, transparent);
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-input,
      :host ::ng-deep .salary-submit-studio .ss-label {
        padding-inline: 18px;
        color: var(--app-color-body);
        font-size: 15px;
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-input::placeholder {
        color: var(--app-color-text-muted);
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger button {
        width: 58px;
        color: var(--app-color-primary-text);
      }
      /* Dropdown trigger: a deliberate control, not a cramped arrow at the field edge. */
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger {
        width: 64px !important;
        min-width: 64px;
        border-left: 1px solid var(--app-color-card-border);
        background: color-mix(in oklab, var(--app-color-card-bg) 72%, var(--app-color-canvas));
        transition: background 180ms ease, box-shadow 180ms ease;
      }
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:hover {
        background: var(--app-color-primary-bg);
      }
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:focus-visible {
        box-shadow: inset 0 0 0 2px var(--app-color-primary);
      }
      :host ::ng-deep .salary-submit-studio .ss-caret-box {
        width: 100%;
        border: 0;
        border-radius: 0;
        background: transparent;
      }
      :host ::ng-deep .salary-submit-studio .ss-caret {
        width: 10px;
        height: 10px;
        border-width: 0 2px 2px 0;
        border-color: var(--app-color-primary-text);
      }
      .salary-submit-studio .proj-toolbar-btn--primary {
        border-color: var(--app-color-primary) !important;
        background: var(--app-color-primary) !important;
        color: var(--app-color-canvas) !important;
      }
      .salary-submit-studio .proj-toolbar-btn--primary span {
        margin-left: 11px;
        font-size: 22px;
        line-height: 0;
      }
      .salary-submit-wizard-nav {
        position: relative;
        width: calc(100% - 56px);
        margin: 0 auto;
        padding-top: 18px;
      }
      .salary-submit-wizard-nav__list {
        display: flex;
        gap: 8px;
        min-width: 0;
      }
      .salary-submit-wizard-nav .tab-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 42px;
        padding: 0 14px 12px;
        border: 0;
        background: transparent;
        color: rgb(var(--muted));
        font: inherit;
        cursor: pointer;
      }
      .salary-submit-wizard-nav .tab-btn span {
        color: rgb(var(--primary));
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        font-weight: 800;
      }
      .salary-submit-wizard-nav .tab-btn strong {
        font-size: 12px;
        font-weight: 700;
      }
      .salary-submit-wizard-nav .tab-btn:hover,
      .salary-submit-wizard-nav .tab-btn:focus-visible,
      .salary-submit-wizard-nav .tab-btn.active {
        color: rgb(var(--fg));
        outline: 0;
      }
      .salary-submit-wizard-nav .stretch-tabs-indicator {
        position: absolute;
        bottom: -1px;
        height: 2px;
        background: rgb(var(--primary));
        opacity: 0;
        pointer-events: none;
      }
      .salary-submit-wizard-nav .stretch-tabs-indicator.is-visible {
        opacity: 1;
      }
      .salary-submit-form {
        display: block;
        width: calc(100% - 56px);
        margin: 0 auto;
        padding: 24px 0 52px;
      }
      .salary-submit-section {
        display: none;
        max-width: none;
        padding: 30px;
      }
      .salary-submit-section.is-active-step {
        display: block;
      }
      .salary-submit-form__actions > div {
        display: flex;
        gap: 10px;
      }
      .salary-submit-page__intro {
        align-items: center;
        gap: 24px;
        padding: 28px;
        background: rgb(var(--panel));
      }
      .salary-submit-page__intro h1 {
        margin-top: 8px;
        font-size: 27px;
        font-weight: 720;
        letter-spacing: -0.028em;
      }
      .salary-submit-page__intro > div > p:last-child {
        max-width: 760px;
        margin-top: 8px;
        font-size: 12px;
      }
      .salary-submit-page__meta {
        gap: 16px;
        padding: 9px 12px;
        background: rgb(var(--bg));
        border-radius: 5px;
      }
      .salary-submit-page__meta span {
        min-width: 58px;
      }
      .salary-submit-page__message {
        width: calc(100% - 56px);
        margin-top: 16px;
        border: 0;
        border-radius: 5px;
        padding: 12px 14px;
        background: rgb(var(--primary) / 0.1);
      }
      .salary-submit-page__message.is-error {
        background: rgb(225 90 90 / 0.1);
      }
      .salary-submit-wizard-nav {
        padding-top: 14px;
      }
      .salary-submit-wizard-nav .tab-btn {
        height: 44px;
        padding-bottom: 10px;
      }
      .salary-submit-wizard-nav .tab-btn.active {
        background: rgb(var(--panel));
      }
      .salary-submit-form {
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 312px);
        padding-top: 20px;
      }
      .salary-submit-section {
        padding: 30px;
        border-color: rgb(var(--border) / 0.72);
        box-shadow: 0 18px 38px rgb(0 0 0 / 0.08);
      }
      .salary-submit-section__hint {
        margin-bottom: 26px;
      }
      .salary-submit-form__actions {
        margin-top: auto;
        min-height: 58px;
        padding: 16px 0 0;
      }
      .salary-submit-form__actions > div {
        padding: 5px;
        background: rgb(var(--panel));
        border-radius: 6px;
      }
      .salary-submit-form__actions button {
        min-width: 112px;
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro {
          padding: 24px 16px 18px;
        }
        .salary-submit-page__meta {
          align-self: stretch;
        }
        .salary-submit-page__message {
          width: calc(100% - 32px);
        }
        .salary-submit-form {
          min-height: 0;
        }
        .salary-submit-section {
          padding: 22px 16px;
          box-shadow: none;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-wizard-nav,
        .salary-submit-form {
          width: calc(100% - 32px);
        }
        .salary-submit-wizard-nav {
          overflow-x: auto;
        }
        .salary-submit-wizard-nav__list {
          min-width: max-content;
        }
        .salary-submit-wizard-nav .tab-btn {
          padding-inline: 9px;
        }
        .salary-submit-form__actions > div {
          width: 100%;
        }
        .salary-submit-form__actions > div button {
          flex: 1 1 auto;
        }
      }

      /* Submit workspace: intentionally minimal, with hierarchy from layout rather than boxes. */
      .salary-submit-page {
        background: rgb(var(--bg));
      }
      .salary-submit-page__intro {
        align-items: flex-start;
        min-height: 0;
        padding: 30px 32px 16px;
        background: transparent;
      }
      .salary-submit-page__eyebrow {
        font-size: 9px;
        letter-spacing: 0.16em;
      }
      .salary-submit-page__intro h1 {
        margin-top: 7px;
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -0.025em;
      }
      .salary-submit-page__intro > div > p:last-child {
        max-width: 680px;
        margin-top: 6px;
        line-height: 1.45;
      }
      .salary-submit-page__meta {
        gap: 20px;
        padding: 2px 0;
        background: transparent;
        border-radius: 0;
      }
      .salary-submit-page__meta span {
        min-width: 0;
      }
      .salary-submit-page__message {
        width: calc(100% - 64px);
        margin: 0 32px;
        padding: 9px 0;
        background: transparent;
        border-radius: 0;
        color: rgb(var(--muted));
        font-size: 11px;
      }
      .salary-submit-page__message::before {
        display: inline-block;
        width: 6px;
        height: 6px;
        margin-right: 8px;
        border-radius: 50%;
        background: rgb(var(--primary));
        content: '';
        vertical-align: 1px;
      }
      .salary-submit-page__message.is-error {
        background: transparent;
        color: rgb(255 181 181);
      }
      .salary-submit-page__message.is-error::before {
        background: rgb(225 90 90);
      }
      .salary-submit-wizard-nav {
        width: calc(100% - 64px);
        margin: 4px 32px 0;
        padding: 0;
      }
      .salary-submit-wizard-nav__list {
        justify-content: flex-start;
        gap: 2px;
      }
      .salary-submit-wizard-nav .tab-btn {
        height: 46px;
        padding: 0 18px 9px 0;
      }
      .salary-submit-wizard-nav .tab-btn + .tab-btn {
        padding-left: 18px;
      }
      .salary-submit-wizard-nav .tab-btn.active {
        background: transparent;
      }
      .salary-submit-wizard-nav .tab-btn strong {
        font-size: 12px;
        font-weight: 650;
      }
      .salary-submit-wizard-nav .tab-btn.active strong {
        font-weight: 780;
      }
      .salary-submit-wizard-nav .stretch-tabs-indicator {
        height: 2px;
      }
      .salary-submit-form {
        width: 100%;
        min-height: 0;
        margin: 0;
        padding: 0 32px 28px;
      }
      .salary-submit-section {
        display: none;
        min-height: 340px;
        padding: 30px 0 36px;
        border: 0;
        border-top: 1px solid rgb(var(--border) / 0.72);
        background: transparent;
        box-shadow: none;
      }
      .salary-submit-section.is-active-step {
        display: grid;
        grid-template-columns: minmax(190px, 23%) minmax(0, 1fr);
        column-gap: 46px;
        align-content: start;
      }
      .salary-submit-section legend {
        grid-column: 1;
        grid-row: 1;
        padding: 0;
        font-size: 18px;
        line-height: 1.25;
      }
      .salary-submit-section__hint {
        grid-column: 1;
        grid-row: 2;
        margin: 10px 0 0;
        color: rgb(var(--muted));
        font-size: 11px;
        line-height: 1.55;
      }
      .salary-submit-grid {
        grid-column: 2;
        grid-row: 1 / span 3;
        gap: 22px 18px;
      }
      .salary-submit-grid--four {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      #salary-package .salary-submit-grid--four {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .salary-submit-field {
        gap: 7px;
      }
      .salary-submit-field > span {
        font-size: 9px;
        letter-spacing: 0.075em;
      }
      .salary-submit-field textarea {
        min-height: 156px;
        padding: 12px 13px;
        border-color: rgb(var(--border) / 0.78);
        background: rgb(var(--panel));
        border-radius: 4px;
      }
      .salary-submit-form__actions {
        min-height: 0;
        margin-top: 0;
        padding: 18px 0 0;
        border-top: 1px solid rgb(var(--border) / 0.72);
      }
      .salary-submit-form__actions > div {
        padding: 0;
        background: transparent;
        border-radius: 0;
      }
      .salary-submit-form__actions button {
        min-width: 116px;
      }
      @media (max-width: 820px) {
        .salary-submit-page__intro,
        .salary-submit-form {
          padding-inline: 22px;
        }
        .salary-submit-wizard-nav {
          width: calc(100% - 44px);
          margin-inline: 22px;
        }
        .salary-submit-page__message {
          width: calc(100% - 44px);
          margin-inline: 22px;
        }
        .salary-submit-section.is-active-step {
          grid-template-columns: 1fr;
          row-gap: 0;
        }
        .salary-submit-section legend,
        .salary-submit-section__hint,
        .salary-submit-grid {
          grid-column: 1;
          grid-row: auto;
        }
        .salary-submit-section__hint {
          margin: 8px 0 24px;
          max-width: 620px;
        }
        #salary-package .salary-submit-grid--four {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro {
          padding: 24px 16px 14px;
        }
        .salary-submit-page__meta {
          gap: 14px;
        }
        .salary-submit-page__message,
        .salary-submit-wizard-nav {
          width: calc(100% - 32px);
          margin-inline: 16px;
        }
        .salary-submit-wizard-nav .tab-btn {
          padding-right: 12px;
        }
        .salary-submit-wizard-nav .tab-btn + .tab-btn {
          padding-left: 12px;
        }
        .salary-submit-form {
          padding: 0 16px 22px;
        }
        .salary-submit-section {
          min-height: 0;
          padding: 24px 0 28px;
        }
        .salary-submit-grid--four,
        #salary-package .salary-submit-grid--four,
        .salary-submit-grid--context {
          grid-template-columns: 1fr;
        }
      }

      /* Focus-form direction: one clear work area per step, no decorative chrome. */
      .salary-submit-page__intro {
        padding: 22px 32px 12px;
      }
      .salary-submit-page__eyebrow {
        font-size: 9px;
        letter-spacing: 0.18em;
      }
      .salary-submit-page__intro h1 {
        margin-top: 6px;
        font-size: 24px;
        font-weight: 680;
        letter-spacing: -0.02em;
      }
      .salary-submit-page__intro > div > p:last-child {
        margin-top: 5px;
        font-size: 11px;
      }
      .salary-submit-page__meta {
        display: none;
      }
      .salary-submit-wizard-nav {
        width: calc(100% - 64px);
        margin: 0 32px;
      }
      .salary-submit-wizard-nav__list {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0;
      }
      .salary-submit-wizard-nav .tab-btn,
      .salary-submit-wizard-nav .tab-btn + .tab-btn {
        justify-content: flex-start;
        height: 50px;
        padding: 0 12px 10px 0;
      }
      .salary-submit-wizard-nav .tab-btn span {
        color: rgb(var(--muted));
      }
      .salary-submit-wizard-nav .tab-btn.active span {
        color: rgb(var(--primary));
      }
      .salary-submit-wizard-nav .tab-btn strong {
        font-size: 11px;
        font-weight: 620;
      }
      .salary-submit-wizard-nav .tab-btn.active strong {
        color: rgb(var(--fg));
        font-weight: 780;
      }
      .salary-submit-form {
        padding: 14px 32px 28px;
      }
      .salary-submit-section {
        min-height: 390px;
        padding: 36px;
        border: 0;
        border-radius: 8px;
        background: rgb(var(--panel));
        box-shadow: none;
      }
      .salary-submit-section.is-active-step {
        grid-template-columns: minmax(220px, 27%) minmax(0, 1fr);
        column-gap: 54px;
      }
      .salary-submit-section legend {
        display: grid;
        gap: 10px;
        font-size: 20px;
        font-weight: 680;
        letter-spacing: -0.02em;
      }
      .salary-submit-section legend span {
        display: block;
        margin: 0;
        color: rgb(var(--primary));
        font-size: 38px;
        font-weight: 740;
        letter-spacing: -0.06em;
        line-height: 0.9;
      }
      .salary-submit-section__hint {
        margin-top: 14px;
        font-size: 12px;
        line-height: 1.55;
      }
      .salary-submit-grid {
        align-content: start;
        gap: 26px 20px;
      }
      .salary-submit-grid--four,
      #salary-package .salary-submit-grid--four {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .salary-submit-field > span {
        color: rgb(var(--fg) / 0.72);
        font-size: 10px;
        font-weight: 760;
        letter-spacing: 0.025em;
        text-transform: none !important;
      }
      .salary-submit-form__actions {
        margin-top: 14px;
        padding: 14px 0 0;
        border-top: 0;
      }
      .salary-submit-form__actions a {
        padding: 10px 0;
      }
      .salary-submit-form__actions > div {
        gap: 8px;
      }
      .salary-submit-form__actions button {
        min-width: 126px;
        min-height: 42px;
      }
      @media (max-width: 820px) {
        .salary-submit-wizard-nav {
          width: calc(100% - 44px);
          margin-inline: 22px;
        }
        .salary-submit-form {
          padding-inline: 22px;
        }
        .salary-submit-section {
          padding: 28px;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro {
          padding: 22px 16px 10px;
        }
        .salary-submit-wizard-nav {
          width: calc(100% - 32px);
          margin-inline: 16px;
        }
        .salary-submit-wizard-nav__list {
          display: flex;
          gap: 0;
        }
        .salary-submit-wizard-nav .tab-btn,
        .salary-submit-wizard-nav .tab-btn + .tab-btn {
          flex: 0 0 auto;
          padding-right: 16px;
          padding-left: 0;
        }
        .salary-submit-form {
          padding: 12px 16px 20px;
        }
        .salary-submit-section {
          min-height: 0;
          padding: 24px 18px;
        }
        .salary-submit-section legend span {
          font-size: 31px;
        }
        .salary-submit-section__hint {
          margin: 8px 0 24px;
        }
      }

      /* Bridge the feature to the application's semantic theme tokens. */
      :host,
      .salary-submit-page {
        background: var(--app-color-canvas);
        color: var(--app-color-body);
      }
      .salary-submit-page__intro,
      .salary-submit-page__intro h1,
      .salary-submit-wizard-nav .tab-btn.active,
      .salary-submit-wizard-nav .tab-btn.active strong {
        color: var(--app-color-body);
      }
      .salary-submit-page__eyebrow,
      .salary-submit-page__intro b,
      .salary-submit-wizard-nav .tab-btn.active span,
      .salary-submit-section legend span,
      .salary-submit-field b {
        color: var(--app-color-primary-text);
      }
      .salary-submit-page__intro > div > p:last-child,
      .salary-submit-page__message,
      .salary-submit-page__meta,
      .salary-submit-section__hint,
      .salary-submit-form__actions a,
      .salary-submit-field > span,
      .salary-submit-wizard-nav .tab-btn,
      .salary-submit-wizard-nav .tab-btn span {
        color: var(--app-color-text-muted);
      }
      .salary-submit-page__message::before,
      .salary-submit-wizard-nav .stretch-tabs-indicator {
        background: var(--app-color-primary);
      }
      .salary-submit-section {
        background: var(--app-color-card-bg);
        box-shadow: inset 0 0 0 1px var(--app-color-card-border);
      }
      .salary-submit-field textarea {
        border-color: var(--app-color-control-border);
        background: var(--app-color-control-bg);
        color: var(--app-color-body);
      }
      .salary-submit-field textarea:hover {
        border-color: var(--app-color-outline);
      }
      .salary-submit-field textarea:focus {
        border-color: var(--app-color-primary-border-strong);
        box-shadow: 0 0 0 3px var(--app-color-primary-bg);
      }

      /* Contribution Studio: a deliberate full-width workflow, not a generic tabbed form. */
      .salary-submit-studio {
        display: grid;
        grid-template-columns: 248px minmax(0, 1fr);
        min-height: calc(100vh - 224px);
        margin: 8px 32px 32px;
        border: 1px solid var(--app-color-card-border);
        border-radius: 10px;
        overflow: hidden;
        background: var(--app-color-card-bg);
      }
      .salary-submit-progress {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 26px 18px;
        background: color-mix(in oklab, var(--app-color-canvas) 68%, var(--app-color-card-bg));
      }
      .salary-submit-progress__counter {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: end;
        column-gap: 5px;
        color: var(--app-color-text-muted);
      }
      .salary-submit-progress__counter strong {
        color: var(--app-color-primary-text);
        font-size: 44px;
        font-weight: 760;
        letter-spacing: -0.08em;
        line-height: 0.8;
      }
      .salary-submit-progress__counter span {
        padding-bottom: 2px;
        font-size: 13px;
        font-weight: 700;
      }
      .salary-submit-progress__counter small {
        grid-column: 1 / -1;
        margin-top: 11px;
        color: var(--app-color-text-muted);
        font-size: 9px;
        font-weight: 760;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list {
        display: grid;
        gap: 4px;
      }
      .salary-submit-progress .tab-btn,
      .salary-submit-progress .tab-btn + .tab-btn {
        display: grid;
        grid-template-columns: 25px 1fr;
        align-items: center;
        gap: 10px;
        width: 100%;
        height: 46px;
        padding: 0 8px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--app-color-text-muted);
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: background 180ms ease, color 180ms ease;
      }
      .salary-submit-progress .tab-btn span {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border: 1px solid var(--app-color-card-border);
        border-radius: 50%;
        color: var(--app-color-text-muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 9px;
        font-weight: 800;
      }
      .salary-submit-progress .tab-btn strong {
        font-size: 12px;
        font-weight: 620;
      }
      .salary-submit-progress .tab-btn:hover,
      .salary-submit-progress .tab-btn:focus-visible {
        background: color-mix(in oklab, var(--app-color-primary-bg) 70%, transparent);
        color: var(--app-color-body);
        outline: 0;
      }
      .salary-submit-progress .tab-btn.active {
        background: var(--app-color-primary-bg);
        color: var(--app-color-body);
      }
      .salary-submit-progress .tab-btn.active span {
        border-color: var(--app-color-primary);
        background: var(--app-color-primary);
        color: var(--app-color-canvas);
      }
      .salary-submit-progress .tab-btn.active strong {
        color: var(--app-color-body);
        font-weight: 780;
      }
      .salary-submit-studio .salary-submit-form {
        width: auto;
        min-height: 0;
        margin: 0;
        padding: 34px 40px 28px;
        background: var(--app-color-canvas);
      }
      .salary-submit-studio .salary-submit-section {
        min-height: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }
      .salary-submit-studio .salary-submit-section.is-active-step {
        display: block;
      }
      .salary-submit-studio .salary-submit-section legend {
        display: flex;
        align-items: baseline;
        gap: 11px;
        padding: 0;
        color: var(--app-color-body);
        font-size: 21px;
        font-weight: 700;
      }
      .salary-submit-studio .salary-submit-section legend span {
        display: inline;
        margin: 0;
        color: var(--app-color-primary-text);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        line-height: 1;
      }
      .salary-submit-studio .salary-submit-section__hint {
        max-width: 660px;
        margin: 9px 0 32px;
        color: var(--app-color-text-muted);
        font-size: 12px;
      }
      .salary-submit-studio .salary-submit-grid {
        display: grid;
        gap: 24px 20px;
      }
      .salary-submit-studio .salary-submit-grid--four,
      .salary-submit-studio #salary-package .salary-submit-grid--four {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .salary-submit-studio .salary-submit-field {
        gap: 8px;
      }
      .salary-submit-studio .salary-submit-field > span {
        color: var(--app-color-body);
        font-size: 11px;
        font-weight: 690;
        letter-spacing: 0;
      }
      .salary-submit-studio .salary-submit-form__actions {
        margin-top: 44px;
        padding-top: 18px;
        border-top: 1px solid var(--app-color-card-border);
      }
      @media (max-width: 900px) {
        .salary-submit-studio {
          grid-template-columns: 1fr;
          min-height: 0;
          margin: 8px 22px 24px;
        }
        .salary-submit-progress {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 18px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--app-color-card-border);
        }
        .salary-submit-progress .salary-submit-wizard-nav__list {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .salary-submit-progress .tab-btn,
        .salary-submit-progress .tab-btn + .tab-btn {
          grid-template-columns: 24px 1fr;
          padding-inline: 5px;
        }
        .salary-submit-studio .salary-submit-form {
          padding: 30px 28px 24px;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-studio {
          margin: 8px 16px 18px;
          border-radius: 8px;
        }
        .salary-submit-progress {
          display: block;
          padding: 17px 14px 12px;
        }
        .salary-submit-progress__counter {
          display: none;
        }
        .salary-submit-progress .salary-submit-wizard-nav__list {
          display: flex;
          overflow-x: auto;
        }
        .salary-submit-progress .tab-btn,
        .salary-submit-progress .tab-btn + .tab-btn {
          flex: 0 0 auto;
          width: auto;
          padding-inline: 8px;
        }
        .salary-submit-studio .salary-submit-form {
          padding: 26px 18px 20px;
        }
        .salary-submit-studio .salary-submit-grid--four,
        .salary-submit-studio #salary-package .salary-submit-grid--four,
        .salary-submit-studio .salary-submit-grid--context {
          grid-template-columns: 1fr;
        }
      }

      /* Art direction matched to the approved Contribution Studio concept. */
      .salary-submit-page__intro {
        padding: 42px 46px 24px;
      }
      .salary-submit-page__eyebrow,
      .salary-submit-page__intro > div > p:last-child {
        display: none;
      }
      .salary-submit-page__intro h1 {
        margin: 0;
        color: var(--app-color-body);
        font-size: 47px;
        font-weight: 720;
        letter-spacing: -0.045em;
        line-height: 1;
        text-transform: none !important;
      }
      .salary-submit-studio {
        grid-template-columns: 300px minmax(0, 1fr);
        min-height: calc(100vh - 256px);
        margin: 0 32px 32px;
        border-color: color-mix(in oklab, var(--app-color-card-border) 88%, transparent);
        border-radius: 6px;
      }
      .salary-submit-progress {
        gap: 38px;
        padding: 42px 44px;
        background: color-mix(in oklab, var(--app-color-canvas) 82%, var(--app-color-card-bg));
      }
      .salary-submit-progress__counter strong {
        font-size: 46px;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list {
        position: relative;
        grid-template-columns: minmax(0, 1fr);
        gap: 18px;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list::before {
        position: absolute;
        top: 28px;
        bottom: 28px;
        left: 12px;
        width: 1px;
        background: var(--app-color-card-border);
        content: '';
      }
      .salary-submit-progress .tab-btn,
      .salary-submit-progress .tab-btn + .tab-btn {
        grid-template-columns: 26px 1fr;
        gap: 16px;
        height: 56px;
        padding: 0;
        border-radius: 0;
      }
      .salary-submit-progress .tab-btn span {
        z-index: 1;
        width: 25px;
        height: 25px;
        background: var(--app-color-canvas);
      }
      .salary-submit-progress .tab-btn.active,
      .salary-submit-progress .tab-btn:hover,
      .salary-submit-progress .tab-btn:focus-visible {
        background: transparent;
      }
      .salary-submit-progress .tab-btn strong {
        font-size: 14px;
        font-weight: 560;
      }
      .salary-submit-progress .tab-btn.active strong {
        color: var(--app-color-primary-text);
        font-weight: 720;
      }
      .salary-submit-studio .salary-submit-form {
        padding: 44px 58px 28px;
        background: color-mix(in oklab, var(--app-color-card-bg) 48%, var(--app-color-canvas));
      }
      .salary-submit-studio .salary-submit-section legend {
        font-size: 30px;
        font-weight: 700;
        letter-spacing: -0.035em;
      }
      .salary-submit-studio .salary-submit-section legend span {
        display: none;
      }
      .salary-submit-studio .salary-submit-section__hint {
        display: none;
      }
      .salary-submit-studio .salary-submit-grid {
        margin-top: 42px;
        gap: 42px 28px;
      }
      .salary-submit-studio .salary-submit-field {
        gap: 11px;
      }
      .salary-submit-studio .salary-submit-field > span {
        font-size: 13px;
        font-weight: 620;
      }
      .salary-submit-studio .salary-submit-field textarea {
        min-height: 178px;
      }
      .salary-submit-studio .salary-submit-form__actions {
        margin: 84px -58px -28px;
        padding: 24px 58px;
        border-top: 1px solid var(--app-color-card-border);
      }
      .salary-submit-studio .salary-submit-form__actions a {
        color: var(--app-color-primary-text);
        font-size: 14px;
      }
      .salary-submit-studio .salary-submit-form__actions button {
        min-width: 176px;
        min-height: 56px;
        font-size: 15px;
        font-weight: 720;
      }
      @media (max-width: 900px) {
        .salary-submit-page__intro {
          padding: 34px 30px 20px;
        }
        .salary-submit-page__intro h1 {
          font-size: 38px;
        }
        .salary-submit-studio {
          grid-template-columns: 1fr;
        }
        .salary-submit-progress {
          padding: 20px 28px;
        }
        .salary-submit-progress .salary-submit-wizard-nav__list {
          gap: 0;
        }
        .salary-submit-progress .salary-submit-wizard-nav__list::before {
          display: none;
        }
        .salary-submit-studio .salary-submit-form {
          padding: 34px 32px 24px;
        }
        .salary-submit-studio .salary-submit-form__actions {
          margin: 56px -32px -24px;
          padding: 20px 32px;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro {
          padding: 28px 20px 18px;
        }
        .salary-submit-page__intro h1 {
          font-size: 32px;
        }
        .salary-submit-progress {
          padding: 14px 18px;
        }
        .salary-submit-progress .tab-btn strong {
          font-size: 12px;
        }
        .salary-submit-studio .salary-submit-form {
          padding: 30px 22px 20px;
        }
        .salary-submit-studio .salary-submit-section legend {
          font-size: 25px;
        }
        .salary-submit-studio .salary-submit-grid {
          margin-top: 30px;
          gap: 24px;
        }
        .salary-submit-studio .salary-submit-form__actions {
          margin: 42px -22px -20px;
          padding: 18px 22px;
        }
        .salary-submit-studio .salary-submit-form__actions button {
          min-width: 132px;
          min-height: 48px;
        }
      }

      /* Final surface contract: one outline vocabulary for every editable boundary. */
      .salary-submit-studio {
        --submit-outline: color-mix(
          in oklab,
          var(--app-color-card-border) 72%,
          var(--app-color-body) 28%
        );
        --submit-outline-quiet: color-mix(
          in oklab,
          var(--app-color-card-border) 86%,
          transparent
        );
        --submit-outline-active: color-mix(
          in oklab,
          var(--app-color-primary) 78%,
          var(--app-color-card-border)
        );
        border-color: var(--submit-outline);
      }
      .salary-submit-progress {
        border-right: 1px solid var(--submit-outline-quiet);
      }
      .salary-submit-progress .salary-submit-wizard-nav__list::before {
        background: var(--submit-outline-quiet);
      }
      .salary-submit-progress .tab-btn span {
        border-color: var(--submit-outline);
      }
      .salary-submit-progress .tab-btn:hover span,
      .salary-submit-progress .tab-btn:focus-visible span {
        border-color: var(--submit-outline-active);
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger {
        border-color: var(--submit-outline);
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger:hover {
        border-color: var(--submit-outline-active);
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger:focus-within,
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger.focused {
        border-color: var(--submit-outline-active);
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--app-color-primary) 15%, transparent);
      }
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger {
        border-left-color: var(--submit-outline);
      }
      .salary-submit-studio .salary-submit-form__actions {
        border-top-color: var(--submit-outline-quiet);
      }
      .salary-submit-studio .proj-toolbar-btn--primary {
        border-color: color-mix(in oklab, var(--app-color-primary) 78%, var(--app-color-canvas)) !important;
        box-shadow: 0 1px 0 color-mix(in oklab, var(--app-color-canvas) 24%, transparent);
        transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease,
          transform 180ms ease;
      }
      .salary-submit-studio .proj-toolbar-btn--primary:hover {
        background: color-mix(in oklab, var(--app-color-primary) 88%, var(--app-color-body)) !important;
        box-shadow: 0 4px 14px color-mix(in oklab, var(--app-color-primary) 18%, transparent);
        transform: translateY(-1px);
      }
      .salary-submit-studio .proj-toolbar-btn--primary:active {
        box-shadow: none;
        transform: translateY(0);
      }
      .salary-submit-studio .proj-toolbar-btn--primary:focus-visible {
        outline: 2px solid var(--app-color-primary-text);
        outline-offset: 3px;
      }
      @media (max-width: 900px) {
        .salary-submit-progress {
          border-right: 0;
          border-bottom-color: var(--submit-outline-quiet);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .salary-submit-studio .proj-toolbar-btn--primary,
        :host ::ng-deep .salary-submit-studio .ss-caret-trigger {
          transition: none;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-studio {
          width: auto;
          min-width: 0;
          margin: 0 12px 18px;
          grid-template-columns: minmax(0, 1fr);
        }
        .salary-submit-studio .salary-submit-form,
        .salary-submit-studio .salary-submit-section,
        .salary-submit-studio .salary-submit-grid,
        .salary-submit-studio .salary-submit-field {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .salary-submit-studio .salary-submit-section.is-active-step,
        .salary-submit-studio .salary-submit-form__actions {
          flex: 0 0 auto;
        }
        .salary-submit-studio .salary-submit-grid--four,
        .salary-submit-studio #salary-package .salary-submit-grid--four,
        .salary-submit-studio .salary-submit-grid--context {
          grid-template-columns: minmax(0, 1fr);
        }
        .salary-submit-studio .salary-submit-form__actions {
          width: 100%;
          box-sizing: border-box;
          margin: 32px 0 0;
          padding: 18px 0 0;
        }
      }

      /* Motion is reserved for navigation and direct feedback, never decoration. */
      @keyframes salary-submit-step-reveal {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .salary-submit-studio .salary-submit-section.is-active-step {
        animation: salary-submit-step-reveal 220ms cubic-bezier(0.22, 1, 0.36, 1);
        flex: 0 0 auto;
      }
      @media (min-width: 901px) {
        .salary-submit-studio {
          height: calc(100dvh - 172px);
          min-height: 620px;
        }
        .salary-submit-studio .salary-submit-form {
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
          height: 100%;
          min-height: 0;
          padding: 44px 58px 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .salary-submit-studio .salary-submit-section.is-active-step {
          display: block;
          min-height: 0;
          padding: 0 10px 42px 0;
          box-sizing: border-box;
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-gutter: stable;
        }
        .salary-submit-studio .salary-submit-form__actions {
          grid-row: 2;
          align-self: stretch;
          min-height: 88px;
          margin: 0 -58px;
          padding: 20px 58px 24px;
          box-sizing: border-box;
          background: color-mix(in oklab, var(--app-color-card-bg) 48%, var(--app-color-canvas));
        }
      }
      .salary-submit-progress .tab-btn,
      .salary-submit-studio .proj-toolbar-btn--primary,
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger,
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger {
        transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
      }
      .salary-submit-progress .tab-btn:active,
      .salary-submit-studio .proj-toolbar-btn--primary:active,
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:active {
        transform: scale(0.97);
      }
      @media (hover: hover) and (pointer: fine) {
        .salary-submit-progress .tab-btn:hover strong {
          transform: translateX(3px);
        }
        .salary-submit-progress .tab-btn strong {
          transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .salary-submit-studio .salary-submit-section.is-active-step {
          animation: none;
        }
        .salary-submit-progress .tab-btn:active,
        .salary-submit-studio .proj-toolbar-btn--primary:active,
        :host ::ng-deep .salary-submit-studio .ss-caret-trigger:active {
          transform: none;
        }
      }

      /* Layout recovery: the form body owns the available width. */
      .salary-submit-studio .salary-submit-form {
        display: flex !important;
        flex-direction: column;
        width: 100% !important;
        min-width: 0;
      }
      .salary-submit-studio .salary-submit-section.is-active-step {
        display: block !important;
        width: 100% !important;
        min-width: 0;
      }
      .salary-submit-studio .salary-submit-grid,
      .salary-submit-studio .salary-submit-grid--four,
      .salary-submit-studio #salary-package .salary-submit-grid--four,
      .salary-submit-studio .salary-submit-grid--context {
        display: grid !important;
        grid-column: auto !important;
        grid-row: auto !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        width: 100% !important;
        min-width: 0;
      }
      .salary-submit-studio .salary-submit-field,
      :host ::ng-deep .salary-submit-studio search-select,
      :host ::ng-deep .salary-submit-studio .ss,
      :host ::ng-deep .salary-submit-studio .ss-origin,
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger {
        width: 100% !important;
        min-width: 0 !important;
      }
      .salary-submit-page > .salary-submit-form__actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        min-height: 72px;
        margin: 0 40px 32px;
        padding: 18px 0 0;
        border-top: 0;
        background: transparent;
      }

      /* Compact contribution layout. */
      .salary-submit-page__intro {
        padding: 24px 32px 16px;
      }
      .salary-submit-page__intro h1 {
        font-size: clamp(28px, 2.4vw, 36px);
      }
      .salary-submit-studio {
        grid-template-columns: 232px minmax(0, 1fr);
        min-height: 520px;
        margin-inline: 32px;
      }
      .salary-submit-progress {
        gap: 24px;
        padding: 28px 26px;
      }
      .salary-submit-progress__counter strong {
        font-size: 34px;
      }
      .salary-submit-progress .tab-btn {
        min-height: 42px;
      }
      .salary-submit-studio .salary-submit-form {
        padding: 30px 38px 0;
      }
      .salary-submit-studio .salary-submit-section legend {
        font-size: clamp(24px, 2vw, 28px);
      }
      .salary-submit-studio .salary-submit-section__hint {
        margin-bottom: 22px;
      }
      .salary-submit-studio .salary-submit-grid {
        gap: 20px 22px;
      }
      .salary-submit-studio .salary-submit-field {
        gap: 7px;
      }
      .salary-submit-studio .salary-submit-field > span {
        font-size: 11px;
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger {
        min-height: 44px;
      }
      .salary-submit-page > .salary-submit-form__actions {
        min-height: 56px;
        margin: 0 32px 22px;
        padding-top: 12px;
      }
      .salary-submit-page > .salary-submit-form__actions button {
        min-width: 112px;
        min-height: 42px;
        padding-inline: 16px;
        font-size: 13px;
      }
      .salary-submit-studio .salary-submit-form__actions {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-height: 58px;
        margin: 18px -38px 0;
        padding: 12px 38px 14px;
        border-top: 1px solid var(--app-color-card-border);
        background: var(--app-color-canvas);
      }
      .salary-submit-studio .salary-submit-form__actions button {
        min-width: 112px;
        min-height: 40px;
        padding-inline: 15px;
        font-size: 13px;
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger {
        min-height: 38px;
        height: 38px;
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-input,
      :host ::ng-deep .salary-submit-studio .ss-label {
        font-size: 13px;
      }
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger {
        width: 40px !important;
        min-width: 40px;
      }
      .salary-submit-studio .salary-submit-section {
        display: none !important;
      }
      .salary-submit-studio .salary-submit-section.is-active-step {
        display: flex !important;
        flex: 1 1 auto;
        flex-direction: column;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 0;
      }
      .salary-submit-studio .salary-submit-grid--context {
        grid-template-columns: repeat(2, minmax(280px, 1fr)) !important;
      }
      @media (min-width: 901px) {
        .salary-submit-studio {
          height: calc(100dvh - 170px);
          min-height: 520px;
        }
        .salary-submit-studio .salary-submit-form {
          display: flex !important;
          flex-direction: column;
          height: 100%;
          min-width: 0 !important;
          min-height: 0;
          overflow: hidden;
        }
        .salary-submit-studio .salary-submit-section.is-active-step {
          overflow-y: auto;
          padding-bottom: 20px;
        }
        .salary-submit-studio .salary-submit-form__actions {
          flex: 0 0 auto;
          margin: auto -38px 0;
          padding: 12px 38px 14px;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-studio .salary-submit-grid,
        .salary-submit-studio .salary-submit-grid--four,
        .salary-submit-studio #salary-package .salary-submit-grid--four,
        .salary-submit-studio .salary-submit-grid--context {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .salary-submit-page > .salary-submit-form__actions {
          align-items: stretch;
          flex-direction: column-reverse;
          margin: 0 18px 24px;
          padding-top: 12px;
        }
      }

      /* Submit Report audit pass: final contract for alignment, outlines, typography, theme, and states. */
      .salary-submit-page {
        background: var(--app-color-canvas);
      }
      .salary-submit-page__intro {
        align-items: flex-end;
        padding: 22px 32px 14px;
        background: transparent;
      }
      .salary-submit-page__intro h1 {
        color: var(--app-color-body);
        font-size: 34px;
        font-weight: 720;
        letter-spacing: -0.025em;
        line-height: 1.08;
      }
      .salary-submit-page__meta {
        color: var(--app-color-text-muted);
        font-size: 11px;
      }
      .salary-submit-page__meta b {
        color: var(--app-color-body);
      }
      .salary-submit-page__message {
        width: auto;
        margin: 8px 32px 12px;
        border-color: color-mix(in oklab, var(--app-color-primary) 36%, var(--app-color-card-border));
        border-radius: 6px;
        background: color-mix(in oklab, var(--app-color-primary) 10%, var(--app-color-canvas));
        color: var(--app-color-primary-text);
      }
      .salary-submit-page__message.is-error {
        border-color: color-mix(in oklab, rgb(225 90 90) 55%, var(--app-color-card-border));
        background: color-mix(in oklab, rgb(225 90 90) 12%, var(--app-color-canvas));
        color: color-mix(in oklab, rgb(255 181 181) 74%, var(--app-color-body));
      }
      .salary-submit-studio {
        --submit-border: color-mix(in oklab, var(--app-color-card-border) 54%, transparent);
        --submit-border-soft: color-mix(in oklab, var(--app-color-card-border) 34%, transparent);
        --submit-hover: color-mix(in oklab, var(--app-color-primary-bg) 68%, transparent);
        --submit-focus: color-mix(in oklab, var(--app-color-primary) 20%, transparent);
        width: auto;
        margin: 0 32px 30px;
        border: 1px solid var(--submit-border);
        border-radius: 6px;
        background: var(--app-color-card-bg);
        box-shadow: none;
      }
      .salary-submit-progress {
        border-right: 1px solid var(--submit-border-soft);
        background: color-mix(in oklab, var(--app-color-card-bg) 64%, var(--app-color-canvas));
      }
      .salary-submit-progress__counter strong {
        color: var(--app-color-primary-text);
        font-size: 34px;
        letter-spacing: -0.045em;
      }
      .salary-submit-progress__counter span,
      .salary-submit-progress__counter small {
        color: var(--app-color-text-muted);
      }
      .salary-submit-progress .salary-submit-wizard-nav__list {
        gap: 12px;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list::before {
        background: var(--submit-border-soft);
      }
      .salary-submit-progress .tab-btn,
      .salary-submit-progress .tab-btn + .tab-btn {
        height: 42px;
        color: var(--app-color-text-muted);
      }
      .salary-submit-progress .tab-btn span {
        border-color: var(--submit-border);
        background: var(--app-color-canvas);
        color: var(--app-color-text-muted);
      }
      .salary-submit-progress .tab-btn strong {
        color: inherit;
        font-size: 13px;
        font-weight: 620;
      }
      .salary-submit-progress .tab-btn:hover,
      .salary-submit-progress .tab-btn:focus-visible {
        background: transparent !important;
        color: var(--app-color-body);
        outline: 0;
      }
      .salary-submit-progress .tab-btn:hover span,
      .salary-submit-progress .tab-btn:focus-visible span {
        border-color: var(--app-color-primary);
        background: var(--app-color-primary);
        color: var(--app-color-canvas);
      }
      .salary-submit-progress .tab-btn:hover strong,
      .salary-submit-progress .tab-btn:focus-visible strong {
        color: var(--app-color-primary-text) !important;
        font-weight: 720;
      }
      .salary-submit-progress .tab-btn:focus-visible {
        box-shadow: 0 0 0 3px var(--submit-focus);
      }
      .salary-submit-progress .tab-btn.active {
        background: transparent !important;
        color: var(--app-color-primary-text) !important;
      }
      .salary-submit-progress .tab-btn.active span {
        border-color: var(--app-color-primary);
        background: var(--app-color-primary);
        color: var(--app-color-canvas);
      }
      .salary-submit-progress .tab-btn.active strong {
        color: var(--app-color-primary-text) !important;
        font-weight: 720;
      }
      .salary-submit-progress .tab-btn.active:hover strong,
      .salary-submit-progress .tab-btn.active:focus-visible strong {
        color: var(--app-color-primary-text) !important;
      }
      .salary-submit-progress .tab-btn.active:hover span,
      .salary-submit-progress .tab-btn.active:focus-visible span {
        border-color: var(--app-color-primary);
      }
      .salary-submit-progress .tab-btn:hover,
      .salary-submit-progress .tab-btn:focus-visible,
      .salary-submit-progress .tab-btn.active:hover,
      .salary-submit-progress .tab-btn.active:focus-visible {
        background: transparent !important;
        transform: none !important;
      }
      .salary-submit-progress .tab-btn strong,
      .salary-submit-progress .tab-btn:hover strong,
      .salary-submit-progress .tab-btn:focus-visible strong,
      .salary-submit-progress .tab-btn.active strong,
      .salary-submit-progress .tab-btn.active:hover strong,
      .salary-submit-progress .tab-btn.active:focus-visible strong {
        transform: none !important;
      }
      .salary-submit-studio .salary-submit-form {
        box-sizing: border-box;
        background: color-mix(in oklab, var(--app-color-card-bg) 42%, var(--app-color-canvas));
      }
      .salary-submit-studio .salary-submit-section legend {
        color: var(--app-color-body);
        font-size: 26px;
        font-weight: 720;
        letter-spacing: -0.02em;
        line-height: 1.12;
      }
      .salary-submit-studio .salary-submit-section__hint {
        display: block;
        max-width: 720px;
        margin: 8px 0 0;
        color: var(--app-color-text-muted);
        font-size: 12px;
        line-height: 1.45;
      }
      .salary-submit-studio .salary-submit-grid {
        margin-top: 26px;
        gap: 20px 24px;
      }
      .salary-submit-studio .salary-submit-grid--four,
      .salary-submit-studio #salary-package .salary-submit-grid--four,
      .salary-submit-studio .salary-submit-grid--context {
        grid-template-columns: repeat(2, minmax(260px, 1fr)) !important;
      }
      .salary-submit-studio .salary-submit-field {
        gap: 8px;
      }
      .salary-submit-studio .salary-submit-field > span {
        color: var(--app-color-body);
        font-size: 12px;
        font-weight: 650;
        letter-spacing: 0;
        text-transform: none;
      }
      .salary-submit-studio .salary-submit-field b {
        color: var(--app-color-primary-text);
      }
      .salary-submit-studio .salary-submit-field textarea {
        min-height: 150px;
        border-color: var(--submit-border);
        border-radius: 4px;
        background: var(--app-color-canvas);
        color: var(--app-color-body);
        font-size: 13px;
      }
      .salary-submit-studio .salary-submit-field textarea:hover {
        border-color: color-mix(in oklab, var(--app-color-primary) 42%, var(--submit-border));
      }
      .salary-submit-studio .salary-submit-field textarea:focus {
        border-color: var(--app-color-primary);
        box-shadow: 0 0 0 3px var(--submit-focus);
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger {
        height: 38px;
        min-height: 38px;
        border-color: var(--submit-border);
        border-radius: 4px;
        background: var(--app-color-canvas);
        color: var(--app-color-body);
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger:hover {
        border-color: color-mix(in oklab, var(--app-color-body) 24%, var(--submit-border));
        background: var(--app-color-canvas);
      }
      :host ::ng-deep .salary-submit-studio .ss.open .ss-inline-trigger,
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger:focus-within,
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger.focused {
        border-color: color-mix(in oklab, var(--app-color-body) 30%, var(--submit-border));
        background: var(--app-color-canvas);
        box-shadow: none;
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-input,
      :host ::ng-deep .salary-submit-studio .ss-label {
        color: var(--app-color-body);
        font-size: 13px;
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-input::placeholder {
        color: var(--app-color-text-muted);
      }
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger {
        width: 38px !important;
        min-width: 38px;
        border-left-color: var(--submit-border);
        background: transparent !important;
        color: var(--app-color-text-muted);
        box-shadow: none !important;
      }
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:hover,
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:focus-visible,
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:active {
        background: transparent !important;
        color: var(--app-color-body) !important;
        box-shadow: none !important;
      }
      :host ::ng-deep .salary-submit-studio .ss-caret {
        border-color: currentColor !important;
      }
      .salary-submit-studio .salary-submit-form__actions {
        min-height: 64px;
        border-top: 1px solid var(--submit-border-soft);
        background: color-mix(in oklab, var(--app-color-card-bg) 58%, var(--app-color-canvas));
      }
      .salary-submit-studio .salary-submit-form__actions a {
        color: var(--app-color-primary-text);
        font-size: 13px;
        font-weight: 560;
      }
      .salary-submit-studio .salary-submit-form__actions a:hover,
      .salary-submit-studio .salary-submit-form__actions a:focus-visible {
        color: var(--app-color-body);
        outline: 0;
        text-decoration: underline;
        text-underline-offset: 4px;
      }
      .salary-submit-studio .salary-submit-form__actions > div {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
      }
      .salary-submit-studio .salary-submit-form__actions button {
        min-width: 112px;
        min-height: 40px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 700;
      }
      .salary-submit-studio .proj-toolbar-btn:not(.proj-toolbar-btn--primary) {
        border-color: var(--submit-border);
        background: color-mix(in oklab, var(--app-color-card-bg) 82%, var(--app-color-canvas));
        color: var(--app-color-body);
      }
      .salary-submit-studio .proj-toolbar-btn:not(.proj-toolbar-btn--primary):hover,
      .salary-submit-studio .proj-toolbar-btn:not(.proj-toolbar-btn--primary):focus-visible {
        border-color: color-mix(in oklab, var(--app-color-primary) 32%, var(--submit-border));
        background: var(--submit-hover);
        outline: 0;
      }
      .salary-submit-studio .proj-toolbar-btn--primary {
        border-color: var(--app-color-primary) !important;
        background: var(--app-color-primary) !important;
        color: var(--app-color-canvas) !important;
      }
      .salary-submit-studio .proj-toolbar-btn--primary:hover,
      .salary-submit-studio .proj-toolbar-btn--primary:focus-visible {
        background: color-mix(in oklab, var(--app-color-primary) 92%, var(--app-color-canvas)) !important;
        border-color: color-mix(in oklab, var(--app-color-primary) 92%, var(--app-color-canvas)) !important;
        outline: 0;
      }
      .salary-submit-studio .proj-toolbar-btn:focus-visible {
        box-shadow: 0 0 0 3px var(--submit-focus);
      }
      .salary-submit-studio .proj-toolbar-btn:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      @media (min-width: 901px) {
        .salary-submit-studio {
          grid-template-columns: 232px minmax(0, 1fr);
          height: auto;
          min-height: 0;
        }
        .salary-submit-studio .salary-submit-form {
          min-height: 0;
          padding: 28px 38px 0;
          overflow: visible;
        }
        .salary-submit-studio .salary-submit-section.is-active-step {
          flex: 0 0 auto;
          overflow: visible;
          padding-bottom: 22px;
          justify-content: flex-start;
        }
        .salary-submit-studio .salary-submit-form__actions {
          margin: 28px -38px 0;
          padding: 12px 38px;
        }
      }
      @media (max-width: 900px) {
        .salary-submit-page__intro {
          padding: 22px 24px 14px;
        }
        .salary-submit-page__intro h1 {
          font-size: 30px;
        }
        .salary-submit-studio {
          grid-template-columns: minmax(0, 1fr);
          margin: 0 24px 24px;
        }
        .salary-submit-progress {
          border-right: 0;
          border-bottom: 1px solid var(--submit-border-soft);
        }
        .salary-submit-studio .salary-submit-grid--four,
        .salary-submit-studio #salary-package .salary-submit-grid--four,
        .salary-submit-studio .salary-submit-grid--context {
          grid-template-columns: repeat(2, minmax(220px, 1fr)) !important;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro {
          padding: 18px 16px 12px;
        }
        .salary-submit-page__intro h1 {
          font-size: 26px;
          letter-spacing: -0.015em;
        }
        .salary-submit-page__message {
          margin: 8px 16px 12px;
        }
        .salary-submit-studio {
          margin: 0 12px 18px;
        }
        .salary-submit-studio .salary-submit-form {
          padding: 24px 18px 0;
        }
        .salary-submit-studio .salary-submit-section legend {
          font-size: 23px;
        }
        .salary-submit-studio .salary-submit-grid--four,
        .salary-submit-studio #salary-package .salary-submit-grid--four,
        .salary-submit-studio .salary-submit-grid--context {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .salary-submit-studio .salary-submit-form__actions {
          flex-direction: column-reverse;
          align-items: stretch;
          margin: 28px -18px 0;
          padding: 14px 18px;
        }
        .salary-submit-studio .salary-submit-form__actions > div {
          width: 100%;
        }
        .salary-submit-studio .salary-submit-form__actions button {
          flex: 1 1 0;
          min-width: 0;
        }
        .salary-submit-studio .salary-submit-form__actions a {
          align-self: center;
        }
      }

      /* Navigation motion correction: keep the frame stable; only the page content moves. */
      @keyframes salary-submit-step-forward {
        from {
          opacity: 0;
          transform: translate3d(18px, 0, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }
      @keyframes salary-submit-step-backward {
        from {
          opacity: 0;
          transform: translate3d(-18px, 0, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }
      .salary-submit-studio .salary-submit-section.is-active-step {
        transform-origin: center;
        will-change: opacity, transform;
      }
      .salary-submit-studio .salary-submit-form.is-step-forward .salary-submit-section.is-active-step {
        animation: salary-submit-step-forward 180ms cubic-bezier(0.23, 1, 0.32, 1) both !important;
      }
      .salary-submit-studio .salary-submit-form.is-step-backward .salary-submit-section.is-active-step {
        animation: salary-submit-step-backward 160ms cubic-bezier(0.23, 1, 0.32, 1) both !important;
      }
      .salary-submit-progress .tab-btn,
      .salary-submit-progress .tab-btn strong,
      .salary-submit-studio .proj-toolbar-btn,
      .salary-submit-studio .proj-toolbar-btn--primary,
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger,
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger {
        transform: none !important;
        transition:
          background-color 140ms ease,
          border-color 140ms ease,
          color 140ms ease,
          box-shadow 140ms ease !important;
      }
      .salary-submit-progress .tab-btn:hover,
      .salary-submit-progress .tab-btn:focus-visible,
      .salary-submit-progress .tab-btn:active,
      .salary-submit-studio .proj-toolbar-btn:hover,
      .salary-submit-studio .proj-toolbar-btn:focus-visible,
      .salary-submit-studio .proj-toolbar-btn:active,
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:hover,
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:focus-visible,
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger:active {
        transform: none !important;
      }
      @media (min-width: 901px) {
        .salary-submit-studio {
          min-height: 560px;
        }
        .salary-submit-studio .salary-submit-form {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          grid-template-rows: minmax(430px, 1fr) auto;
          height: auto;
          overflow: hidden;
        }
        .salary-submit-studio .salary-submit-section.is-active-step {
          min-height: 430px;
          overflow-y: auto;
          padding-bottom: 18px;
        }
        .salary-submit-studio .salary-submit-form__actions {
          align-self: end;
          margin-top: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .salary-submit-studio .salary-submit-form.is-step-forward .salary-submit-section.is-active-step,
        .salary-submit-studio .salary-submit-form.is-step-backward .salary-submit-section.is-active-step {
          animation: none !important;
        }
      }

      /* Final navigation-stage contract: full-width frame, stable page area, content-only motion. */
      :host ::ng-deep engineers-salary-reference-page-design.salary-submit-page-design,
      :host ::ng-deep engineers-salary-reference-page-design.salary-submit-page-design .table-area,
      .salary-submit-page {
        width: 100% !important;
        max-width: none !important;
      }
      :host ::ng-deep engineers-salary-reference-page-design.salary-submit-page-design .table-area {
        align-items: stretch !important;
        overflow: hidden !important;
      }
      .salary-submit-page {
        box-sizing: border-box;
        overflow: auto !important;
      }
      .salary-submit-studio {
        box-sizing: border-box;
        width: calc(100% - 64px) !important;
        max-width: none !important;
        margin: 0 32px 30px !important;
        transform: none !important;
      }
      .salary-submit-progress,
      .salary-submit-studio .salary-submit-form {
        transform: none !important;
      }
      .salary-submit-studio .salary-submit-form {
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
      }
      .salary-submit-studio .salary-submit-section.is-active-step {
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
      }
      @media (min-width: 901px) {
        .salary-submit-studio {
          display: grid !important;
          grid-template-columns: 232px minmax(0, 1fr) !important;
          min-height: 560px !important;
        }
        .salary-submit-studio .salary-submit-form {
          grid-template-columns: minmax(0, 1fr) !important;
          grid-template-rows: minmax(430px, 1fr) auto !important;
          padding: 28px 38px 0 !important;
        }
        .salary-submit-studio .salary-submit-grid,
        .salary-submit-studio .salary-submit-grid--four,
        .salary-submit-studio #salary-package .salary-submit-grid--four,
        .salary-submit-studio .salary-submit-grid--context {
          width: 100% !important;
          grid-template-columns: repeat(2, minmax(320px, 1fr)) !important;
        }
        .salary-submit-studio .salary-submit-section.is-active-step {
          min-height: 430px !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }
        .salary-submit-studio .salary-submit-form__actions {
          grid-column: 1 / -1 !important;
          margin: 0 -38px 0 !important;
        }
      }
      @media (max-width: 900px) {
        .salary-submit-studio {
          width: calc(100% - 48px) !important;
          margin: 0 24px 24px !important;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-studio {
          width: calc(100% - 24px) !important;
          margin: 0 12px 18px !important;
        }
      }

      /* Final action polish: secondary Back button should feel intentional, not like an empty box. */
      .salary-submit-studio .salary-submit-form__actions .proj-toolbar-btn:not(.proj-toolbar-btn--primary) {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 104px !important;
        min-height: 40px !important;
        padding: 0 18px !important;
        border: 1px solid color-mix(in oklab, var(--app-color-card-border) 74%, var(--app-color-body)) !important;
        border-radius: 6px !important;
        background: color-mix(in oklab, var(--app-color-card-bg) 72%, var(--app-color-canvas)) !important;
        color: var(--app-color-body) !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
        box-shadow: inset 0 1px 0 color-mix(in oklab, var(--app-color-body) 5%, transparent) !important;
      }
      .salary-submit-studio .salary-submit-form__actions .proj-toolbar-btn:not(.proj-toolbar-btn--primary):hover,
      .salary-submit-studio .salary-submit-form__actions .proj-toolbar-btn:not(.proj-toolbar-btn--primary):focus-visible {
        border-color: color-mix(in oklab, var(--app-color-primary) 42%, var(--app-color-card-border)) !important;
        background: color-mix(in oklab, var(--app-color-primary) 10%, var(--app-color-card-bg)) !important;
        color: var(--app-color-body) !important;
      }

      /* Stable container contract: step changes must never resize the outer frame. */
      @media (min-width: 901px) {
        .salary-submit-studio {
          height: clamp(560px, calc(100dvh - 300px), 680px) !important;
          min-height: 560px !important;
          max-height: 680px !important;
        }
        .salary-submit-studio .salary-submit-progress {
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .salary-submit-studio .salary-submit-form {
          height: 100% !important;
          min-height: 0 !important;
          grid-template-rows: minmax(0, 1fr) 65px !important;
        }
        .salary-submit-studio .salary-submit-section.is-active-step {
          height: 100% !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow-y: auto !important;
        }
        .salary-submit-studio .salary-submit-form__actions {
          min-height: 65px !important;
          height: 65px !important;
        }
      }

      /* Final page-title contract: keep the heading readable and aligned with the frame. */
      .salary-submit-page__intro {
        box-sizing: border-box !important;
        width: calc(100% - 64px) !important;
        margin: 0 32px !important;
        padding: 36px 0 22px !important;
        align-items: flex-start !important;
        overflow: visible !important;
      }
      .salary-submit-page__intro h1 {
        display: inline-flex !important;
        align-items: center !important;
        gap: 12px !important;
        margin: 0 !important;
        padding: 0 !important;
        color: var(--app-color-body) !important;
        font-size: clamp(28px, 1.9vw, 32px) !important;
        font-weight: 720 !important;
        letter-spacing: -0.018em !important;
        line-height: 1.25 !important;
        overflow: visible !important;
      }
      .salary-submit-page__intro h1 i,
      .salary-submit-page__intro h1 .salary-submit-title-icon {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 42px !important;
        height: 42px !important;
        flex: 0 0 42px !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: var(--app-color-primary-text) !important;
        box-shadow: none !important;
      }
      @media (max-width: 900px) {
        .salary-submit-page__intro {
          width: calc(100% - 48px) !important;
          margin: 0 24px !important;
          padding: 32px 0 20px !important;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro {
          width: calc(100% - 24px) !important;
          margin: 0 12px !important;
          padding: 26px 0 18px !important;
        }
        .salary-submit-page__intro h1 {
          font-size: 26px !important;
        }
        .salary-submit-page__intro h1 i,
        .salary-submit-page__intro h1 .salary-submit-title-icon {
          width: 38px !important;
          height: 38px !important;
          flex-basis: 38px !important;
        }
      }

      .salary-submit-progress .tab-btn > i {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 16px !important;
        height: 16px !important;
        flex: 0 0 16px !important;
        color: color-mix(in oklab, var(--app-color-text-muted) 86%, var(--app-color-body)) !important;
        opacity: 0.72 !important;
      }
      .salary-submit-progress .tab-btn.active > i,
      .salary-submit-progress .tab-btn:hover > i,
      .salary-submit-progress .tab-btn:focus-visible > i {
        color: var(--app-color-primary-text) !important;
        opacity: 1 !important;
      }
      .salary-submit-studio .salary-submit-form__actions a,
      .salary-submit-studio .salary-submit-form__actions button {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
      }
      .salary-submit-studio .salary-submit-form__actions a i,
      .salary-submit-studio .salary-submit-form__actions button i {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 16px !important;
        height: 16px !important;
        flex: 0 0 16px !important;
      }
      .salary-submit-studio .salary-submit-form__actions .proj-toolbar-btn--primary i {
        color: var(--app-color-canvas) !important;
      }

      .salary-submit-studio .salary-submit-field > span {
        display: inline-flex !important;
        align-items: center !important;
        gap: 7px !important;
      }
      .salary-submit-studio .salary-submit-field > span > i {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 15px !important;
        height: 15px !important;
        flex: 0 0 15px !important;
        color: color-mix(in oklab, var(--app-color-primary-text) 80%, var(--app-color-text-muted)) !important;
        opacity: 0.9 !important;
      }

      .salary-submit-progress .tab-btn {
        display: grid !important;
        grid-template-columns: 26px 18px minmax(0, 1fr) !important;
        align-items: center !important;
        column-gap: 9px !important;
        width: 100% !important;
        min-width: 0 !important;
        text-align: left !important;
      }
      .salary-submit-progress .tab-btn span {
        grid-column: 1 !important;
      }
      .salary-submit-progress .tab-btn > i {
        grid-column: 2 !important;
      }
      .salary-submit-progress .tab-btn strong {
        grid-column: 3 !important;
        min-width: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      @keyframes salary-submit-icon-pop {
        from {
          opacity: 0;
          transform: translate3d(0, 3px, 0) scale(0.94);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
      }
      .salary-submit-studio .salary-submit-section.is-active-step .salary-submit-field > span > i {
        animation: salary-submit-icon-pop 180ms cubic-bezier(0.23, 1, 0.32, 1) both;
      }
      .salary-submit-studio
        .salary-submit-section.is-active-step
        .salary-submit-field:nth-child(2)
        > span
        > i {
        animation-delay: 22ms;
      }
      .salary-submit-studio
        .salary-submit-section.is-active-step
        .salary-submit-field:nth-child(3)
        > span
        > i {
        animation-delay: 44ms;
      }
      .salary-submit-studio
        .salary-submit-section.is-active-step
        .salary-submit-field:nth-child(4)
        > span
        > i {
        animation-delay: 66ms;
      }
      .salary-submit-studio
        .salary-submit-section.is-active-step
        .salary-submit-field:nth-child(n + 5)
        > span
        > i {
        animation-delay: 80ms;
      }
      @media (hover: hover) and (pointer: fine) {
        .salary-submit-studio .salary-submit-field:hover > span > i {
          color: var(--app-color-primary-text) !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .salary-submit-studio .salary-submit-section.is-active-step .salary-submit-field > span > i {
          animation: none !important;
        }
      }

      /* Description and field-tip contract. */
      .salary-submit-page__intro .salary-submit-page__description {
        display: block !important;
        max-width: 760px !important;
        margin: 10px 0 0 54px !important;
        color: var(--app-color-text-muted) !important;
        font-size: 13px !important;
        line-height: 1.55 !important;
      }
      .salary-submit-ui-tip {
        position: relative !important;
      }
      .salary-submit-floating-tip {
        position: fixed !important;
        z-index: 2147483000 !important;
        width: max-content !important;
        max-width: min(292px, calc(100vw - 32px)) !important;
        padding: 9px 11px !important;
        border: 1px solid rgb(var(--border) / 0.72) !important;
        border-radius: 10px !important;
        background: color-mix(in oklab, rgb(var(--bg1)) 92%, rgb(var(--fg)) 5%) !important;
        box-shadow: none !important;
        color: rgb(var(--fg) / 0.9) !important;
        font-size: 11px !important;
        font-style: normal !important;
        font-weight: 600 !important;
        letter-spacing: 0 !important;
        line-height: 1.35 !important;
        pointer-events: none !important;
        text-align: left !important;
        transform: translate3d(0, 0, 0) scale(0.98) !important;
        transform-origin: 0 0 !important;
        animation: salary-submit-floating-tip-follow 120ms cubic-bezier(0.2, 0.82, 0.24, 1) both !important;
        white-space: normal !important;
      }
      .salary-submit-floating-tip__text {
        display: block !important;
        color: rgb(var(--fg) / 0.88) !important;
      }
      .salary-submit-floating-tip.is-before-cursor {
        transform-origin: 100% 0 !important;
      }
      .salary-submit-floating-tip__arrow {
        position: absolute !important;
        left: -5px !important;
        top: calc(50% - 4.5px) !important;
        width: 9px !important;
        height: 9px !important;
        margin: 0 !important;
        border-left: 1px solid rgb(var(--border) / 0.72) !important;
        border-bottom: 1px solid rgb(var(--border) / 0.72) !important;
        background: color-mix(in oklab, rgb(var(--bg1)) 92%, rgb(var(--fg)) 5%) !important;
        box-shadow: none !important;
        transform: rotate(45deg) !important;
      }
      .salary-submit-floating-tip.is-before-cursor .salary-submit-floating-tip__arrow {
        right: -5px !important;
        left: auto !important;
        border: 0 !important;
        border-right: 1px solid rgb(var(--border) / 0.72) !important;
        border-top: 1px solid rgb(var(--border) / 0.72) !important;
      }
      @keyframes salary-submit-floating-tip-follow {
        from {
          opacity: 0;
          transform: translate3d(0, 3px, 0) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
      }
      .salary-submit-studio .salary-submit-field__tip.app-icon-action {
        --app-icon-action-expand-width: 48px;
        --app-icon-action-label-max: 24px;
        --app-icon-action-fg: rgb(var(--fg) / 0.72);
        --app-icon-action-fg-hover: rgb(var(--fg) / 0.96);
        --app-icon-action-outline: rgb(var(--border) / 0.42);
        --app-icon-action-outline-hover: rgb(var(--border) / 0.82);
        --app-icon-action-bg: transparent;
        --app-icon-action-hover-bg: color-mix(in oklab, rgb(var(--fg)) 10%, transparent);

        display: inline-flex !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0 !important;
        width: 20px !important;
        height: 20px !important;
        min-height: 20px !important;
        flex: 0 0 auto !important;
        margin-left: 5px !important;
        padding: 0 !important;
        border: 1px solid var(--app-icon-action-outline) !important;
        border-radius: 6px !important;
        background: var(--app-icon-action-bg) !important;
        box-shadow: none !important;
        color: var(--app-icon-action-fg) !important;
        cursor: pointer !important;
        font: inherit !important;
        overflow: visible !important;
        vertical-align: middle !important;
        transition:
          width 170ms cubic-bezier(0.2, 0.82, 0.24, 1),
          gap 170ms cubic-bezier(0.2, 0.82, 0.24, 1),
          padding 170ms cubic-bezier(0.2, 0.82, 0.24, 1),
          border-color 0.15s ease,
          background 0.15s ease,
          color 0.15s ease,
          transform 160ms cubic-bezier(0.2, 0.82, 0.24, 1) !important;
      }
      .salary-submit-studio .salary-submit-field__tip.app-icon-action:hover,
      .salary-submit-studio .salary-submit-field__tip.app-icon-action:focus-visible,
      .salary-submit-studio .salary-submit-field__tip.app-icon-action:active {
        width: var(--app-icon-action-expand-width) !important;
        gap: 4px !important;
        padding: 0 6px !important;
        border-color: var(--app-icon-action-outline-hover) !important;
        background: var(--app-icon-action-hover-bg) !important;
        color: var(--app-icon-action-fg-hover) !important;
        box-shadow: none !important;
        outline: none !important;
        transform: translateY(-1px) !important;
      }
      .salary-submit-studio .salary-submit-field__tip.app-icon-action i,
      .salary-submit-studio .salary-submit-field__tip.app-icon-action .app-icon-host,
      .salary-submit-studio .salary-submit-field__tip.app-icon-action .salary-submit-tip-mark {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 11px !important;
        height: 11px !important;
        flex: 0 0 auto !important;
        margin: 0 !important;
        line-height: 0 !important;
        position: relative !important;
        pointer-events: none !important;
      }
      .salary-submit-studio .salary-submit-field__tip.app-icon-action .salary-submit-tip-mark {
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: currentColor !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
        font-size: 11px !important;
        font-weight: 950 !important;
        line-height: 1 !important;
      }
      .salary-submit-studio .salary-submit-field__tip.app-icon-action i > svg,
      .salary-submit-studio .salary-submit-field__tip.app-icon-action .app-icon-host > svg {
        transform: scale(1) !important;
        transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1) !important;
      }
      .salary-submit-studio .salary-submit-field__tip.app-icon-action .app-icon-action-label {
        display: block !important;
        max-width: 0 !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow-x: clip !important;
        overflow-y: visible !important;
        opacity: 0 !important;
        color: inherit !important;
        font-size: 9px !important;
        font-weight: 800 !important;
        line-height: 1.25 !important;
        letter-spacing: 0.01em !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        transform: translateX(-3px) !important;
        transition:
          max-width 170ms cubic-bezier(0.2, 0.82, 0.24, 1),
          opacity 120ms ease,
          transform 170ms cubic-bezier(0.2, 0.82, 0.24, 1) !important;
      }
      .salary-submit-studio .salary-submit-field__tip.app-icon-action:hover .app-icon-action-label,
      .salary-submit-studio .salary-submit-field__tip.app-icon-action:focus-visible .app-icon-action-label,
      .salary-submit-studio .salary-submit-field__tip.app-icon-action:active .app-icon-action-label {
        max-width: var(--app-icon-action-label-max) !important;
        opacity: 1 !important;
        transform: translateX(0) !important;
      }
      @media (prefers-reduced-motion: reduce) {
        .salary-submit-floating-tip,
        .salary-submit-studio .salary-submit-field__tip {
          animation: none !important;
          transition: none !important;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro .salary-submit-page__description {
          margin-left: 0 !important;
          font-size: 12px !important;
        }
      }

      /* Current repair: stable full-width frame, no shrinking, footer owns its own bottom row. */
      .salary-submit-page__intro {
        width: calc(100% - 64px) !important;
        max-width: none !important;
      }
      .salary-submit-page__intro .salary-submit-page__description {
        display: block !important;
        max-width: 820px !important;
        margin: 10px 0 0 54px !important;
      }
      .salary-submit-studio {
        display: grid !important;
        grid-template-columns: 232px minmax(0, 1fr) !important;
        grid-template-rows: minmax(0, 1fr) !important;
        width: calc(100% - 64px) !important;
        min-width: 0 !important;
        min-height: min(620px, calc(100dvh - 170px)) !important;
        height: calc(100dvh - 170px) !important;
        max-height: none !important;
        margin: 0 32px 30px !important;
        overflow: hidden !important;
      }
      .salary-submit-studio .salary-submit-form {
        display: grid !important;
        grid-template-rows: minmax(0, 1fr) auto !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        padding: 28px 38px 0 !important;
        overflow: hidden !important;
      }
      .salary-submit-studio .salary-submit-section.is-active-step {
        min-height: 0 !important;
        height: auto !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: 0 4px 22px 0 !important;
        scrollbar-gutter: stable !important;
      }
      .salary-submit-studio .salary-submit-form__actions {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        flex: 0 0 auto !important;
        min-height: 64px !important;
        height: 64px !important;
        margin: 0 -38px !important;
        padding: 12px 38px !important;
        border-top: 1px solid var(--submit-border-soft) !important;
        background: color-mix(in oklab, var(--app-color-card-bg) 58%, var(--app-color-canvas)) !important;
      }
      .salary-submit-studio .salary-submit-form__actions > div {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 10px !important;
      }
      .salary-submit-studio .salary-submit-form__actions a,
      .salary-submit-studio .salary-submit-form__actions button {
        white-space: nowrap !important;
      }
      .salary-submit-studio .salary-submit-form__actions button {
        min-width: 108px !important;
        min-height: 38px !important;
        padding-inline: 14px !important;
        font-size: 13px !important;
      }
      :host ::ng-deep .salary-submit-studio .ss-inline-trigger {
        height: 36px !important;
        min-height: 36px !important;
      }
      :host ::ng-deep .salary-submit-studio .ss-caret-trigger {
        width: 36px !important;
        min-width: 36px !important;
      }
      @media (max-width: 900px) {
        .salary-submit-page__intro {
          width: calc(100% - 48px) !important;
          margin-inline: 24px !important;
        }
        .salary-submit-page__intro .salary-submit-page__description {
          margin-left: 0 !important;
        }
        .salary-submit-studio {
          grid-template-columns: minmax(0, 1fr) !important;
          width: calc(100% - 48px) !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 24px 24px !important;
          overflow: visible !important;
        }
        .salary-submit-studio .salary-submit-form {
          height: auto !important;
          min-height: 560px !important;
          padding: 26px 30px 0 !important;
        }
        .salary-submit-studio .salary-submit-section.is-active-step {
          overflow: visible !important;
        }
        .salary-submit-studio .salary-submit-form__actions {
          margin: auto -30px 0 !important;
          padding-inline: 30px !important;
        }
      }
      @media (max-width: 640px) {
        .salary-submit-page__intro {
          width: calc(100% - 24px) !important;
          margin-inline: 12px !important;
        }
        .salary-submit-studio {
          width: calc(100% - 24px) !important;
          margin: 0 12px 18px !important;
        }
        .salary-submit-studio .salary-submit-form {
          min-height: 0 !important;
          padding: 22px 18px 0 !important;
        }
        .salary-submit-studio .salary-submit-form__actions {
          height: auto !important;
          min-height: 58px !important;
          margin: 26px -18px 0 !important;
          padding: 12px 18px !important;
        }
      }

      /* Step connector motion: quiet by default, softly fills between completed steps. */
      .salary-submit-progress .salary-submit-wizard-nav__list {
        --submit-step-gap: 54px;
        position: relative !important;
        isolation: isolate !important;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list::before,
      .salary-submit-progress .salary-submit-wizard-nav__list::after {
        position: absolute !important;
        top: 21px !important;
        bottom: 21px !important;
        left: 12.5px !important;
        width: 1px !important;
        border-radius: 999px !important;
        content: '' !important;
        pointer-events: none !important;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list::before {
        z-index: 0 !important;
        background: color-mix(in oklab, var(--app-color-card-border) 72%, transparent) !important;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list::after {
        z-index: 1 !important;
        bottom: auto !important;
        height: 0 !important;
        background:
          linear-gradient(
            180deg,
            color-mix(in oklab, var(--app-color-primary) 72%, var(--app-color-primary-text)),
            var(--app-color-primary),
            color-mix(in oklab, var(--app-color-primary-text) 76%, var(--app-color-primary))
          ) !important;
        box-shadow: 0 0 10px color-mix(in oklab, var(--app-color-primary) 36%, transparent) !important;
        transform-origin: top center !important;
        transition:
          height 260ms cubic-bezier(0.23, 1, 0.32, 1),
          box-shadow 220ms ease,
          opacity 180ms ease !important;
        opacity: 0.95 !important;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list.is-progress-step-1::after {
        height: 0 !important;
        opacity: 0 !important;
        box-shadow: none !important;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list.is-progress-step-2::after {
        height: var(--submit-step-gap) !important;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list.is-progress-step-3::after {
        height: calc(var(--submit-step-gap) * 2) !important;
      }
      .salary-submit-progress .salary-submit-wizard-nav__list.is-progress-step-4::after {
        height: calc(var(--submit-step-gap) * 3) !important;
      }
      .salary-submit-progress .tab-btn {
        position: relative !important;
        z-index: 2 !important;
      }
      .salary-submit-progress .tab-btn span {
        position: relative !important;
        z-index: 3 !important;
        display: inline-grid !important;
        place-items: center !important;
        text-align: center !important;
        line-height: 1 !important;
        background-clip: padding-box !important;
        transition:
          border-color 180ms ease,
          background-color 180ms ease,
          color 180ms ease,
          box-shadow 220ms ease !important;
      }
      .salary-submit-progress .tab-btn.is-visited:not(.is-complete) span {
        border-color: color-mix(in oklab, var(--app-color-primary) 82%, var(--app-color-card-border)) !important;
        background: var(--app-color-canvas) !important;
        color: var(--app-color-primary-text) !important;
      }
      .salary-submit-progress .tab-btn.active span {
        border-color: var(--app-color-primary) !important;
        background: var(--app-color-primary) !important;
        color: var(--app-color-canvas) !important;
        box-shadow:
          0 0 0 3px color-mix(in oklab, var(--app-color-primary) 18%, transparent),
          0 0 16px color-mix(in oklab, var(--app-color-primary) 28%, transparent) !important;
      }
      .salary-submit-progress .tab-btn.active.is-visited:not(.is-complete) span {
        border-color: var(--app-color-primary) !important;
        background: var(--app-color-primary) !important;
        color: var(--app-color-canvas) !important;
      }
      .salary-submit-progress .tab-btn.is-complete span {
        border-color: var(--app-color-primary) !important;
        background: var(--app-color-primary) !important;
        color: var(--app-color-canvas) !important;
        box-shadow:
          0 0 0 2px color-mix(in oklab, var(--app-color-canvas) 72%, transparent),
          0 0 14px color-mix(in oklab, var(--app-color-primary) 28%, transparent) !important;
      }
      .salary-submit-progress .tab-btn.is-complete strong {
        color: var(--app-color-primary-text) !important;
      }
      .salary-submit-progress .tab-btn.is-complete span::after {
        position: absolute !important;
        inset: 6px !important;
        border-radius: inherit !important;
        background: color-mix(in oklab, var(--app-color-canvas) 18%, transparent) !important;
        content: '' !important;
        opacity: 0.42 !important;
      }
      .salary-submit-progress .tab-btn:not(.active):hover span,
      .salary-submit-progress .tab-btn:not(.active):focus-visible span {
        border-color: var(--app-color-primary) !important;
        background: var(--app-color-primary) !important;
        color: var(--app-color-canvas) !important;
      }
      .salary-submit-progress .tab-btn:not(.active):hover strong,
      .salary-submit-progress .tab-btn:not(.active):focus-visible strong,
      .salary-submit-progress .tab-btn.active strong {
        color: var(--app-color-primary-text) !important;
        font-weight: 720 !important;
      }
      .salary-submit-progress .tab-btn.active.is-complete span,
      .salary-submit-progress .tab-btn.active:hover span,
      .salary-submit-progress .tab-btn.active:focus-visible span,
      .salary-submit-progress .tab-btn.is-complete:hover span,
      .salary-submit-progress .tab-btn.is-complete:focus-visible span {
        border-color: var(--app-color-primary) !important;
        background: var(--app-color-primary) !important;
        color: var(--app-color-canvas) !important;
      }
      @media (max-width: 900px) {
        .salary-submit-progress .salary-submit-wizard-nav__list::before,
        .salary-submit-progress .salary-submit-wizard-nav__list::after {
          display: none !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .salary-submit-progress .salary-submit-wizard-nav__list::after,
        .salary-submit-progress .tab-btn span {
          transition: none !important;
        }
      }

      /* Title icon living motion: combined layer motion, no dimming/fade. */
      .salary-submit-page__intro h1 .salary-submit-title-icon {
        position: relative !important;
        z-index: 0 !important;
        transform-origin: 52% 52% !important;
        animation: salary-submit-title-icon-stage 2.25s cubic-bezier(0.23, 1, 0.32, 1) infinite !important;
        opacity: 1 !important;
        filter: none !important;
        will-change: transform !important;
      }
      .salary-submit-page__intro h1 .salary-submit-title-icon::before,
      .salary-submit-page__intro h1 .salary-submit-title-icon::after {
        display: none !important;
        content: none !important;
      }
      .salary-submit-page__intro h1 .salary-submit-title-icon .app-stateful-icon__layer {
        transform-origin: center !important;
        opacity: 1 !important;
        filter: none !important;
        will-change: transform !important;
      }
      .salary-submit-page__intro h1 .salary-submit-title-icon .app-stateful-icon__outline {
        animation: salary-submit-title-icon-outline-scan 2.25s cubic-bezier(0.23, 1, 0.32, 1) infinite !important;
      }
      .salary-submit-page__intro h1 .salary-submit-title-icon .app-stateful-icon__filled {
        animation: salary-submit-title-icon-fill-pop 2.25s cubic-bezier(0.23, 1, 0.32, 1) infinite !important;
      }
      .salary-submit-page__intro h1 .salary-submit-title-icon svg path:nth-last-child(-n + 2) {
        transform-box: fill-box !important;
        transform-origin: center !important;
        animation: salary-submit-title-icon-plus-kick 1.5s cubic-bezier(0.23, 1, 0.32, 1) infinite !important;
        opacity: 1 !important;
        filter: none !important;
      }
      :host ::ng-deep .salary-submit-page__intro h1 .salary-submit-title-icon .app-stateful-icon__layer {
        transform-origin: center !important;
        opacity: 1 !important;
        filter: none !important;
        will-change: transform !important;
      }
      :host ::ng-deep .salary-submit-page__intro h1 .salary-submit-title-icon .app-stateful-icon__outline {
        animation: salary-submit-title-icon-outline-scan 2.25s cubic-bezier(0.23, 1, 0.32, 1) infinite !important;
      }
      :host ::ng-deep .salary-submit-page__intro h1 .salary-submit-title-icon .app-stateful-icon__filled {
        animation: salary-submit-title-icon-fill-pop 2.25s cubic-bezier(0.23, 1, 0.32, 1) infinite !important;
      }
      :host ::ng-deep .salary-submit-page__intro h1 .salary-submit-title-icon svg path:nth-last-child(-n + 2) {
        transform-box: fill-box !important;
        transform-origin: center !important;
        animation: salary-submit-title-icon-plus-kick 1.5s cubic-bezier(0.23, 1, 0.32, 1) infinite !important;
        opacity: 1 !important;
        filter: none !important;
      }
      @keyframes salary-submit-title-icon-stage {
        0%,
        100% {
          transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
        }
        18% {
          transform: translate3d(0, -1px, 0) rotate(-2deg) scale(1.045);
        }
        34% {
          transform: translate3d(0, 0, 0) rotate(1.4deg) scale(1.02);
        }
        48% {
          transform: translate3d(0, 0, 0) rotate(0deg) scale(1.035);
        }
        68% {
          transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
        }
      }
      @keyframes salary-submit-title-icon-outline-scan {
        0%,
        100% {
          transform: translate3d(0, 0, 0);
        }
        20% {
          transform: translate3d(1.5px, 0, 0);
        }
        36% {
          transform: translate3d(-1px, 0, 0);
        }
        54% {
          transform: translate3d(0, 0, 0);
        }
      }
      @keyframes salary-submit-title-icon-fill-pop {
        0%,
        100% {
          transform: scale(1);
        }
        20% {
          transform: scale(1.08);
        }
        40% {
          transform: scale(0.99);
        }
        58% {
          transform: scale(1.03);
        }
      }
      @keyframes salary-submit-title-icon-plus-kick {
        0%,
        100% {
          transform: rotate(0deg) scale(1);
        }
        32% {
          transform: rotate(90deg) scale(1.14);
        }
        54% {
          transform: rotate(90deg) scale(1);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .salary-submit-page__intro h1 .salary-submit-title-icon,
        .salary-submit-page__intro h1 .salary-submit-title-icon::before,
        .salary-submit-page__intro h1 .salary-submit-title-icon::after,
        .salary-submit-page__intro h1 .salary-submit-title-icon .app-stateful-icon__layer,
        .salary-submit-page__intro h1 .salary-submit-title-icon svg path {
          animation: none !important;
          transform: none !important;
          filter: none !important;
          opacity: 1 !important;
        }
      }

      /* Final dropdown override: grey outline only, no green and no inner fill. */
      :host ::ng-deep .salary-submit-studio search-select .ss-inline-trigger,
      :host ::ng-deep .salary-submit-studio search-select .ss-trigger {
        border-color: var(--submit-border) !important;
        background: var(--app-color-canvas) !important;
        box-shadow: none !important;
      }
      :host ::ng-deep .salary-submit-studio search-select .ss-inline-trigger:hover,
      :host ::ng-deep .salary-submit-studio search-select .ss-trigger:hover {
        border-color: color-mix(in oklab, var(--app-color-body) 24%, var(--submit-border)) !important;
        background: var(--app-color-canvas) !important;
        box-shadow: none !important;
      }
      :host ::ng-deep .salary-submit-studio search-select .ss.open .ss-inline-trigger,
      :host ::ng-deep .salary-submit-studio search-select .ss.open .ss-trigger,
      :host ::ng-deep .salary-submit-studio search-select .ss-inline-trigger:focus-within,
      :host ::ng-deep .salary-submit-studio search-select .ss-inline-trigger.focused,
      :host ::ng-deep .salary-submit-studio search-select .ss-trigger:focus-visible {
        border-color: color-mix(in oklab, var(--app-color-body) 30%, var(--submit-border)) !important;
        background: var(--app-color-canvas) !important;
        box-shadow: none !important;
      }
      :host ::ng-deep .salary-submit-studio search-select .ss-caret-trigger,
      :host ::ng-deep .salary-submit-studio search-select .ss-caret-trigger:hover,
      :host ::ng-deep .salary-submit-studio search-select .ss-caret-trigger:focus-visible,
      :host ::ng-deep .salary-submit-studio search-select .ss-caret-trigger:active {
        background: transparent !important;
        color: var(--app-color-text-muted) !important;
        box-shadow: none !important;
      }
      :host ::ng-deep .salary-submit-studio search-select .ss-caret-box {
        border-left-color: var(--submit-border) !important;
        background: transparent !important;
        color: var(--app-color-text-muted) !important;
      }
      :host ::ng-deep .salary-submit-studio search-select .ss.open .ss-caret-trigger,
      :host ::ng-deep .salary-submit-studio search-select .ss-caret-trigger:hover,
      :host ::ng-deep .salary-submit-studio search-select .ss.open .ss-caret-box,
      :host ::ng-deep .salary-submit-studio search-select .ss-caret-trigger:hover .ss-caret-box {
        color: var(--app-color-body) !important;
      }
      :host ::ng-deep .salary-submit-studio search-select .ss-caret,
      :host ::ng-deep .salary-submit-studio search-select .ss-caret.open {
        border-color: currentColor !important;
      }
      .salary-submit-studio .salary-submit-benefits-box {
        min-height: 0;
        border-color: var(--submit-border);
        border-radius: 8px;
        background:
          linear-gradient(180deg, color-mix(in oklab, var(--app-color-body) 4%, transparent), transparent 54%),
          var(--app-color-canvas);
        color: var(--app-color-body);
        box-shadow: none;
      }
      .salary-submit-studio .salary-submit-benefits-box:hover,
      .salary-submit-studio .salary-submit-benefits-box:focus-within {
        border-color: color-mix(in oklab, var(--app-color-body) 28%, var(--submit-border));
      }
      .salary-submit-studio .salary-submit-benefits-custom input,
      .salary-submit-studio .salary-submit-benefits-custom button {
        border-color: color-mix(in oklab, var(--app-color-body) 18%, transparent);
        background: color-mix(in oklab, var(--app-color-body) 4%, transparent);
        color: var(--app-color-body);
        box-shadow: none;
      }
      .salary-submit-studio .salary-submit-benefit-chip span {
        color: inherit !important;
        transform: none !important;
      }
      .salary-submit-studio .salary-submit-benefit-chip:hover,
      .salary-submit-studio .salary-submit-benefit-chip:focus-visible,
      .salary-submit-studio .salary-submit-benefits-custom input:focus,
      .salary-submit-studio .salary-submit-benefits-custom button:hover,
      .salary-submit-studio .salary-submit-benefits-custom button:focus-visible {
        border-color: color-mix(in oklab, var(--app-color-body) 34%, transparent);
        background: color-mix(in oklab, var(--app-color-body) 8%, transparent);
        color: var(--app-color-body);
        box-shadow: none;
      }
      .salary-submit-studio .salary-submit-benefit-chip.is-selected {
        border-color: color-mix(in oklab, var(--benefit-tone) 54%, var(--app-color-body) 10%);
        background:
          linear-gradient(180deg, color-mix(in oklab, var(--benefit-tone) 18%, transparent), color-mix(in oklab, var(--benefit-tone) 9%, transparent)),
          var(--app-color-canvas);
      }
      .salary-submit-studio .salary-submit-benefit-chip:hover,
      .salary-submit-studio .salary-submit-benefit-chip:focus-visible {
        border-color: color-mix(in oklab, var(--benefit-tone) 64%, var(--app-color-body) 16%);
        background:
          linear-gradient(180deg, color-mix(in oklab, var(--benefit-tone) 24%, transparent), color-mix(in oklab, var(--benefit-tone) 12%, transparent)),
          var(--app-color-canvas);
      }
      .salary-submit-studio .salary-submit-benefit-chip__remove,
      .salary-submit-studio .salary-submit-benefit-option__add {
        background: color-mix(in oklab, var(--benefit-tone) 18%, transparent);
        color: color-mix(in oklab, var(--app-color-body) 82%, var(--benefit-tone));
      }
      .salary-submit-studio .salary-submit-benefits-selected {
        min-height: 36px;
        background: color-mix(in oklab, var(--app-color-body) 4%, var(--app-color-canvas));
        border-bottom-color: color-mix(in oklab, var(--app-color-body) 12%, transparent);
      }
      .salary-submit-studio .salary-submit-benefits-options {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 6px !important;
        max-height: none;
        overflow: visible;
        background: color-mix(in oklab, var(--app-color-body) 2%, var(--app-color-canvas));
      }
      .salary-submit-studio .salary-submit-benefit-option {
        min-height: 32px;
        border-radius: 8px;
        border-color: color-mix(in oklab, var(--benefit-tone) 18%, transparent);
        background: color-mix(in oklab, var(--benefit-tone) 6%, transparent);
        color: color-mix(in oklab, var(--app-color-body) 84%, var(--app-color-text-muted));
      }
      .salary-submit-studio .salary-submit-benefits-tools {
        background: color-mix(in oklab, var(--app-color-body) 2%, var(--app-color-canvas));
      }
      .salary-submit-studio .salary-submit-benefits-tool.app-icon-action {
        --app-icon-action-outline: color-mix(in oklab, var(--app-color-body) 15%, transparent);
        --app-icon-action-outline-hover: color-mix(in oklab, var(--app-color-body) 30%, transparent);
        --app-icon-action-bg: color-mix(in oklab, var(--app-color-body) 4%, transparent);
        --app-icon-action-hover-bg: color-mix(in oklab, var(--app-color-body) 7%, transparent);
        --app-icon-action-fg: color-mix(in oklab, var(--app-color-body) 78%, var(--app-color-text-muted));
        --app-icon-action-fg-hover: var(--app-color-body);
        border-color: var(--app-icon-action-outline);
        background: var(--app-icon-action-bg);
        color: var(--app-icon-action-fg);
      }
      .salary-submit-studio .salary-submit-benefits-tool.app-icon-action:hover,
      .salary-submit-studio .salary-submit-benefits-tool.app-icon-action:focus-visible {
        border-color: var(--app-icon-action-outline-hover);
        background: var(--app-icon-action-hover-bg);
        color: var(--app-icon-action-fg-hover);
      }
      .salary-submit-studio .salary-submit-benefit-option.is-selected {
        border-color: color-mix(in oklab, var(--benefit-tone) 58%, var(--app-color-body) 10%);
        background:
          linear-gradient(180deg, color-mix(in oklab, var(--benefit-tone) 19%, transparent), color-mix(in oklab, var(--benefit-tone) 9%, transparent)),
          var(--app-color-canvas);
        color: var(--app-color-body);
      }
      .salary-submit-studio .salary-submit-benefit-option__check {
        border-color: color-mix(in oklab, var(--benefit-tone) 45%, var(--app-color-body) 12%);
        background: color-mix(in oklab, var(--app-color-canvas) 86%, var(--benefit-tone));
      }
      .salary-submit-studio .salary-submit-benefit-option.is-selected .salary-submit-benefit-option__check {
        border-color: var(--benefit-tone);
        background: var(--benefit-tone);
      }
      .salary-submit-studio .salary-submit-benefit-option:hover,
      .salary-submit-studio .salary-submit-benefit-option:focus-visible {
        border-color: color-mix(in oklab, var(--benefit-tone) 42%, transparent);
        background: color-mix(in oklab, var(--benefit-tone) 13%, transparent);
        color: var(--app-color-body);
      }
      .salary-submit-studio .salary-submit-benefits-custom {
        border-top-color: color-mix(in oklab, var(--app-color-body) 10%, transparent);
        background: color-mix(in oklab, var(--app-color-body) 3%, var(--app-color-canvas));
      }
      .salary-submit-studio .salary-submit-benefits-custom input {
        background: var(--app-color-canvas);
      }
      .salary-submit-studio .salary-submit-benefits-custom button {
        background:
          linear-gradient(180deg, color-mix(in oklab, var(--app-color-body) 12%, transparent), color-mix(in oklab, var(--app-color-body) 6%, transparent)),
          var(--app-color-canvas);
      }
      .salary-submit-studio .salary-submit-benefits-add__icon {
        background: color-mix(in oklab, var(--app-color-body) 12%, transparent);
        color: var(--app-color-body);
      }
    `
  ]
})
export class SubmitSalaryReportPageComponent {
  private readonly salaryReports = inject(SalaryReportsPort);
  private submissionIdempotencyKey: string | null = null;
  readonly submitReportIcon = resolveAppIconSpec('nav-submit-report');
  readonly options = signal<SalaryOptions>(emptySalaryOptions());
  readonly activeStep = signal<1 | 2 | 3 | 4>(1);
  readonly stepDirection = signal<'forward' | 'backward'>('forward');
  readonly submitTip = signal<{
    text: string;
    left: number;
    top: number;
    horizontal: 'left' | 'right';
    vertical: 'top' | 'bottom';
  } | null>(null);
  readonly isSubmitting = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly salaryDisplay = (value: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  readonly experienceDisplay = (value: number) => `${value} ${value === 1 ? 'year' : 'years'}`;
  readonly hoursDisplay = (value: number) => `${value} hours`;
  readonly benefitOptions = [
    'Medical insurance',
    'Social insurance',
    'Transportation allowance',
    'Housing allowance',
    'Meal allowance',
    'Annual leave',
    'Extra paid leave',
    'Overtime pay',
    'Training budget',
    'Tools / laptop',
    'Phone allowance',
    'Remote work support',
    'Gym / wellness',
    'Family coverage'
  ];
  private readonly benefitTonePalette = [
    'rgb(124 154 255)',
    'rgb(178 139 255)',
    'rgb(238 142 104)',
    'rgb(230 126 166)',
    'rgb(105 182 208)',
    'rgb(211 168 82)',
    'rgb(154 166 190)'
  ];
  private readonly defaultPopularBenefits = [
    'Medical insurance',
    'Social insurance',
    'Transportation allowance',
    'Annual leave',
    'Training budget'
  ];
  benefitDraftInput = '';
  draft = createSalaryReportDraft();

  constructor() {
    this.salaryReports.loadOptions().subscribe({ next: options => this.options.set(options) });
  }

  setStep(step: 1 | 2 | 3 | 4): void {
    const currentStep = this.activeStep();
    this.hideSubmitTip();
    this.stepDirection.set(step >= currentStep ? 'forward' : 'backward');
    this.activeStep.set(step);
  }
  previousStep(): void {
    this.setStep(Math.max(1, this.activeStep() - 1) as 1 | 2 | 3 | 4);
  }
  nextStep(): void {
    this.setStep(Math.min(4, this.activeStep() + 1) as 1 | 2 | 3 | 4);
  }

  isStepComplete(step: 1 | 2 | 3 | 4): boolean {
    switch (step) {
      case 1:
        return Boolean(
          this.draft.discipline &&
            this.draft.monthlyNetSalary &&
            this.draft.currency &&
            this.draft.yearsOfExperience != null
        );
      case 2:
        return Boolean(
          this.draft.companyType &&
            this.draft.city &&
            this.draft.country &&
            this.draft.workMode
        );
      case 3:
        return Boolean(
          this.draft.housingProvided ||
            this.draft.transportationProvided ||
            this.draft.annualBonus ||
            this.draft.salaryFairness ||
            this.draft.recommendField ||
            this.draft.professionalCertificate ||
            this.draft.highestEducation ||
            this.draft.dailyWorkHours != null ||
            this.draft.extraDayOff
        );
      case 4:
        return Boolean(this.draft.benefits.trim() || this.draft.negotiationAdvice.trim());
    }
  }

  showSubmitTip(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const trigger = event.currentTarget as HTMLElement | null;
    const text =
      trigger?.getAttribute('aria-label')?.trim() || trigger?.dataset['uiTip']?.trim() || '';

    if (!trigger || !text) {
      this.submitTip.set(null);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const isFieldTip = trigger.classList.contains('salary-submit-field__tip');
    const pointer =
      isFieldTip
        ? { x: rect.right, y: rect.top + rect.height / 2, fallbackLeft: rect.left }
        :
      event instanceof MouseEvent && event.type === 'mousemove' && !isFieldTip
        ? { x: event.clientX, y: event.clientY, fallbackLeft: event.clientX }
        : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, fallbackLeft: rect.left };
    const tipWidth = Math.min(292, window.innerWidth - 32);
    const estimatedHeight = text.length > 92 ? 72 : 56;
    const viewportPadding = 16;
    const offset = 18;
    const horizontal: 'left' | 'right' =
      pointer.x + offset + tipWidth <= window.innerWidth - viewportPadding ? 'right' : 'left';
    const vertical: 'top' | 'bottom' = 'bottom';
    const rawLeft =
      horizontal === 'right' ? pointer.x + offset : pointer.fallbackLeft - offset - tipWidth;
    const rawTop = pointer.y - estimatedHeight / 2;
    const left = Math.min(
      Math.max(rawLeft, viewportPadding),
      window.innerWidth - viewportPadding - tipWidth
    );
    const top = Math.min(
      Math.max(rawTop, viewportPadding),
      window.innerHeight - viewportPadding - estimatedHeight
    );

    this.submitTip.set({
      text,
      left: Math.round(left),
      top: Math.round(top),
      horizontal,
      vertical
    });
  }

  holdSubmitTipTrigger(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  hideSubmitTip(): void {
    this.submitTip.set(null);
  }

  selectedBenefits(): string[] {
    return this.parseBenefitList(this.draft.benefits);
  }

  hasBenefit(benefit: string): boolean {
    const normalized = this.normalizeBenefit(benefit);
    return this.selectedBenefits().some(item => this.normalizeBenefit(item) === normalized);
  }

  availableBenefitOptions(): string[] {
    return this.benefitOptions.filter(benefit => !this.hasBenefit(benefit));
  }

  benefitTone(benefit: string): string {
    const normalized = this.normalizeBenefit(benefit);
    const knownIndex = this.benefitOptions.findIndex(
      option => this.normalizeBenefit(option) === normalized
    );
    const index = knownIndex >= 0 ? knownIndex : this.hashBenefitTone(normalized);
    return this.benefitTonePalette[index % this.benefitTonePalette.length];
  }

  toggleBenefit(benefit: string): void {
    const selected = this.selectedBenefits();
    const normalized = this.normalizeBenefit(benefit);
    const exists = selected.some(item => this.normalizeBenefit(item) === normalized);
    this.setBenefits(exists ? selected.filter(item => this.normalizeBenefit(item) !== normalized) : [...selected, benefit]);
  }

  removeBenefit(benefit: string): void {
    const normalized = this.normalizeBenefit(benefit);
    this.setBenefits(this.selectedBenefits().filter(item => this.normalizeBenefit(item) !== normalized));
  }

  resetBenefits(): void {
    this.setBenefits(this.defaultPopularBenefits);
  }

  selectAllBenefits(): void {
    this.setBenefits(this.benefitOptions);
  }

  invertBenefits(): void {
    const selected = new Set(this.selectedBenefits().map(item => this.normalizeBenefit(item)));
    this.setBenefits(
      this.benefitOptions.filter(benefit => !selected.has(this.normalizeBenefit(benefit)))
    );
  }

  addCustomBenefit(event?: Event): void {
    event?.preventDefault();
    const benefit = this.benefitDraftInput.trim();
    if (!benefit) {
      return;
    }
    if (!this.hasBenefit(benefit)) {
      this.setBenefits([...this.selectedBenefits(), benefit]);
    }
    this.benefitDraftInput = '';
  }

  private setBenefits(items: string[]): void {
    const unique = new Map<string, string>();
    for (const item of items) {
      const normalized = this.normalizeBenefit(item);
      if (normalized) {
        unique.set(normalized, item.trim());
      }
    }
    this.setText('benefits', Array.from(unique.values()).join(', '));
  }

  private parseBenefitList(value: string): string[] {
    return String(value || '')
      .split(/[,؛;\n]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  private normalizeBenefit(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private hashBenefitTone(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  setText(field: SalaryReportTextField, value: string | null): void {
    this.draft[field] = value ?? '';
    this.submissionIdempotencyKey = null;
  }
  setNumber(field: SalaryReportNumberField, value: number | null): void {
    this.draft[field] = value;
    this.submissionIdempotencyKey = null;
  }

  submit(): void {
    if (
      !this.draft.discipline ||
      !this.draft.companyType ||
      !this.draft.city ||
      !this.draft.country ||
      !this.draft.monthlyNetSalary ||
      this.draft.yearsOfExperience == null
    ) {
      this.isError.set(true);
      this.message.set('Complete all required fields before publishing.');
      return;
    }
    this.isSubmitting.set(true);
    this.message.set('');
    this.submissionIdempotencyKey ??= this.createIdempotencyKey();
    this.salaryReports.submit(this.draft, this.submissionIdempotencyKey).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isError.set(false);
        this.message.set('Your salary report was published. Thank you for contributing.');
        this.draft = createSalaryReportDraft();
        this.submissionIdempotencyKey = null;
      },
      error: () => {
        this.isSubmitting.set(false);
        this.isError.set(true);
        this.message.set('We could not publish the report. Review the form and try again.');
      }
    });
  }

  private createIdempotencyKey(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `salary-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  }
}







