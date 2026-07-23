import { Component, Input } from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

@Component({
  selector: 'tender-page-header',
  standalone: true,
  imports: [AppIconDirective],
  template: `
    <header class="ph" [class.fused]="fused">
      <div class="ph__titles">
        <div class="ph__title-row">
          @if (icon) {
            <i [appIcon]="icon" class="ph__icon" aria-hidden="true"></i>
          }
          <h1 class="ph__title">{{ title }}</h1>
        </div>
        @if (sub) {
          <p class="ph__sub">{{ sub }}</p>
        }
      </div>
      <ng-content select="[actions]"></ng-content>
    </header>
  `,
  styles: [
    `
      .ph {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-radius: 14px;
        background: rgb(var(--surface));
        border: 1px solid rgb(var(--border) / 0.6);
        box-shadow: 0 4px 14px rgb(0 0 0 / 0.12);
        margin-bottom: 12px;
        position: sticky;
        top: 0;
        z-index: 5;
      }
      .ph__title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ph__title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: rgb(var(--fg));
      }
      .ph__icon {
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        border: 1px solid rgb(var(--border) / 0.6);
        background: rgb(var(--bg1));
        color: rgb(var(--primary));
        font-size: 14px;
        flex: 0 0 24px;
      }
      .ph__sub {
        margin: 2px 0 0;
        font-size: 12px;
        color: rgb(var(--fg) / 0.7);
      }

      .ph.fused {
        margin-bottom: 0;
        border-bottom: 0;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        box-shadow: none;
        position: relative;
        top: auto;
      }
    `
  ]
})
export class TenderPageHeaderComponent {
  @Input() title = 'Tender';
  @Input() sub?: string;
  @Input() icon?: string;
  @Input() fused = false;
}
