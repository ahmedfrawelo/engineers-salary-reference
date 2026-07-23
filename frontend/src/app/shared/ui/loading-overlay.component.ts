import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
  selector: 'loading-overlay',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="overlay">
        <div class="ring" aria-live="polite">
          <span class="pulse"></span>
          <span class="tail tail-1"></span>
          <span class="tail tail-2"></span>
          <span class="tail tail-3"></span>
          <span class="core"></span>
          <span class="arc arc-1"></span>
          <span class="arc arc-2"></span>
        </div>
        <p class="text">
          <span class="label">{{ params.loadingMessage || 'Loading' }}</span>
          <span class="dots"> <i></i><i></i><i></i> </span>
        </p>
      </div>
    }
  `,
  styles: [
    `
      :host {
        --lo-color: rgb(var(--primary));
      }

      .overlay {
        position: absolute;
        left: 0;
        right: 0;
        top: var(--ag-header-height, 48px);
        bottom: var(--ag-footer-height, 0px);
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 12;
        font-family:
          'Inter',
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          sans-serif;
        background: transparent;
        gap: 10px;
      }

      .ring {
        width: 58px;
        height: 58px;
        border-radius: 50%;
        border: 1.5px solid color-mix(in srgb, var(--lo-color) 80%, transparent);
        position: relative;
        animation: rotate 1.05s linear infinite;
        box-shadow:
          inset 0 0 12px color-mix(in srgb, var(--lo-color) 45%, transparent),
          0 0 28px color-mix(in srgb, var(--lo-color) 35%, transparent);
        background: radial-gradient(
          circle,
          color-mix(in srgb, var(--lo-color) 35%, transparent) 0%,
          transparent 70%
        );
      }

      .pulse {
        position: absolute;
        inset: -12px;
        border-radius: 50%;
        border: 1px solid color-mix(in srgb, var(--lo-color) 60%, transparent);
        animation: ripple 1.6s ease-out infinite;
      }

      .core {
        position: absolute;
        width: 18px;
        height: 18px;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(
          circle,
          var(--lo-color),
          color-mix(in srgb, var(--lo-color) 30%, transparent)
        );
        box-shadow:
          0 0 18px color-mix(in srgb, var(--lo-color) 65%, transparent),
          0 0 32px color-mix(in srgb, var(--lo-color) 45%, transparent);
        animation: glow 1.15s ease-in-out infinite;
      }

      .tail {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--lo-color);
        top: 50%;
        left: 50%;
        transform-origin: -26px;
        box-shadow: 0 0 14px color-mix(in srgb, var(--lo-color) 80%, transparent);
        animation: sweep 0.95s linear infinite;
      }

      .tail-1 {
        animation-delay: 0s;
      }
      .tail-2 {
        animation-delay: 0.32s;
        opacity: 0.5;
      }
      .tail-3 {
        animation-delay: 0.64s;
        opacity: 0.35;
      }

      .arc {
        position: absolute;
        width: 70px;
        height: 70px;
        border-radius: 50%;
        border-top: 1px solid color-mix(in srgb, var(--lo-color) 35%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--lo-color) 18%, transparent);
        border-left: transparent;
        border-right: transparent;
        animation: arc-spin 2s linear infinite;
        opacity: 0.5;
      }
      .arc-1 {
        animation-duration: 2.2s;
      }
      .arc-2 {
        width: 80px;
        height: 80px;
        animation-duration: 1.8s;
        animation-direction: reverse;
        opacity: 0.3;
      }

      .text {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.4px;
        color: rgb(var(--fg));
        text-align: center;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .text .label {
        display: inline-block;
        animation: float-text 1.2s ease-in-out infinite;
      }

      .dots {
        display: inline-flex;
        gap: 4px;
      }

      .dots i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          var(--lo-color),
          color-mix(in srgb, var(--lo-color) 20%, transparent)
        );
        animation: dots 0.9s ease-in-out infinite;
      }

      .dots i:nth-child(2) {
        animation-delay: 0.15s;
      }
      .dots i:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes rotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes ripple {
        from {
          transform: scale(0.6);
          opacity: 0.4;
        }
        to {
          transform: scale(1.3);
          opacity: 0;
        }
      }

      @keyframes glow {
        0%,
        100% {
          box-shadow: 0 0 12px rgba(52, 245, 181, 0.65);
        }
        50% {
          box-shadow: 0 0 22px rgba(59, 130, 246, 0.45);
        }
      }

      @keyframes sweep {
        from {
          transform: translate(-50%, -50%) rotate(0deg);
        }
        to {
          transform: translate(-50%, -50%) rotate(360deg);
        }
      }

      @keyframes arc-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(-360deg);
        }
      }

      @keyframes dots {
        0% {
          transform: translateY(0);
          opacity: 0.3;
        }
        50% {
          transform: translateY(-3px);
          opacity: 1;
        }
        100% {
          transform: translateY(0);
          opacity: 0.3;
        }
      }

      @keyframes float-text {
        0% {
          transform: translateY(0);
          opacity: 0.8;
        }
        40% {
          transform: translateY(-2px);
          opacity: 1;
        }
        100% {
          transform: translateY(0);
          opacity: 0.8;
        }
      }
    `
  ]
})
export class LoadingOverlayComponent {
  @Input() visible = false;
  @Input() params: { loadingMessage?: string } = {};
}
