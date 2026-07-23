import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  ArrowRight01Icon,
  Shield01Icon,
  ViewIcon,
  ViewOffIcon
} from '@shared/icons/app-icon.registry';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AuthFacadeService } from '../../../../auth/auth.service';
import { normalizeApiUrl, resolveSafeReturnUrl } from '../../../../auth/auth-helpers';
import { runtimeConfig } from '../../../../core/runtime-config';
import { ToastService } from '../../../../shared/toast/toast.service';
import { environment } from '../../../../../environments/environment';
import { FloatingOutlineLabelDirective } from './directives/floating-outline-label.directive';
import { AUTH_SCREEN_MESSAGES } from './constants/auth-screen.messages';
import { AuthScreenQuoteManager } from './helpers/auth-screen-quote.manager';

type LooseValue = ReturnType<typeof JSON.parse>;
type AuthScreenMode = 'login' | 'signup';
type AuthFieldName = 'fullName' | 'email' | 'password' | 'confirmPassword';

@Component({
  selector: 'feature-auth-screen',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, HugeiconsIconComponent, FloatingOutlineLabelDirective],
  styleUrls: ['./auth-screen.component.scss'],
  templateUrl: './auth-screen.component.html'
})
export class AuthScreenComponent implements OnInit, OnDestroy {
  readonly passwordVisibleIcon = ViewOffIcon;
  readonly passwordHiddenIcon = ViewIcon;
  readonly arrowRightIcon = ArrowRight01Icon;
  readonly shieldIcon = Shield01Icon;
  readonly loading = signal(false);
  readonly googleLoading = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly year = new Date().getFullYear();

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthFacadeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly mode: AuthScreenMode =
    (this.route.snapshot.data?.['mode'] as AuthScreenMode) ?? 'login';
  readonly isSignupMode = this.mode === 'signup';
  readonly selfRegistrationEnabled =
    (runtimeConfig().allowSelfRegistration ?? environment.security?.allowSelfRegistration) !==
    false;
  readonly googleAuthEnabled = runtimeConfig().googleAuth?.enabled !== false;
  private readonly quoteManager = new AuthScreenQuoteManager(this.translate);
  readonly displayQuote = this.quoteManager.displayQuote;
  readonly quoteVisible = this.quoteManager.quoteVisible;

  private started = false;
  private submitAttempted = false;

