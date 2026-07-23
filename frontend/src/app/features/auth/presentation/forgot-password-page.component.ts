import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthFacadeService } from '../../../auth/auth.service';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'feature-auth-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./forgot-password-page.component.scss'],
  templateUrl: './forgot-password-page.component.html'
})
export class ForgotPasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthFacadeService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

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

    const email = String(this.form.controls.email.value ?? '').trim();

    this.loading.set(true);
    this.sent.set(false);
    try {
      const message = await this.auth.requestPasswordReset(email);
      this.sent.set(true);
      this.toast.success(message, 8000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to send reset instructions right now.';
      this.toast.error(message, 8000);
    } finally {
      this.loading.set(false);
    }
  }

  private resolveValidationMessage(): string | null {
    const email = this.form.controls.email;
    if (email.hasError('required')) {
      return 'Enter the email address for this account.';
    }
    if (email.hasError('email')) {
      return 'Enter a valid email address.';
    }

    return null;
  }
}
