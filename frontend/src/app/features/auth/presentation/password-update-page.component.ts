import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthFacadeService } from '../../../auth/auth.service';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'feature-auth-password-update-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./password-update-page.component.scss'],
  templateUrl: './password-update-page.component.html'
})
export class PasswordUpdatePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthFacadeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly form = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(10)]],
    confirmPassword: ['', [Validators.required]]
  });

  ngOnInit(): void {
    if (!this.auth.mustChangePassword()) {
      void this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    }
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

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const currentPassword = String(this.form.controls.currentPassword.value ?? '');
    const newPassword = String(this.form.controls.newPassword.value ?? '');

    this.loading.set(true);
    try {
      await this.auth.changePassword(currentPassword, newPassword);
      this.toast.success('Password updated. Sign in again with your new password.', 8000);
      this.auth.completeForcedPasswordChange(returnUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Password update failed. Please try again.';
      this.toast.error(message, 8000);
    } finally {
      this.loading.set(false);
    }
  }

  leave(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.auth.completeForcedPasswordChange(returnUrl);
  }

  private resolveValidationMessage(): string | null {
    const currentPassword = String(this.form.controls.currentPassword.value ?? '').trim();
    const newPassword = String(this.form.controls.newPassword.value ?? '').trim();
    const confirmPassword = String(this.form.controls.confirmPassword.value ?? '').trim();

    if (!currentPassword) {
      return 'Enter the temporary password you signed in with.';
    }
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
