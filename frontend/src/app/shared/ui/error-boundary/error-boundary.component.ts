import {
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Alert01Icon, ArrowReloadHorizontalIcon, Home03Icon } from '@shared/icons/app-icon.registry';

@Component({
  selector: 'app-error-boundary',
  standalone: true,
  imports: [HugeiconsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasError) {
      <div class="error-boundary" [class.error-boundary-fullscreen]="fullscreen">
        <div class="error-content">
          <div class="error-icon">
            <hugeicons-icon
              [icon]="errorStateIcon"
              [size]="64"
              [strokeWidth]="1.8"
              aria-hidden="true"
            ></hugeicons-icon>
          </div>

          <h2 class="error-title">{{ title }}</h2>

          @if (message) {
            <p class="error-message">{{ message }}</p>
          }

          @if (showDetails && errorDetails) {
            <details class="error-details">
              <summary>تفاصيل الخطأ (للمطورين)</summary>
              <pre>{{ errorDetails }}</pre>
            </details>
          }

          <div class="error-actions">
            <button class="btn btn-primary" (click)="handleRetry()">
              <hugeicons-icon
                [icon]="retryActionIcon"
                [size]="16"
                [strokeWidth]="2"
                aria-hidden="true"
              ></hugeicons-icon>
              إعادة المحاولة
            </button>

            @if (showHomeButton) {
              <button class="btn btn-secondary" (click)="goHome()">
                <hugeicons-icon
                  [icon]="homeActionIcon"
                  [size]="16"
                  [strokeWidth]="2"
                  aria-hidden="true"
                ></hugeicons-icon>
                الصفحة الرئيسية
              </button>
            }
          </div>
        </div>
      </div>
    } @else {
      <ng-content></ng-content>
    }
  `,
  styles: [
    `
      .error-boundary {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        padding: 32px;
        background: #f9fafb;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }

      .error-boundary-fullscreen {
        min-height: 100vh;
        border-radius: 0;
        border: none;
      }

      .error-content {
        max-width: 600px;
        text-align: center;
      }

      .error-icon {
        margin-bottom: 24px;
        color: #ef4444;
      }

      .error-icon hugeicons-icon {
        filter: drop-shadow(0 4px 6px rgba(239, 68, 68, 0.1));
      }

      .error-title {
        font-size: 24px;
        font-weight: 600;
        color: #111827;
        margin-bottom: 12px;
      }

      .error-message {
        font-size: 16px;
        color: #6b7280;
        margin-bottom: 24px;
        line-height: 1.6;
      }

      .error-details {
        text-align: right;
        margin-bottom: 24px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
      }

      .error-details summary {
        cursor: pointer;
        font-weight: 500;
        color: #6b7280;
        user-select: none;
      }

      .error-details summary:hover {
        color: #111827;
      }

      .error-details pre {
        margin-top: 12px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 12px;
        color: #ef4444;
        direction: ltr;
        text-align: left;
      }

      .error-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        font-size: 14px;
      }

      .btn-primary {
        background: #3b82f6;
        color: white;
      }

      .btn-primary:hover {
        background: #2563eb;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }

      .btn-secondary {
        background: white;
        color: #6b7280;
        border: 1px solid #e5e7eb;
      }

      .btn-secondary:hover {
        background: #f9fafb;
        border-color: #d1d5db;
        color: #111827;
      }

      [dir='rtl'] .error-details pre {
        direction: ltr;
      }
    `
  ]
})
export class ErrorBoundaryComponent {
  readonly errorStateIcon = Alert01Icon;
  readonly retryActionIcon = ArrowReloadHorizontalIcon;
  readonly homeActionIcon = Home03Icon;

  @Input() title = 'حدث خطأ غير متوقع';
  @Input() message = 'نعتذر عن الإزعاج. الرجاء المحاولة مرة أخرى.';
  @Input() fullscreen = false;
  @Input() showDetails = false;
  @Input() showHomeButton = true;
  @Input() hasError = false;

  @Output() retry = new EventEmitter<void>();
  @Output() home = new EventEmitter<void>();

  errorDetails = '';

  setError(error: Error): void {
    this.hasError = true;
    this.errorDetails = `${error.name}: ${error.message}\n\nStack Trace:\n${error.stack}`;
  }

  handleRetry(): void {
    this.hasError = false;
    this.errorDetails = '';
    this.retry.emit();
  }

  goHome(): void {
    this.home.emit();
  }
}

export class GlobalErrorBoundaryHandler implements ErrorHandler {
  handleError(error: Error): void {
    console.error('Global Error:', error);
  }
}
