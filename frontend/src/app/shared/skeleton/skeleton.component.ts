import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Skeleton Loader Component
 * مكون هيكل التحميل
 *
 * Displays loading placeholder skeletons for better UX
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="skeleton"
      [class.skeleton-circle]="type === 'circle'"
      [class.skeleton-rect]="type === 'rect'"
      [class.skeleton-text]="type === 'text'"
      [style.width]="width"
      [style.height]="height"
      [attr.aria-busy]="true"
      [attr.aria-label]="'Loading ' + type"
    ></div>
  `,
  styles: [
    `
      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 20%, #f0f0f0 40%, #f0f0f0 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 4px;
      }

      .skeleton-circle {
        border-radius: 50%;
      }

      .skeleton-rect {
        border-radius: 4px;
      }

      .skeleton-text {
        height: 1em;
        margin-bottom: 0.5em;
        border-radius: 2px;
      }

      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .skeleton {
          background: linear-gradient(90deg, #2a2a2a 0%, #333333 20%, #2a2a2a 40%, #2a2a2a 100%);
        }
      }

      [data-theme='dark'] .skeleton {
        background: linear-gradient(90deg, #2a2a2a 0%, #333333 20%, #2a2a2a 40%, #2a2a2a 100%);
      }
    `
  ]
})
export class SkeletonComponent {
  @Input() type: 'text' | 'circle' | 'rect' = 'text';
  @Input() width = '100%';
  @Input() height = '20px';
}

/**
 * Table Skeleton Component
 * هيكل جدول التحميل
 */
@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="table-skeleton" role="status" aria-label="Loading table">
      <!-- Header -->
      <div class="skeleton-row header">
        <app-skeleton
          *ngFor="let col of columns"
          type="rect"
          [width]="col.width || '100%'"
          height="40px"
        >
        </app-skeleton>
      </div>

      <!-- Rows -->
      <div class="skeleton-row" *ngFor="let row of rows">
        <app-skeleton
          *ngFor="let col of columns"
          type="rect"
          [width]="col.width || '100%'"
          height="48px"
        >
        </app-skeleton>
      </div>
    </div>
  `,
  styles: [
    `
      .table-skeleton {
        width: 100%;
        padding: 1rem;
      }

      .skeleton-row {
        display: grid;
        gap: 1rem;
        margin-bottom: 0.5rem;
        padding: 0.5rem;
      }

      .skeleton-row.header {
        margin-bottom: 1rem;
      }
    `
  ]
})
export class TableSkeletonComponent {
  @Input() columns: Array<{ header?: string; width?: string }> = [
    { header: '', width: '25%' },
    { header: '', width: '25%' },
    { header: '', width: '25%' },
    { header: '', width: '25%' }
  ];

  @Input('rows') rowCount = 5;

  get rows(): number[] {
    return Array(this.rowCount)
      .fill(0)
      .map((_, i) => i);
  }
}

/**
 * Card Skeleton Component
 * هيكل بطاقة التحميل
 */
@Component({
  selector: 'app-card-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="card-skeleton" role="status" aria-label="Loading card">
      <app-skeleton type="rect" width="100%" height="200px"></app-skeleton>
      <div class="card-content">
        <app-skeleton type="text" width="60%"></app-skeleton>
        <app-skeleton type="text" width="80%"></app-skeleton>
        <app-skeleton type="text" width="40%"></app-skeleton>
      </div>
    </div>
  `,
  styles: [
    `
      .card-skeleton {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        background: white;
      }

      .card-content {
        padding: 1rem;
      }

      [data-theme='dark'] .card-skeleton {
        border-color: #333;
        background: #1a1a1a;
      }
    `
  ]
})
export class CardSkeletonComponent {}

/**
 * List Skeleton Component
 * هيكل قائمة التحميل
 */
@Component({
  selector: 'app-list-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="list-skeleton" role="status" aria-label="Loading list">
      <div class="list-item" *ngFor="let item of items">
        <app-skeleton type="circle" width="48px" height="48px"></app-skeleton>
        <div class="list-content">
          <app-skeleton type="text" width="70%"></app-skeleton>
          <app-skeleton type="text" width="50%"></app-skeleton>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .list-skeleton {
        width: 100%;
      }

      .list-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        border-bottom: 1px solid #e0e0e0;
      }

      .list-item:last-child {
        border-bottom: none;
      }

      .list-content {
        flex: 1;
      }

      [data-theme='dark'] .list-item {
        border-bottom-color: #333;
      }
    `
  ]
})
export class ListSkeletonComponent {
  @Input() count = 5;

  get items(): number[] {
    return Array(this.count)
      .fill(0)
      .map((_, i) => i);
  }
}
