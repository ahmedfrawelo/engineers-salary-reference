import {
  ChangeDetectionStrategy,
  effect,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  signal,
  viewChildren
} from '@angular/core';

import {
  ToastService,
  type Toast,
  type ToastCloseButtonPosition,
  type ToastPosition,
  type ToastType
} from './toast.service';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

const PILL_HEIGHT = 34;
const BODY_REVEAL_DELAY_MS = 840;
const BODY_MORPH_DURATION_MS = 480;
const BODY_CONTENT_REVEAL_START = 0.62;
const BODY_INTERACTIVE_START = 0.84;

type ToastRenderType = ToastType | 'default';

interface ToastBlobLayout {
  clipInset: number;
  contentWidth: number;
  height: number;
  maxHeight: number;
  path: string;
  progress: number;
  viewBox: string;
  width: number;
}

interface ToastMeasure {
  bodyHeight: number;
  bodyWidth: number;
  pillWidth: number;
}

function morphPath(pw: number, bw: number, th: number, t: number): string {
  const pr = PILL_HEIGHT / 2;
  const pillW = Math.min(pw, bw);

  if (t <= 0 || th - PILL_HEIGHT < 8) {
    return [
      `M 0,${pr}`,
      `A ${pr},${pr} 0 0 1 ${pr},0`,
      `H ${pillW - pr}`,
      `A ${pr},${pr} 0 0 1 ${pillW},${pr}`,
      `A ${pr},${pr} 0 0 1 ${pillW - pr},${PILL_HEIGHT}`,
      `H ${pr}`,
      `A ${pr},${pr} 0 0 1 0,${pr}`,
      'Z'
    ].join(' ');
  }

  const bodyH = th;
  const curve = 14 * Math.min(t, 1);
  const cornerRadius = Math.min(16, (bodyH - PILL_HEIGHT) * 0.45);
  const bodyW = bw;
  const bodyTop = PILL_HEIGHT - curve;
  const curveEndX = Math.min(pillW + curve, bodyW - cornerRadius);

  return [
    `M 0,${pr}`,
    `A ${pr},${pr} 0 0 1 ${pr},0`,
    `H ${pillW - pr}`,
    `A ${pr},${pr} 0 0 1 ${pillW},${pr}`,
    `L ${pillW},${bodyTop}`,
    `Q ${pillW},${bodyTop + curve} ${curveEndX},${bodyTop + curve}`,
    `H ${bodyW - cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bodyW},${bodyTop + curve + cornerRadius}`,
    `L ${bodyW},${bodyH - cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bodyW - cornerRadius},${bodyH}`,
    `H ${cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 0,${bodyH - cornerRadius}`,
    'Z'
  ].join(' ');
}

function morphPathRight(pw: number, bw: number, th: number, t: number): string {
  const pr = PILL_HEIGHT / 2;
  const pillW = Math.min(pw, bw);
  const pillLeft = bw - pillW;

  if (t <= 0 || th - PILL_HEIGHT < 8) {
    return [
      `M ${pillLeft},${pr}`,
      `A ${pr},${pr} 0 0 1 ${pillLeft + pr},0`,
      `H ${bw - pr}`,
      `A ${pr},${pr} 0 0 1 ${bw},${pr}`,
      `A ${pr},${pr} 0 0 1 ${bw - pr},${PILL_HEIGHT}`,
      `H ${pillLeft + pr}`,
      `A ${pr},${pr} 0 0 1 ${pillLeft},${pr}`,
      'Z'
    ].join(' ');
  }

  const bodyH = th;
  const curve = 14 * Math.min(t, 1);
  const cornerRadius = Math.min(16, (bodyH - PILL_HEIGHT) * 0.45);
  const bodyLeft = 0;
  const bodyTop = PILL_HEIGHT - curve;
  const leftCurveEnd = Math.max(bodyLeft + cornerRadius, pillLeft - curve);

  return [
    `M ${pillLeft},${pr}`,
    `A ${pr},${pr} 0 0 1 ${pillLeft + pr},0`,
    `H ${bw - pr}`,
    `A ${pr},${pr} 0 0 1 ${bw},${pr}`,
    `L ${bw},${bodyH - cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bw - cornerRadius},${bodyH}`,
    `H ${bodyLeft + cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bodyLeft},${bodyH - cornerRadius}`,
    `L ${bodyLeft},${bodyTop + curve + cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bodyLeft + cornerRadius},${bodyTop + curve}`,
    `H ${leftCurveEnd}`,
    `Q ${pillLeft},${bodyTop + curve} ${pillLeft},${bodyTop}`,
    'Z'
  ].join(' ');
}