  private readonly passwordComplexity = (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) {
      return null;
    }
    if (!/[a-z]/.test(value)) {
      return { lowercase: true };
    }
    if (!/[A-Z]/.test(value)) {
      return { uppercase: true };
    }
    if (!/[0-9]/.test(value)) {
      return { digit: true };
    }
    if (!/[^A-Za-z0-9]/.test(value)) {
      return { special: true };
    }
    return null;
  };

  readonly form = this.fb.group({
    fullName: ['', this.isSignupMode ? [Validators.required, Validators.minLength(3)] : []],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      this.isSignupMode
        ? [Validators.required, Validators.minLength(10), this.passwordComplexity]
        : [Validators.required]
    ],
    confirmPassword: ['', this.isSignupMode ? [Validators.required] : []],
    remember: [true],
    acceptTerms: [
      this.isSignupMode ? false : true,
      this.isSignupMode ? [Validators.requiredTrue] : []
    ]
  });

  ngOnInit(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    if (this.handleGoogleCallback()) {
      return;
    }

    if (this.auth.isAuthenticated()) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const target = this.resolveReturnUrl(returnUrl);
      void this.router.navigateByUrl(target, { replaceUrl: true });
      return;
    }

    if (this.isSignupMode && !this.selfRegistrationEnabled) {
      void this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    void this.quoteManager.init();
  }

  ngOnDestroy(): void {
    this.quoteManager.destroy();
    this.started = false;
  }

  togglePassword(which: 'main' | 'confirm' = 'main'): void {
    if (which === 'confirm') {
      this.showConfirmPassword.update(value => !value);
      return;
    }

    this.showPassword.update(value => !value);
  }

  async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.loading()) {
      return;
    }

    this.submitAttempted = true;

    const validationMessage = this.resolveValidationMessage();
    if (validationMessage) {
      this.form.markAllAsTouched();
      this.toast.warning(validationMessage, 5000);
      return;
    }

    this.loading.set(true);
    const remember = !!this.form.controls.remember.value;
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    try {
      if (this.isSignupMode) {
        await this.handleSignup(remember);
        return;
      }

      const { email, password } = this.form.getRawValue() as LooseValue;
      await this.auth.login(email, password, remember);
      await this.router.navigateByUrl(this.resolveReturnUrl(returnUrl));
    } catch (error: LooseValue) {
      if (this.isSignupMode) {
        this.toast.error(error?.message || AUTH_SCREEN_MESSAGES.signupFailed, 8000);
      }
    } finally {
      this.loading.set(false);
    }
  }

  continueWithGoogle(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.loading() || this.googleLoading()) {
      return;
    }

    if (this.isSignupMode && !this.selfRegistrationEnabled) {
      this.toast.warning('Account access is currently managed by administrators.', 6000);
      return;
    }

    this.googleLoading.set(true);
    const target = this.buildGoogleAuthUrl();
    if (!target) {
      this.googleLoading.set(false);
      this.toast.error('Google access is not configured yet.', 7000);
      return;
    }

    window.location.assign(target);
  }

  hasValue(controlName: AuthFieldName): boolean {
    const value = this.form.controls[controlName].value;
    return typeof value === 'string' ? value.trim().length > 0 : !!value;
  }

  isFieldInvalid(controlName: AuthFieldName): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitAttempted);
  }

  isConfirmPasswordInvalid(): boolean {
    if (!this.isSignupMode) {
      return false;
    }

    const control = this.form.controls.confirmPassword;
    return (control.touched || this.submitAttempted) && (control.invalid || this.passwordMismatch);
  }

  isTermsInvalid(): boolean {
    if (!this.isSignupMode) {
      return false;
    }

    const control = this.form.controls.acceptTerms;
    return !control.value && (control.touched || this.submitAttempted);
  }

  isArabicQuote(): boolean {
    return /[\u0600-\u06FF]/.test(this.displayQuote());
  }

  get passwordMismatch(): boolean {
    if (!this.isSignupMode) {
      return false;
    }

    const password = this.form.controls.password.value;
    const confirmPassword = this.form.controls.confirmPassword.value;
    if (!confirmPassword) {
      return false;
    }

    return password !== confirmPassword;
  }

  private async handleSignup(remember: boolean): Promise<void> {
    const { fullName, email, password } = this.form.getRawValue() as LooseValue;
    const message = await this.auth.signup(
      {
        fullName: String(fullName || '').trim(),
        email,
        password
      },
      remember
    );

    this.toast.success(message || AUTH_SCREEN_MESSAGES.signupSuccess, 8000);
    await this.router.navigateByUrl('/login');
  }

  private resolveValidationMessage(): string | null {
    if (this.isSignupMode) {
      const fullName = this.form.controls.fullName;
      if (fullName.hasError('required')) {
        return AUTH_SCREEN_MESSAGES.fullNameRequired;
      }
      if (fullName.hasError('minlength')) {
        return AUTH_SCREEN_MESSAGES.fullNameMinLength;
      }
    }

    const email = this.form.controls.email;
    if (email.hasError('required')) {
      return AUTH_SCREEN_MESSAGES.emailRequired;
    }
    if (email.hasError('email')) {
      return AUTH_SCREEN_MESSAGES.emailInvalid;
    }

    const password = this.form.controls.password;
    if (password.hasError('required')) {
      return AUTH_SCREEN_MESSAGES.passwordRequired;
    }
    if (password.hasError('minlength')) {
      return AUTH_SCREEN_MESSAGES.passwordMinLength;
    }
    if (password.hasError('lowercase')) {
      return AUTH_SCREEN_MESSAGES.passwordLowercase;
    }
    if (password.hasError('uppercase')) {
      return AUTH_SCREEN_MESSAGES.passwordUppercase;
    }
    if (password.hasError('digit')) {
      return AUTH_SCREEN_MESSAGES.passwordDigit;
    }
    if (password.hasError('special')) {
      return AUTH_SCREEN_MESSAGES.passwordSpecial;
    }

    if (this.isSignupMode) {
      const confirmPassword = this.form.controls.confirmPassword;
      if (confirmPassword.hasError('required')) {
        return AUTH_SCREEN_MESSAGES.confirmPasswordRequired;
      }
      if (this.passwordMismatch) {
        return AUTH_SCREEN_MESSAGES.passwordMismatch;
      }
      if (!this.form.controls.acceptTerms.value) {
        return AUTH_SCREEN_MESSAGES.signupTermsRequired;
      }
    }

    return this.form.invalid ? AUTH_SCREEN_MESSAGES.reviewFields : null;
  }

  private resolveReturnUrl(raw: string | null): string {
    return resolveSafeReturnUrl(raw);
  }

  private handleGoogleCallback(): boolean {
    const query = this.route.snapshot.queryParamMap;
    const status = query.get('googleStatus');
    if (!status) {
      return false;
    }

    const returnUrl = this.resolveReturnUrl(query.get('returnUrl'));
    const message = query.get('googleMessage');

    if (status === 'success') {
      const payload = this.decodeGooglePayload(query.get('googlePayload'));
      if (!payload) {
        this.toast.error('Google did not return a valid session.', 8000);
        void this.router.navigateByUrl(this.isSignupMode ? '/signup' : '/login', { replaceUrl: true });
        return true;
      }

      try {
        this.auth.completeExternalLogin(payload, true);
        void this.router.navigateByUrl(returnUrl, { replaceUrl: true });
      } catch (error: LooseValue) {
        this.toast.error(error?.message || 'Google sign in failed.', 8000);
        void this.router.navigateByUrl(this.isSignupMode ? '/signup' : '/login', { replaceUrl: true });
      }
      return true;
    }

    if (status === 'pending') {
      this.toast.success(
        message || 'Google signup request submitted. Please wait for admin approval.',
        9000
      );
      void this.router.navigateByUrl('/login', { replaceUrl: true });
      return true;
    }

    this.toast.error(message || 'Google authentication failed.', 9000);
    void this.router.navigateByUrl(this.isSignupMode ? '/signup' : '/login', { replaceUrl: true });
    return true;
  }

  private decodeGooglePayload(raw: string | null): LooseValue | null {
    if (!raw) {
      return null;
    }

    try {
      const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      return JSON.parse(decodeURIComponent(escape(window.atob(padded))));
    } catch {
      return null;
    }
  }

  private buildGoogleAuthUrl(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    const configuredPath = this.isSignupMode
      ? runtime.googleAuth?.signupPath
      : runtime.googleAuth?.loginPath;
    const fallbackPath = this.isSignupMode ? 'Auth/google/signup' : 'Auth/google/login';
    const path = configuredPath || fallbackPath;
    const baseUrl = path.startsWith('http') ? path : normalizeApiUrl(apiBase, path);
    const url = new URL(baseUrl, window.location.origin);
    const returnUrl = this.resolveReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    const callbackUrl =
      runtime.googleAuth?.callbackUrl ||
      `${window.location.origin}${this.isSignupMode ? '/signup' : '/login'}`;

    url.searchParams.set('mode', this.isSignupMode ? 'signup' : 'login');
    url.searchParams.set('returnUrl', returnUrl);
    url.searchParams.set('callbackUrl', callbackUrl);
    return url.toString();
  }
}
