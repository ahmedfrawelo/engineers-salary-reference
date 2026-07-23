import { Component, Input } from '@angular/core';

/**
 * ✨ Grid Skeleton Loader Component
 *
 * Displays animated skeleton placeholders while data is loading.
 * Provides better UX than a simple spinner.
 *
 * @example
 * <grid-skeleton-loader [columns]="5" [rows]="10"></grid-skeleton-loader>
 */
@Component({
  selector: 'grid-skeleton-loader',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
  template: `
    <div class="skeleton-grid" role="status" aria-label="Loading data">
      <!-- Header skeleton -->
      <div class="skeleton-header">
        @for (col of columnArray; track col) {
          <div class="skeleton-cell header">
            <div class="skeleton-shimmer"></div>
          </div>
        }
      </div>

      <!-- Body skeleton -->
      <div class="skeleton-body">
        @for (row of rowArray; track row) {
          <div class="skeleton-row">
            @for (col of columnArray; track col) {
              <div class="skeleton-cell">
                <div class="skeleton-shimmer"></div>
              </div>
            }
          </div>
        }
      </div>

      <span class="sr-only">Loading table data, please wait...</span>
    </div>
  `,
  styles: [
    `
      .skeleton-grid {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 1px;
        background: rgb(var(--bg0, 255 255 255));
        padding: 0;
        overflow: hidden;
      }

      .skeleton-header {
        display: flex;
        gap: 1px;
        background: rgb(var(--bg1, 245 245 245));
        padding: 8px;
        border-bottom: 1px solid rgb(var(--border, 230 230 230) / 0.5);
      }

      .skeleton-body {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
        overflow: hidden;
      }

      .skeleton-row {
        display: flex;
        gap: 1px;
        padding: 8px;
        background: transparent;
      }

      .skeleton-cell {
        flex: 1;
        min-width: 80px;
        height: 36px;
        border-radius: 6px;
        overflow: hidden;
        background: rgb(var(--surface, 250 250 250) / 0.5);
        position: relative;
      }

      .skeleton-cell.header {
        height: 32px;
        background: rgb(var(--bg1, 245 245 245));
      }

      .skeleton-shimmer {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(var(--fg, 0 0 0), 0.04) 20%,
          rgba(var(--fg, 0 0 0), 0.08) 50%,
          rgba(var(--fg, 0 0 0), 0.04) 80%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: shimmer 2s ease-in-out infinite;
      }

      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      /* Accessibility */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .skeleton-cell {
          background: rgb(var(--surface, 30 30 30) / 0.5);
        }

        .skeleton-cell.header {
          background: rgb(var(--bg1, 20 20 20));
        }

        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(var(--fg, 255 255 255), 0.06) 20%,
            rgba(var(--fg, 255 255 255), 0.12) 50%,
            rgba(var(--fg, 255 255 255), 0.06) 80%,
            transparent 100%
          );
          background-size: 200% 100%;
        }
      }

      /* Stagger animation for rows */
      .skeleton-row:nth-child(1) .skeleton-shimmer {
        animation-delay: 0s;
      }
      .skeleton-row:nth-child(2) .skeleton-shimmer {
        animation-delay: 0.1s;
      }
      .skeleton-row:nth-child(3) .skeleton-shimmer {
        animation-delay: 0.2s;
      }
      .skeleton-row:nth-child(4) .skeleton-shimmer {
        animation-delay: 0.3s;
      }
      .skeleton-row:nth-child(5) .skeleton-shimmer {
        animation-delay: 0.4s;
      }
    `
  ]
})
export class GridSkeletonLoaderComponent {
  private _columns = 5;
  @Input()
  set columns(value: number | null | undefined) {
    this._columns = value ?? 5;
  }
  get columns(): number {
    return this._columns;
  }

  private _rows = 8;
  @Input()
  set rows(value: number | null | undefined) {
    this._rows = value ?? 8;
  }
  get rows(): number {
    return this._rows;
  }

  get columnArray(): number[] {
    return Array(this.columns).fill(0);
  }

  get rowArray(): number[] {
    return Array(this.rows).fill(0);
  }
}
