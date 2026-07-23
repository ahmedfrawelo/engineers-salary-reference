import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthFacadeService } from '../../../auth/auth.service';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'feature-auth-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./reset-password-page.component.scss'],
  templateUrl: './reset-password-page.component.html'
})
export class ResetPasswordPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthFacadeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private resetEmail = '';
  private resetToken = '';

  readonly loading = signal(false);
  readonly email = signal('');
  readonly form = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(10)]],
    confirmPassword: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.resetEmail = this.route.snapshot.queryParamMap.get('email')?.trim() ?? '';
    this.resetToken = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';

    if (!this.resetEmail || !this.resetToken) {
      this.toast.warning('Open the password-reset link from your email again.', 8000);
      void this.router.navigateByUrl('/login/forgot-password', { replaceUrl: true });
      return;
    }

    this.email.set(this.resetEmail);
  }

  async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.loading()) {
      return;
    }

    const validationMessage = this.resolveValidationMessage();
    if (validationMessage) {
      this.form.markAllAsTouched();
      this.toast.warning(validationMessage, 6000);
      return;
    }

    const newPassword = String(this.form.controls.newPassword.value ?? '');
    const confirmPassword = String(this.form.controls.confirmPassword.value ?? '');

    this.loading.set(true);
    try {
      const message = await this.auth.resetPasswordWithToken(
        this.resetEmail,
        this.resetToken,
        newPassword,
        confirmPassword
      );
      this.toast.success(message, 8000);
      await this.router.navigateByUrl('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password reset failed.';
      this.toast.error(message, 8000);
    } finally {
      this.loading.set(false);
    }
  }

  private resolveValidationMessage(): string | null {
    const newPassword = String(this.form.controls.newPassword.value ?? '').trim();
    const confirmPassword = String(this.form.controls.confirmPassword.value ?? '').trim();

    if (!newPassword) {
      return 'Enter a new password.';
    }
    if (newPassword.length < 10) {
      return 'Password must be at least 10 characters.';
    }
    if (!/[a-z]/.test(newPassword)) {
      return 'Password must contain at least one lowercase letter.';
    }
    if (!/[A-Z]/.test(newPassword)) {
      return 'Password must contain at least one uppercase letter.';
    }
    if (!/[0-9]/.test(newPassword)) {
      return 'Password must contain at least one number.';
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      return 'Password must contain at least one special character.';
    }
    if (!confirmPassword) {
      return 'Confirm your new password.';
    }
    if (newPassword !== confirmPassword) {
      return 'Passwords must match.';
    }

    return null;
  }
}
