import { Component, inject } from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

import { NetworkStatusService } from '@platform/angular/network/network-status.service';

/**
 * Network Status Indicator Component
 * مكون عرض حالة الشبكة
 *
 * Displays network status with visual indicator
 */
@Component({
  selector: 'app-network-indicator',
  standalone: true,
  imports: [AppIconDirective],
  template: `
    @if (!networkService.isOnline()) {
      <div class="network-indicator offline" role="alert" aria-live="polite">
        <i appIcon="wifi-off"></i>
        <span>غير متصل بالإنترنت</span>
      </div>
    } @else if (networkService.isSlowConnection) {
      <div class="network-indicator slow" role="status">
        <i appIcon="wifi-1"></i>
        <span>اتصال بطيء</span>
      </div>
    }
  `,
  styles: [
    `
      .network-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
      }

      .network-indicator.offline {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
      }

      .network-indicator.slow {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
      }

      .network-indicator i {
        font-size: 1.2rem;
      }

      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* RTL Support */
      [dir='rtl'] .network-indicator {
        left: 20px;
        right: auto;
        animation-name: slideInRtl;
      }

      @keyframes slideInRtl {
        from {
          transform: translateX(-400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `
  ]
})
export class NetworkIndicatorComponent {
  readonly networkService = inject(NetworkStatusService);
}
