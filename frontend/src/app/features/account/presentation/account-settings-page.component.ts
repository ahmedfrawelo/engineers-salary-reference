import { DOCUMENT } from '@angular/common';
import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AUTH_USER_FACADE } from '@core/auth/auth-user.facade';

type Preference = {
  title: string;
  description: string;
  control: 'emailAlerts' | 'pushAlerts' | 'digest';
};

type SettingsSectionId = 'profile' | 'notifications' | 'security';

@Component({
  standalone: true,
  selector: 'feature-account-settings-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="account-page">
      <header class="page-head">
        <h1>Account Settings</h1>
        <p>
          Adjust personal preferences, choose how you’re notified, and manage workspace visibility.
        </p>
      </header>

      <form [formGroup]="form" (ngSubmit)="save()" class="grid">
        <article
          id="account-settings-profile"
          class="card glass"
          [class.card--focused]="focusedSection() === 'profile'"
        >
          <h2>Profile preferences</h2>

          <label class="field">
            <span>Display name</span>
            <input formControlName="name" type="text" placeholder="Your name" />
          </label>

          <label class="field">
            <span>Language</span>
            <select formControlName="language">
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </label>

          <label class="field">
            <span>Theme preference</span>
            <select formControlName="theme">
              <option value="auto">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="aurora">Aurora</option>
            </select>
          </label>
        </article>

        <article
          id="account-settings-notifications"
          class="card glass"
          [class.card--focused]="focusedSection() === 'notifications'"
        >
          <h2>Notifications</h2>

          <ul class="pref-list">
            @for (pref of preferences; track pref) {
              <li>
                <div>
                  <label class="toggle">
                    <input type="checkbox" [formControlName]="pref.control" />
                    <span class="slider"></span>
                  </label>
                  <div class="copy">
                    <strong>{{ pref.title }}</strong>
                    <p>{{ pref.description }}</p>
                  </div>
                </div>
              </li>
            }
          </ul>
        </article>

        <article
          id="account-settings-security"
          class="card glass span-2"
          [class.card--focused]="focusedSection() === 'security'"
        >
          <h2>Security</h2>
          <p class="muted">
            Switch on two-factor authentication for an additional layer. You’ll receive a
            verification code on each login attempt.
          </p>

          <label class="option-row">
            <input type="checkbox" formControlName="twoFactor" />
            <span>
              <strong>Two-factor authentication</strong>
              <small>Protect your account with an OTP challenge.</small>
            </span>
          </label>

          <label class="option-row">
            <input type="checkbox" formControlName="sessionAlerts" />
            <span>
              <strong>Session alerts</strong>
              <small>Get notified when a new device signs in.</small>
            </span>
          </label>

          <div class="actions">
            <button class="btn ghost" type="button" (click)="reset()">Reset</button>
            <button class="btn primary" type="submit" [disabled]="form.invalid || saving()">
              Save changes
            </button>
          </div>

          @if (message()) {
            <p class="status">{{ message() }}</p>
          }
        </article>
      </form>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      form {
        display: contents;
      }
      .account-page {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 16px;
      }
      .page-head h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }
      .page-head p {
        margin: 4px 0 0;
        color: rgb(var(--muted));
        max-width: 520px;
      }
      .grid {
        display: grid;
        gap: 20px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        align-items: start;
      }
      .card {
        padding: 20px;
        border-radius: 18px;
        background: rgba(var(--surface), var(--surfaceA));
        border: 1px solid rgb(var(--border-strong));
        display: flex;
        flex-direction: column;
        gap: 16px;
        scroll-margin-top: 88px;
      }
      .card--focused {
        border-color: rgba(var(--primary), 0.7);
        box-shadow: 0 0 0 1px rgba(var(--primary), 0.18);
      }
      .card h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .span-2 {
        grid-column: span 2;
      }
      @media (max-width: 720px) {
        .span-2 {
          grid-column: auto;
        }
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
      }
      .field span {
        color: rgb(var(--muted));
        text-transform: uppercase;
        letter-spacing: 0.4px;
        font-size: 11px;
      }
      .field input,
      .field select {
        height: 36px;
        border-radius: 10px;
        border: 1px solid rgb(var(--border-strong));
        background: rgba(var(--bg1), 0.9);
        color: rgb(var(--fg));
        padding: 0 12px;
        font-size: 13px;
      }
      .pref-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .pref-list li > div {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .copy strong {
        display: block;
        font-weight: 600;
      }
      .copy p {
        margin: 2px 0 0;
        color: rgb(var(--muted));
        font-size: 12px;
        line-height: 1.5;
      }
      .toggle {
        position: relative;
        display: inline-flex;
        width: 46px;
        height: 24px;
      }
      .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: rgba(var(--border-strong), 0.5);
        border-radius: 20px;
        transition: background 0.2s ease;
      }
      .slider::before {
        content: '';
        position: absolute;
        height: 18px;
        width: 18px;
        left: 4px;
        top: 3px;
        background: rgb(var(--surface));
        border-radius: 50%;
        transition: transform 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }
      .toggle input:checked + .slider {
        background: rgba(var(--primary), 0.6);
      }
      .toggle input:checked + .slider::before {
        transform: translateX(20px);
        background: rgb(var(--fg));
      }
      .option-row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        font-size: 13px;
        color: rgb(var(--fg));
      }
      .option-row strong {
        display: block;
        font-weight: 600;
      }
      .option-row small {
        display: block;
        font-size: 12px;
        color: rgb(var(--muted));
        margin-top: 2px;
      }
      .option-row input {
        margin-top: 4px;
        accent-color: rgb(var(--primary));
      }
      .actions {
        margin-top: auto;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      .status {
        margin: 0;
        font-size: 12px;
        color: rgb(var(--muted));
      }
    `
  ]
})
export class AccountSettingsPageComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AUTH_USER_FACADE);
  private route = inject(ActivatedRoute);
  private document = inject(DOCUMENT);

  readonly user = computed(() => this.auth.user());
  readonly focusedSection = signal<SettingsSectionId | null>(null);

  preferences: Preference[] = [
    {
      title: 'Email notifications',
      description: 'Receive email updates for approvals, assigned tasks, and mentions.',
      control: 'emailAlerts'
    },
    {
      title: 'Push notifications',
      description: 'Get real-time push notifications in the portal UI.',
      control: 'pushAlerts'
    },
    {
      title: 'Weekly digest',
      description: 'Summary of important activities delivered each Monday.',
      control: 'digest'
    }
  ];

  saving: WritableSignal<boolean> = signal(false);
  message: WritableSignal<string> = signal('');

  form = this.fb.group({
    name: [''],
    language: ['en', Validators.required],
    theme: ['auto', Validators.required],
    emailAlerts: [true],
    pushAlerts: [true],
    digest: [false],
    twoFactor: [false],
    sessionAlerts: [true]
  });

  constructor() {
    const current = this.user();
    if (current) {
      this.form.patchValue({ name: current.name });
    }

    const requestedSection = this.route.snapshot.queryParamMap.get('section');
    if (this.isSettingsSectionId(requestedSection)) {
      this.focusSection(requestedSection);
    }
  }

  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.message.set('Saving changes…');

    await new Promise(resolve => setTimeout(resolve, 500));

    this.saving.set(false);
    this.message.set('Settings saved locally. Hook up the API to persist them for real.');
  }

  reset() {
    const current = this.user();
    this.form.reset({
      name: current?.name ?? '',
      language: 'en',
      theme: 'auto',
      emailAlerts: true,
      pushAlerts: true,
      digest: false,
      twoFactor: false,
      sessionAlerts: true
    });
    this.message.set('Changes reverted.');
  }

  private focusSection(section: SettingsSectionId): void {
    this.focusedSection.set(section);
    setTimeout(() => {
      const element = this.document.getElementById(`account-settings-${section}`);
      element?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 0);
  }

  private isSettingsSectionId(value: string | null): value is SettingsSectionId {
    return value === 'profile' || value === 'notifications' || value === 'security';
  }
}
