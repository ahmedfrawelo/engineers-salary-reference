import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { LoggerService } from '../logger';
import { ToastService } from '../notifications/toast.service';
import { HttpErrorUtil } from '../utils/http-error.util';
import { environment } from '../../../environments/environment';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);
  private toast = inject(ToastService);

  handleError(error: Error | HttpErrorResponse): void {
    // Log the error
    this.logger.error('Unhandled error occurred', error);

    // Determine user-friendly message
    const message = this.getUserFriendlyMessage(error);

    // Show notification to user
    this.toast.error(message, 7000);

    // In development, also log to console for debugging
    if (!environment.production) {
      console.error('💥 Global Error Handler:', error);
    }
  }

  private getUserFriendlyMessage(error: Error | HttpErrorResponse): string {
    if (error instanceof HttpErrorResponse) {
      return HttpErrorUtil.getErrorMessage(error);
    }

    // JavaScript errors
    if (error instanceof Error) {
      // Don't expose technical details to users in production
      if (environment.production) {
        return 'حدث خطأ غير متوقع. يرجى تحديث الصفحة والمحاولة مرة أخرى.';
      }
      return error.message || 'حدث خطأ غير متوقع';
    }

    return 'حدث خطأ غير متوقع';
  }
}