function morphPathCenter(pw: number, bw: number, th: number, t: number): string {
  const pr = PILL_HEIGHT / 2;
  const pillW = Math.min(pw, bw);
  const pillOffset = (bw - pillW) / 2;

  if (t <= 0 || th - PILL_HEIGHT < 8) {
    return [
      `M ${pillOffset},${pr}`,
      `A ${pr},${pr} 0 0 1 ${pillOffset + pr},0`,
      `H ${pillOffset + pillW - pr}`,
      `A ${pr},${pr} 0 0 1 ${pillOffset + pillW},${pr}`,
      `A ${pr},${pr} 0 0 1 ${pillOffset + pillW - pr},${PILL_HEIGHT}`,
      `H ${pillOffset + pr}`,
      `A ${pr},${pr} 0 0 1 ${pillOffset},${pr}`,
      'Z'
    ].join(' ');
  }

  const bodyH = th;
  const curve = 14 * Math.min(t, 1);
  const cornerRadius = Math.min(16, (bodyH - PILL_HEIGHT) * 0.45);
  const bodyTop = PILL_HEIGHT - curve;
  const bodyLeft = 0;
  const bodyRight = bw;
  const leftCurveEnd = Math.max(bodyLeft + cornerRadius, pillOffset - curve);
  const rightCurveEnd = Math.min(bodyRight - cornerRadius, pillOffset + pillW + curve);

  return [
    `M ${pillOffset},${pr}`,
    `A ${pr},${pr} 0 0 1 ${pillOffset + pr},0`,
    `H ${pillOffset + pillW - pr}`,
    `A ${pr},${pr} 0 0 1 ${pillOffset + pillW},${pr}`,
    `L ${pillOffset + pillW},${bodyTop}`,
    `Q ${pillOffset + pillW},${bodyTop + curve} ${rightCurveEnd},${bodyTop + curve}`,
    `H ${bodyRight - cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bodyRight},${bodyTop + curve + cornerRadius}`,
    `L ${bodyRight},${bodyH - cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bodyRight - cornerRadius},${bodyH}`,
    `H ${bodyLeft + cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bodyLeft},${bodyH - cornerRadius}`,
    `L ${bodyLeft},${bodyTop + curve + cornerRadius}`,
    `A ${cornerRadius},${cornerRadius} 0 0 1 ${bodyLeft + cornerRadius},${bodyTop + curve}`,
    `H ${leftCurveEnd}`,
    `Q ${pillOffset},${bodyTop + curve} ${pillOffset},${bodyTop}`,
    'Z'
  ].join(' ');
}

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [AppIconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="toast-container"
      [attr.data-position]="currentPosition()"
      [attr.data-theme]="resolvedTheme()"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        @if (getBlobLayout(toast); as layout) {
          <div
            #toastShell
            class="toast"
            [attr.data-toast-id]="toast.id"
            [attr.data-visual-type]="getVisualType(toast)"
            [class.animate-in]="!canExpand(toast)"
            [class.toast-pill-entry]="canExpand(toast)"
            [class.toast-clickable]="toast.dismissOnClick !== false"
            [class.toast-can-expand]="canExpand(toast)"
            [class.toast-body-visible]="isBodyVisible(toast)"
            [class.toast-body-interactive]="isBodyInteractive(toast)"
            (click)="onToastClick(toast, $event)"
            [attr.role]="isAssertive(toast.type) ? 'alert' : 'status'"
            [attr.aria-live]="isAssertive(toast.type) ? 'assertive' : 'polite'"
            aria-atomic="true"
            [style.width.px]="layout.width"
            [style.--toast-body-opacity]="getBodyOpacity(toast)"
          >
            @if (shouldShowCloseButton(toast)) {
              <button
                class="toast-close"
                [class.toast-close-left]="resolveCloseButtonPosition(toast) === 'top-left'"
                type="button"
                (click)="onClose(toast.id, $event)"
                aria-label="Close toast"
              >
                <i appIcon="x-lg" class="toast-close-icon" aria-hidden="true"></i>
              </button>
            }

            <svg
              class="toast-blob"
              aria-hidden="true"
              [attr.viewBox]="layout.viewBox"
              [style.width.px]="layout.width"
              [style.height.px]="layout.height"
            >
              <path class="toast-blob-path" [attr.d]="layout.path"></path>
            </svg>

            <div
              #toastContent
              class="toast-content"
              [class.toast-content-center]="isCenterPosition()"
              [class.toast-content-right]="isRightPosition()"
              [class.toast-content-expanded]="isExpandedFrame(toast)"
              [class.toast-content-compact]="!canExpand(toast)"
              [style.width.px]="layout.contentWidth"
              [style.max-height.px]="layout.maxHeight"
              [style.clip-path]="getContentClipPath(toast)"
              [style.overflow]="canExpand(toast) ? 'hidden' : null"
            >
              <div #toastHeader class="toast-header" [style.transform]="getHeaderTransform(toast)">
                <span class="toast-icon-wrap" aria-hidden="true">
                  @switch (getVisualType(toast)) {
                    @case ('success') {
                      <i appIcon="check-lg" class="toast-icon"></i>
                    }
                    @case ('error') {
                      <i appIcon="x-lg" class="toast-icon"></i>
                    }
                    @case ('danger') {
                      <i appIcon="exclamation-triangle" class="toast-icon"></i>
                    }
                    @case ('warning') {
                      <i appIcon="exclamation-triangle" class="toast-icon"></i>
                    }
                    @case ('info') {
                      <i appIcon="info-circle" class="toast-icon"></i>
                    }
                    @default {
                      <i appIcon="bell" class="toast-icon"></i>
                    }
                  }
                </span>

                <span class="toast-title">{{ getPrimaryText(toast) }}</span>

                @if (shouldShowHeaderTimestamp(toast)) {
                  <span class="toast-timestamp">{{ formatTimestamp(toast.createdAt) }}</span>
                }
              </div>

              @if (getSecondaryText(toast); as secondaryText) {
                <div class="toast-message toast-body-section">
                  <div class="toast-message-row">
                    <div class="toast-message-copy">{{ secondaryText }}</div>

                    @if (shouldShowTimestamp(toast)) {
                      <span class="toast-timestamp">{{ formatTimestamp(toast.createdAt) }}</span>
                    }
                  </div>
                </div>
              } @else if (toast.actionLabel && shouldShowTimestamp(toast)) {
                <div class="toast-meta-row toast-body-section">
                  <span class="toast-timestamp">{{ formatTimestamp(toast.createdAt) }}</span>
                </div>
              }

              @if (toast.actionLabel) {
                <div class="toast-actions toast-body-section">
                  <button class="toast-action" type="button" (click)="onAction(toast.id, $event)">
                    {{ toast.actionLabel }}
                  </button>
                </div>
              }

              @if (shouldShowProgress(toast) && (toast.duration ?? 0) > 0) {
                <div class="toast-progress toast-body-section" aria-hidden="true">
                  <span
                    class="toast-progress-bar"
                    [style.animation-duration.ms]="toast.duration"
                  ></span>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        top: calc(var(--hdrH, 36px) + 12px);
        inset-inline: 0;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 14px;
        pointer-events: none;
        padding-inline: 12px;
      }

      .toast-container[data-position='top-left'],
      .toast-container[data-position='bottom-left'] {
        align-items: flex-start;
      }

      .toast-container[data-position='top-center'],
      .toast-container[data-position='bottom-center'] {
        align-items: center;
      }

      .toast-container[data-position='bottom-left'],
      .toast-container[data-position='bottom-center'],
      .toast-container[data-position='bottom-right'] {
        top: auto;
        bottom: 16px;
      }

      .toast {
        --toast-fill: var(--app-shell-panel-bg);
        --toast-title-color: var(--app-color-text-high);
        --toast-timestamp-color: var(--app-color-text-muted);
        --toast-message-color: var(--app-color-text-body);
        --toast-action-bg: var(--app-shell-control-bg);
        --toast-action-bg-hover: var(--app-shell-control-bg-hover);
        --toast-action-bg-active: var(--app-shell-control-bg-active);
        --toast-action-color: var(--app-color-text-high);
        --toast-progress-color: var(--app-color-text-muted);
        --toast-progress-track: var(--app-color-outline);
        --toast-close-color: var(--app-color-text-body);
        --toast-close-ring: var(--app-color-primary-focus-ring);
        --toast-blob-filter: drop-shadow(0 10px 24px var(--app-color-primary-border));
        --toast-entry-start-y: -18px;
        --toast-entry-overshoot-y: 1px;
        --toast-entry-settle-y: -0.5px;

        pointer-events: auto;
        cursor: default;
        font-family: var(--app-theme-font-sans, var(--app-font-family-sans));
        position: relative;
        width: fit-content;
        transform-origin: center top;
      }

      .toast-container[data-position='top-left'] .toast,
      .toast-container[data-position='bottom-left'] .toast {
        transform-origin: left top;
      }

      .toast-container[data-position='top-center'] .toast,
      .toast-container[data-position='bottom-center'] .toast {
        transform-origin: center top;
      }

      .toast-container[data-position='top-right'] .toast,
      .toast-container[data-position='bottom-right'] .toast {
        transform-origin: right top;
      }

      .toast-container[data-position='bottom-left'] .toast,
      .toast-container[data-position='bottom-center'] .toast,
      .toast-container[data-position='bottom-right'] .toast {
        --toast-entry-start-y: 18px;
        --toast-entry-overshoot-y: -1px;
        --toast-entry-settle-y: 0.5px;
      }

      .toast-container[data-theme='light'] .toast {
        --toast-fill: var(--app-shell-panel-bg);
        --toast-title-color: var(--app-color-text-high);
        --toast-timestamp-color: var(--app-color-text-muted);
        --toast-message-color: var(--app-color-text-body);
        --toast-action-bg: var(--app-shell-control-bg);
        --toast-action-bg-hover: var(--app-shell-control-bg-hover);
        --toast-action-bg-active: var(--app-shell-control-bg-active);
        --toast-action-color: var(--app-color-text-high);
        --toast-progress-color: var(--app-color-text-muted);
        --toast-progress-track: var(--app-color-outline);
        --toast-close-color: var(--app-color-text-body);
        --toast-close-ring: var(--app-color-primary-focus-ring);
        --toast-blob-filter: drop-shadow(0 10px 24px var(--app-color-primary-border));
      }

      .toast[data-visual-type='success'] {
        --toast-title-color: var(--app-color-success-text);
        --toast-action-bg: var(--app-color-success-bg);
        --toast-action-bg-hover: var(--app-color-success-bg-strong);
        --toast-action-bg-active: var(--app-color-success-border);
        --toast-action-color: var(--app-color-success-text);
        --toast-progress-color: var(--app-color-success-text);
      }

      .toast[data-visual-type='error'] {
        --toast-title-color: var(--app-color-danger-text);
        --toast-action-bg: var(--app-color-danger-bg);
        --toast-action-bg-hover: var(--app-color-danger-bg-strong);
        --toast-action-bg-active: var(--app-color-danger-border);
        --toast-action-color: var(--app-color-danger-text);
        --toast-progress-color: var(--app-color-danger-text);
      }

      .toast[data-visual-type='danger'] {
        --toast-title-color: var(--app-color-danger-text);
        --toast-action-bg: var(--app-color-danger-bg);
        --toast-action-bg-hover: var(--app-color-danger-bg-strong);
        --toast-action-bg-active: var(--app-color-danger-border);
        --toast-action-color: var(--app-color-danger-text);
        --toast-progress-color: var(--app-color-danger-text);
      }

      .toast[data-visual-type='warning'] {
        --toast-title-color: var(--app-color-warning-text);
        --toast-action-bg: var(--app-color-warning-bg);
        --toast-action-bg-hover: var(--app-color-warning-bg-strong);
        --toast-action-bg-active: var(--app-color-warning-border);
        --toast-action-color: var(--app-color-warning-text);
        --toast-progress-color: var(--app-color-warning-text);
      }

      .toast[data-visual-type='info'] {
        --toast-title-color: var(--app-color-info-text);
        --toast-action-bg: var(--app-color-info-bg);
        --toast-action-bg-hover: var(--app-color-info-bg-strong);
        --toast-action-bg-active: var(--app-color-info-border);
        --toast-action-color: var(--app-color-info-text);
        --toast-progress-color: var(--app-color-info-text);
      }

      .toast-container[data-theme='light'] .toast[data-visual-type='success'] {
        --toast-action-bg: var(--app-color-success-bg);
        --toast-action-bg-hover: var(--app-color-success-bg-strong);
        --toast-action-bg-active: var(--app-color-success-border);
      }

      .toast-container[data-theme='light'] .toast[data-visual-type='error'],
      .toast-container[data-theme='light'] .toast[data-visual-type='danger'] {
        --toast-action-bg: var(--app-color-danger-bg);
        --toast-action-bg-hover: var(--app-color-danger-bg-strong);
        --toast-action-bg-active: var(--app-color-danger-border);
      }

      .toast-container[data-theme='light'] .toast[data-visual-type='warning'] {
        --toast-action-bg: var(--app-color-warning-bg);
        --toast-action-bg-hover: var(--app-color-warning-bg-strong);
        --toast-action-bg-active: var(--app-color-warning-border);
      }

      .toast-container[data-theme='light'] .toast[data-visual-type='info'] {
        --toast-action-bg: var(--app-color-info-bg);
        --toast-action-bg-hover: var(--app-color-info-bg-strong);
        --toast-action-bg-active: var(--app-color-info-border);
      }

      .toast-blob {
        position: absolute;
        top: 0;
        left: 0;
        overflow: visible;
        pointer-events: none;
        filter: var(--toast-blob-filter);
      }

      .toast-container[data-theme='light'] .toast-blob {
        filter: var(--toast-blob-filter);
      }

      .toast-blob-path {
        fill: var(--toast-fill);
      }

      .toast-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
      }

      .toast-content-right {
        align-items: flex-end;
      }

      .toast-content-center {
        align-items: center;
      }

      .toast-content-compact {
        padding: 7px 10px;
      }

      .toast-content-expanded {
        padding: 7px 10px 16px;
        min-width: min(300px, calc(100vw - 24px));
        max-width: min(380px, calc(100vw - 24px));
      }

      .toast-header {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: inherit;
        max-width: 100%;
        transform-origin: center top;
      }

      .toast-content-right .toast-header {
        transform-origin: right top;
      }

      .toast-content-center .toast-header {
        transform-origin: center top;
      }

      .toast-header > .toast-title,
      .toast-header > .toast-timestamp {
        min-width: 0;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }

      .toast-header > .toast-timestamp {
        margin-left: auto;
      }

      .toast-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        line-height: 0;
        color: var(--toast-title-color);
      }

      .toast-icon {
        display: block;
        width: 18px;
        height: 18px;
      }

      .toast-title {
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        white-space: nowrap;
        color: var(--toast-title-color);
        padding: 0 4px 0 2px;
      }

      .toast-timestamp {
        font-size: 11px;
        font-weight: 400;
        color: var(--toast-timestamp-color);
        white-space: nowrap;
        line-height: 1;
        padding-left: 6px;
      }

      .toast-message {
        font-size: 13px;
        font-weight: 400;
        color: var(--toast-message-color);
        line-height: 1.55;
        margin-top: 16px;
        overflow: hidden;
        text-align: left;
      }

      .toast-body-section {
        width: 100%;
        opacity: var(--toast-body-opacity, 0);
        transform: translateY(calc((1 - var(--toast-body-opacity, 0)) * -6px));
        pointer-events: none;
      }

      .toast-body-interactive .toast-body-section {
        pointer-events: auto;
      }

      .toast-message-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }

      .toast-message-copy {
        flex: 1;
        min-width: 0;
        text-align: left;
      }

      .toast-meta-row {
        margin-top: 8px;
        text-align: right;
      }

      .toast-meta-row .toast-timestamp {
        padding-left: 0;
      }

      .toast-actions {
        margin-top: 12px;
        overflow: hidden;
      }

      .toast-action {
        display: block;
        box-sizing: border-box;
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 10px 20px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        text-align: center;
        outline: none;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.15s ease;
        background: var(--toast-action-bg);
        color: var(--toast-action-color);
      }

      .toast-action:focus:not(:focus-visible) {
        outline: none;
      }

      .toast-action:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }

      .toast-action:hover {
        background: var(--toast-action-bg-hover);
      }

      .toast-action:active {
        background: var(--toast-action-bg-active);
      }

      .toast-progress {
        margin-top: 10px;
        overflow: hidden;
        border-radius: 2px;
        height: 3px;
        background: var(--toast-progress-track);
      }

      .toast-progress-bar {
        display: block;
        height: 100%;
        border-radius: 2px;
        transform-origin: left center;
        animation: toastProgress linear forwards;
        animation-play-state: running;
        background: var(--toast-progress-color);
      }

      .toast:hover .toast-progress-bar,
      .toast:focus-within .toast-progress-bar {
        animation-play-state: paused;
      }

      .toast-clickable {
        cursor: pointer;
      }

      .toast-close {
        position: absolute;
        top: 6px;
        right: -1px;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: var(--toast-fill);
        color: var(--toast-close-color);
        cursor: pointer;
        opacity: 0;
        transition:
          opacity 0.15s ease,
          transform 0.15s ease;
        pointer-events: none;
        outline: none;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 1px 4px var(--toast-close-ring);
      }

      .toast-close-left {
        left: -1px;
        right: auto;
      }

      .toast:hover .toast-close,
      .toast:focus-within .toast-close,
      .toast:active .toast-close {
        opacity: 1;
        pointer-events: auto;
      }

      .toast-close:focus,
      .toast-close:focus-visible {
        opacity: 1;
        pointer-events: auto;
        box-shadow: 0 0 0 2px var(--toast-close-ring);
      }

      .toast-close:hover {
        transform: scale(1.15);
      }

      .toast-close:active {
        transform: scale(0.95);
      }

      .toast-close-icon {
        display: block;
        width: 12px;
        height: 12px;
      }

      @keyframes toastBounceIn {
        from {
          opacity: 0;
          transform: translate3d(0, var(--toast-entry-start-y), 0) scale(0.92);
        }

        58% {
          opacity: 1;
          transform: translate3d(0, var(--toast-entry-overshoot-y), 0) scale(1.0063);
        }

        78% {
          transform: translate3d(0, var(--toast-entry-settle-y), 0) scale(0.9988);
        }

        to {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
      }

      .animate-in {
        animation: toastBounceIn 520ms cubic-bezier(0.2, 0.9, 0.22, 1.03);
      }

      @keyframes toastPillSettleIn {
        from {
          transform: translate3d(0, calc(var(--toast-entry-start-y) * 0.45), 0) scale(0.985);
        }

        62% {
          transform: translate3d(0, calc(var(--toast-entry-overshoot-y) * 0.5), 0) scale(1.004);
        }

        to {
          transform: translate3d(0, 0, 0) scale(1);
        }
      }

      .toast-pill-entry {
        animation: toastPillSettleIn 240ms cubic-bezier(0.22, 0.85, 0.28, 1);
      }

      @keyframes toastProgress {
        from {
          transform: scaleX(1);
        }

        to {
          transform: scaleX(0);
        }
      }

      body.auth-route .toast-container[data-position='top-left'],
      body.auth-route .toast-container[data-position='top-center'],
      body.auth-route .toast-container[data-position='top-right'] {
        top: 16px;
      }

      @media (max-width: 640px) {
        .toast-container[data-position='top-left'],
        .toast-container[data-position='top-center'],
        .toast-container[data-position='top-right'] {
          top: calc(var(--hdrH, 36px) + 10px);
        }

        .toast-content-expanded {
          min-width: min(300px, calc(100vw - 24px));
          max-width: calc(100vw - 24px);
        }
      }

      @media (hover: none) {
        .toast-close {
          opacity: 1;
          pointer-events: auto;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .toast,
        .toast-blob,
        .toast-content,
        .toast-header,
        .toast-body-section,
        .toast-close,
        .toast-action,
        .toast-progress-bar {
          transition: none;
          animation: none;
        }
      }
    `
  ]
})
export class ToastComponent implements OnDestroy {
  readonly toastService = inject(ToastService);
  private readonly toastMeasures = signal<Record<string, ToastMeasure>>({});
  private readonly expansionProgress = signal<Record<string, number>>({});
  private readonly documentTheme = signal<'light' | 'dark'>('dark');
  private readonly timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });

  private measurementHandle: number | null = null;
  private readonly expansionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly expansionAnimationHandles = new Map<string, ReturnType<typeof setTimeout>>();

  private readonly toastShells = viewChildren<ElementRef<HTMLElement>>('toastShell');
  private readonly toastContents = viewChildren<ElementRef<HTMLElement>>('toastContent');
  private readonly toastHeaders = viewChildren<ElementRef<HTMLElement>>('toastHeader');
  private readonly themeObserver = this.initializeThemeObserver();

  private readonly toastLifecycleEffect = effect(() => {
    const currentToasts = this.toastService.toasts();
    this.toastService.viewportConfig();
    this.queueMeasure();
    this.syncExpansionLifecycle(currentToasts);
  });

  ngOnDestroy(): void {
    this.clearExpansionTimers();
    this.clearExpansionAnimations();
    this.cancelMeasure();
    this.themeObserver?.disconnect();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }

    this.removeLatestEscapeDismissibleToast();
  }

  onToastClick(toast: Toast, event: Event): void {
    if (toast.dismissOnClick === false) {
      return;
    }

    event.stopPropagation();
    this.toastService.remove(toast.id);
  }

  onClose(toastId: string, event: Event): void {
    event.stopPropagation();
    this.toastService.remove(toastId);
  }

  onAction(toastId: string, event: Event): void {
    event.stopPropagation();
    this.toastService.triggerAction(toastId);
  }

  isAssertive(type: ToastType): boolean {
    return type === 'error' || type === 'danger';
  }

  getPrimaryText(toast: Toast): string {
    return (
      toast.title?.trim() || this.getPromotedPrimaryText(toast) || this.getFallbackTitle(toast)
    );
  }

  getSecondaryText(toast: Toast): string | null {
    const message = toast.message?.trim();
    if (!message || !toast.title?.trim()) {
      return null;
    }

    return message;
  }

  hasExpandedDetails(toast: Toast): boolean {
    return !!this.getSecondaryText(toast) || !!toast.actionLabel;
  }

  hasExpandedLayout(toast: Toast): boolean {
    return this.hasExpandedDetails(toast) || this.shouldShowProgress(toast);
  }

  canExpand(toast: Toast): boolean {
    return this.hasExpandedLayout(toast);
  }

  isExpandedFrame(toast: Toast): boolean {
    return this.canExpand(toast) && this.getExpansionProgress(toast) > 0;
  }

  getVisualType(toast: Toast): ToastRenderType {
    return toast.type;
  }

  formatTimestamp(createdAt?: number): string {
    return createdAt ? this.timeFormatter.format(createdAt) : '';
  }

  resolvedTheme(): 'light' | 'dark' {
    const configuredTheme = this.toastService.viewportConfig().theme;
    if (configuredTheme === 'light' || configuredTheme === 'dark') {
      return configuredTheme;
    }

    return this.documentTheme();
  }

  currentPosition(): ToastPosition {
    return this.toastService.viewportConfig().position;
  }

  shouldShowTimestamp(toast: Toast): boolean {
    return (
      this.toastService.viewportConfig().showTimestamp &&
      (toast.showTimestamp ?? true) &&
      !!toast.createdAt
    );
  }

  shouldShowHeaderTimestamp(toast: Toast): boolean {
    return !this.hasExpandedDetails(toast) && this.shouldShowTimestamp(toast);
  }

  shouldShowProgress(toast: Toast): boolean {
    return this.toastService.viewportConfig().showProgress && (toast.showProgress ?? true);
  }

  shouldShowCloseButton(toast: Toast): boolean {
    return (
      this.toastService.viewportConfig().showCloseButton &&
      (toast.showCloseButton ?? true) &&
      toast.dismissible !== false
    );
  }

  resolveCloseButtonPosition(toast: Toast): ToastCloseButtonPosition {
    return toast.closeButtonPosition ?? this.toastService.viewportConfig().closeButtonPosition;
  }

  isRightPosition(): boolean {
    return this.currentPosition().endsWith('right');
  }

  isCenterPosition(): boolean {
    return this.currentPosition().endsWith('center');
  }

  getContentClipPath(toast: Toast): string {
    const layout = this.getBlobLayout(toast);
    if (layout.clipInset <= 0) {
      return 'inset(0)';
    }

    if (this.isRightPosition()) {
      return `inset(0 0 0 ${layout.clipInset}px)`;
    }

    if (this.isCenterPosition()) {
      return `inset(0 ${layout.clipInset}px 0 ${layout.clipInset}px)`;
    }

    return `inset(0 ${layout.clipInset}px 0 0)`;
  }

  getHeaderTransform(toast: Toast): string | null {
    void toast;
    return null;
  }

  isBodyVisible(toast: Toast): boolean {
    return this.getExpansionProgress(toast) >= BODY_CONTENT_REVEAL_START;
  }

  isBodyInteractive(toast: Toast): boolean {
    return this.getExpansionProgress(toast) >= BODY_INTERACTIVE_START;
  }

  getBodyOpacity(toast: Toast): number {
    const progress = this.getExpansionProgress(toast);
    if (progress <= BODY_CONTENT_REVEAL_START) {
      return 0;
    }

    return Math.min(1, (progress - BODY_CONTENT_REVEAL_START) / (1 - BODY_CONTENT_REVEAL_START));
  }

  getBlobLayout(toast: Toast): ToastBlobLayout {
    const measure = this.toastMeasures()[toast.id] ?? this.buildFallbackMeasure(toast);
    const progress = this.getExpansionProgress(toast);
    const visibleWidth = measure.pillWidth + (measure.bodyWidth - measure.pillWidth) * progress;
    const height =
      PILL_HEIGHT + (Math.max(PILL_HEIGHT, measure.bodyHeight) - PILL_HEIGHT) * progress;
    const shellWidth = progress > 0 ? visibleWidth : measure.pillWidth;
    const hiddenWidth = Math.max(0, measure.bodyWidth - visibleWidth);
    const clipInset = progress > 0 ? (this.isCenterPosition() ? hiddenWidth / 2 : hiddenWidth) : 0;
    const path = this.isRightPosition()
      ? morphPathRight(measure.pillWidth, shellWidth, height, progress)
      : this.isCenterPosition()
        ? morphPathCenter(measure.pillWidth, shellWidth, height, progress)
        : morphPath(measure.pillWidth, shellWidth, height, progress);

    return {
      clipInset,
      contentWidth: this.canExpand(toast) && progress > 0 ? measure.bodyWidth : measure.pillWidth,
      height,
      maxHeight: height,
      path,
      progress,
      viewBox: `0 0 ${shellWidth} ${height}`,
      width: shellWidth
    };
  }

  private queueMeasure(): void {
    if (this.measurementHandle !== null) {
      return;
    }

    this.measurementHandle = this.schedule(() => {
      this.measurementHandle = null;
      this.measureToasts();
    });
  }

  private measureToasts(): void {
    const shells = this.toastShells();
    const contents = this.toastContents();
    const headers = this.toastHeaders();
    const nextMeasures: Record<string, ToastMeasure> = {};

    for (let index = 0; index < shells.length; index += 1) {
      const shell = shells[index]?.nativeElement;
      const content = contents[index]?.nativeElement;
      const header = headers[index]?.nativeElement;

      if (!shell || !content || !header) {
        continue;
      }

      const toastId = shell.dataset['toastId'];
      if (!toastId) {
        continue;
      }

      const toast = this.toastService.toasts().find(current => current.id === toastId);
      if (!toast) {
        continue;
      }

      const savedShellWidth = shell.style.width;
      shell.style.width = '';

      const savedContentOverflow = content.style.overflow;
      const savedContentMaxHeight = content.style.maxHeight;
      const savedContentWidth = content.style.width;
      const savedContentClipPath = content.style.clipPath;
      content.style.overflow = '';
      content.style.maxHeight = '';
      content.style.width = '';
      content.style.clipPath = '';

      const computedContent = getComputedStyle(content);
      const paddingX =
        parseFloat(computedContent.paddingLeft) + parseFloat(computedContent.paddingRight);

      const pillWidth = Math.ceil(header.offsetWidth + paddingX);
      const bodyWidth = Math.ceil(content.offsetWidth);
      const contentHeight = Math.ceil(content.offsetHeight);

      shell.style.width = savedShellWidth;
      content.style.overflow = savedContentOverflow;
      content.style.maxHeight = savedContentMaxHeight;
      content.style.width = savedContentWidth;
      content.style.clipPath = savedContentClipPath;

      nextMeasures[toastId] = {
        bodyHeight: this.canExpand(toast) ? Math.max(contentHeight, PILL_HEIGHT) : PILL_HEIGHT,
        bodyWidth: this.canExpand(toast) ? bodyWidth : pillWidth,
        pillWidth
      };
    }

    this.toastMeasures.set(nextMeasures);
  }

  private buildFallbackMeasure(toast: Toast): ToastMeasure {
    const expandable = this.canExpand(toast);
    const estimatedPillWidth = this.estimateFallbackPillWidth(toast);
    const estimatedBodyWidth = expandable
      ? Math.max(estimatedPillWidth, this.estimateFallbackBodyWidth(toast))
      : estimatedPillWidth;

    return {
      bodyHeight: expandable ? 118 : PILL_HEIGHT,
      bodyWidth: estimatedBodyWidth,
      pillWidth: estimatedPillWidth
    };
  }

  private estimateFallbackPillWidth(toast: Toast): number {
    const title = this.getPrimaryText(toast);
    const titleWidth = this.estimateSingleLineTextWidth(title, 7.1, 56);
    const timestampWidth = this.shouldShowHeaderTimestamp(toast) ? 74 : 0;
    const closeButtonAllowance = this.shouldShowCloseButton(toast) ? 10 : 0;
    const width = 10 + 18 + 8 + titleWidth + timestampWidth + closeButtonAllowance + 10;

    return Math.max(132, Math.min(width, 320));
  }

  private estimateFallbackBodyWidth(toast: Toast): number {
    const message = this.getSecondaryText(toast) ?? '';
    const title = this.getPrimaryText(toast);
    const titleWidth = this.estimateSingleLineTextWidth(title, 7.2, 112);
    const messageWidth = message ? this.estimateSingleLineTextWidth(message, 6.5, 220) : 0;
    const actionWidth = toast.actionLabel
      ? this.estimateSingleLineTextWidth(toast.actionLabel, 7.1, 108)
      : 0;
    const estimatedContentWidth = Math.max(titleWidth + 44, messageWidth + 44, actionWidth + 32);

    return Math.max(estimatedContentWidth, 300);
  }

  private estimateSingleLineTextWidth(
    text: string,
    averageCharWidth: number,
    minimum: number
  ): number {
    const normalized = text.trim();
    if (!normalized) {
      return minimum;
    }

    return Math.max(
      minimum,
      Math.ceil(
        normalized.length * averageCharWidth + Math.min(48, normalized.split(/\s+/).length * 6)
      )
    );
  }

  private schedule(callback: FrameRequestCallback): number {
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(callback);
    }

    return window.setTimeout(() => callback(performance.now()), 0);
  }

  private cancelMeasure(): void {
    if (this.measurementHandle === null) {
      return;
    }

    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.measurementHandle);
    } else {
      clearTimeout(this.measurementHandle);
    }

    this.measurementHandle = null;
  }

  private syncExpansionLifecycle(currentToasts: Toast[]): void {
    const currentIds = new Set(currentToasts.map(toast => toast.id));

    for (const toastId of Array.from(this.expansionTimers.keys())) {
      if (currentIds.has(toastId)) {
        continue;
      }

      clearTimeout(this.expansionTimers.get(toastId));
      this.expansionTimers.delete(toastId);
    }

    for (const toastId of Array.from(this.expansionAnimationHandles.keys())) {
      if (currentIds.has(toastId)) {
        continue;
      }

      this.cancelExpansionAnimation(toastId);
    }

    const nextExpansionProgress = { ...this.expansionProgress() };
    let progressChanged = false;

    for (const toastId of Object.keys(nextExpansionProgress)) {
      if (currentIds.has(toastId)) {
        continue;
      }

      delete nextExpansionProgress[toastId];
      progressChanged = true;
    }

    for (const toast of currentToasts) {
      if (!this.canExpand(toast)) {
        if (nextExpansionProgress[toast.id] != null) {
          delete nextExpansionProgress[toast.id];
          progressChanged = true;
        }
        continue;
      }

      if (nextExpansionProgress[toast.id] == null) {
        nextExpansionProgress[toast.id] = 0;
        progressChanged = true;
      }

      if (nextExpansionProgress[toast.id] >= 1 || this.expansionTimers.has(toast.id)) {
        continue;
      }

      const timer = setTimeout(() => {
        this.expansionTimers.delete(toast.id);
        this.startExpansionAnimation(toast.id);
      }, BODY_REVEAL_DELAY_MS);
      this.expansionTimers.set(toast.id, timer);
    }

    if (progressChanged) {
      this.expansionProgress.set(nextExpansionProgress);
    }
  }

  private clearExpansionTimers(): void {
    for (const timer of this.expansionTimers.values()) {
      clearTimeout(timer);
    }

    this.expansionTimers.clear();
  }

  private getExpansionProgress(toast: Toast): number {
    if (!this.canExpand(toast)) {
      return 1;
    }

    return this.expansionProgress()[toast.id] ?? 0;
  }

  private startExpansionAnimation(toastId: string): void {
    this.cancelExpansionAnimation(toastId);

    const startTime = performance.now();
    const initialProgress = this.expansionProgress()[toastId] ?? 0;

    const step = (): void => {
      const elapsed = performance.now() - startTime;
      const raw = Math.min(1, elapsed / BODY_MORPH_DURATION_MS);
      const eased = 1 - Math.pow(1 - raw, 3);
      const nextProgress = initialProgress + (1 - initialProgress) * eased;

      this.expansionProgress.update(current => ({
        ...current,
        [toastId]: nextProgress
      }));

      if (raw >= 1) {
        this.expansionAnimationHandles.delete(toastId);
        return;
      }

      const handle = setTimeout(step, 16);
      this.expansionAnimationHandles.set(toastId, handle);
    };

    const handle = setTimeout(step, 16);
    this.expansionAnimationHandles.set(toastId, handle);
  }

  private cancelExpansionAnimation(toastId: string): void {
    const handle = this.expansionAnimationHandles.get(toastId);
    if (!handle) {
      return;
    }

    clearTimeout(handle);
    this.expansionAnimationHandles.delete(toastId);
  }

  private clearExpansionAnimations(): void {
    for (const handle of this.expansionAnimationHandles.values()) {
      clearTimeout(handle);
    }

    this.expansionAnimationHandles.clear();
  }

  private initializeThemeObserver(): MutationObserver | null {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return null;
    }

    this.syncDocumentTheme();

    const observer = new MutationObserver(() => {
      this.syncDocumentTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return observer;
  }

  private syncDocumentTheme(): void {
    if (typeof document === 'undefined') {
      this.documentTheme.set('dark');
      return;
    }

    this.documentTheme.set(
      document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
    );
  }

  private shouldCloseOnEscape(toast: Toast): boolean {
    return this.toastService.viewportConfig().closeOnEscape && (toast.closeOnEscape ?? true);
  }

  private getPromotedPrimaryText(toast: Toast): string | null {
    const message = toast.message?.trim();
    return message || null;
  }

  private removeLatestEscapeDismissibleToast(): void {
    const dismissibleToast = [...this.toastService.toasts()]
      .reverse()
      .find(toast => toast.dismissible !== false && this.shouldCloseOnEscape(toast));

    if (!dismissibleToast) {
      return;
    }

    this.toastService.remove(dismissibleToast.id);
  }

  private getFallbackTitle(toast: Toast): string {
    switch (toast.type) {
      case 'success':
        return 'Success';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Info';
      case 'danger':
      case 'error':
      default:
        return 'Error';
    }
  }
}
