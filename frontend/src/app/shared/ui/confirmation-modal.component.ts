import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="isOpen" class="modal-backdrop" (click)="onBackdropClick($event)">
      <div
        class="modal-content"
        [style.max-width]="width"
        [ngClass]="customClass"
        (click)="$event.stopPropagation()"
      >
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      }
      .modal-content {
        background: rgb(var(--surface));
        border-radius: 12px;
        width: 100%;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        animation: modalEnter 0.2s ease-out;
      }
      @keyframes modalEnter {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
    `
  ]
})
export class ConfirmationModalComponent {
  @Input() isOpen = false;
  @Input() width = '500px';
  @Input() customClass = '';
  @Output() close = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent): void {
    this.close.emit();
  }
}
