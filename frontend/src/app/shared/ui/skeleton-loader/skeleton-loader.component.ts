import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Skeleton Loader Component
 *
 * مكون تحميل هيكلي يظهر أثناء تحميل البيانات
 * يوفر تجربة مستخدم أفضل من Loading Spinner التقليدي
 *
 * @example
 * ```html
 * <app-skeleton-loader type="card" [count]="3"></app-skeleton-loader>
 * <app-skeleton-loader type="table" [rows]="5"></app-skeleton-loader>
 * <app-skeleton-loader type="text" width="200px"></app-skeleton-loader>
 * ```
 */
@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skeleton-container">
      @switch (type) {
        @case ('text') {
          @for (item of items; track $index) {
            <div class="skeleton skeleton-text" [style.width]="width" [style.height]="height"></div>
          }
        }
        @case ('circle') {
          @for (item of items; track $index) {
            <div class="skeleton skeleton-circle" [style.width]="size" [style.height]="size"></div>
          }
        }
        @case ('card') {
          @for (item of items; track $index) {
            <div class="skeleton-card">
              <div class="skeleton skeleton-image"></div>
              <div class="skeleton skeleton-text" style="width: 80%; margin-top: 12px;"></div>
              <div class="skeleton skeleton-text" style="width: 60%; margin-top: 8px;"></div>
            </div>
          }
        }
        @case ('table') {
          <div class="skeleton-table">
            <div class="skeleton-table-header">
              @for (col of [1, 2, 3, 4]; track $index) {
                <div class="skeleton skeleton-text"></div>
              }
            </div>
            @for (row of items; track $index) {
              <div class="skeleton-table-row">
                @for (col of [1, 2, 3, 4]; track $index) {
                  <div class="skeleton skeleton-text"></div>
                }
              </div>
            }
          </div>
        }
        @case ('list') {
          @for (item of items; track $index) {
            <div class="skeleton-list-item">
              <div class="skeleton skeleton-circle" style="width: 40px; height: 40px;"></div>
              <div style="flex: 1; margin-left: 12px;">
                <div class="skeleton skeleton-text" style="width: 80%;"></div>
                <div class="skeleton skeleton-text" style="width: 60%; margin-top: 8px;"></div>
              </div>
            </div>
          }
        }
        @default {
          @for (item of items; track $index) {
            <div
              class="skeleton skeleton-block"
              [style.width]="width"
              [style.height]="height"
            ></div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .skeleton-container {
        padding: 16px;
      }

      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 4px;
        margin-bottom: 12px;
      }

      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      .skeleton-text {
        height: 16px;
        width: 100%;
      }

      .skeleton-circle {
        border-radius: 50%;
      }

      .skeleton-block {
        width: 100%;
        height: 100px;
      }

      .skeleton-image {
        width: 100%;
        height: 200px;
      }

      .skeleton-card {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .skeleton-table {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }

      .skeleton-table-header {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        padding: 16px;
        background: #f9f9f9;
        border-bottom: 1px solid #e0e0e0;
      }

      .skeleton-table-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        padding: 16px;
        border-bottom: 1px solid #f0f0f0;
      }

      .skeleton-table-row:last-child {
        border-bottom: none;
      }

      .skeleton-list-item {
        display: flex;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid #f0f0f0;
      }

      .skeleton-list-item:last-child {
        border-bottom: none;
      }

      /* RTL Support */
      [dir='rtl'] .skeleton-list-item > div:last-child {
        margin-left: 0;
        margin-right: 12px;
      }
    `
  ]
})
export class SkeletonLoaderComponent {
  @Input() type: 'text' | 'circle' | 'card' | 'table' | 'list' | 'block' = 'text';
  @Input() count: number = 1;
  @Input() rows: number = 5; // للجداول
  @Input() width: string = '100%';
  @Input() height: string = '20px';
  @Input() size: string = '40px'; // للدوائر

  get items(): number[] {
    const itemCount = this.type === 'table' ? this.rows : this.count;
    return Array(itemCount).fill(0);
  }
}
