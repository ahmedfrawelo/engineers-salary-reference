import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { DeleteProtectionDialogService } from '../../core/security/delete-protection-dialog.service';
import { OverlayPanelComponent } from './overlay-panel.component';

@Component({
  selector: 'app-delete-code-dialog',
  standalone: true,
  imports: [CommonModule, OverlayPanelComponent, AppIconDirective],
  template: `
    <overlay-panel
      [open]="!!request()"
      [variant]="'dialog'"
      [title]="request()?.title ?? 'Delete Security Check'"
      [subtitle]="request()?.subtitle ?? 'Protected action'"
      [panelClass]="'delete-code-overlay'"
      [draggable]="false"
      [showSave]="false"
      [showDelete]="false"
      [closeDanger]="false"
      [backdropBlur]="2"
      [backdropTint]="0"
      [maxWidth]="540"
      [maxHeight]="460"
      [fitRatioWDesktop]="0.42"
      [fitRatioHDesktop]="0.44"
      [fitRatioWMobile]="0.94"
      [fitRatioHMobile]="0.56"
      [bodyPadding]="0"
      [hotkeyEnterSaves]="false"
      (closed)="cancel()"
    >
      @if (request(); as req) {
        <div class="delete-code-dialog" (keydown.escape)="cancel()">
          <div class="delete-code-dialog__hero">
            <div class="delete-code-dialog__icon" aria-hidden="true">
              <i appIcon="shield-lock"></i>
            </div>
            <div class="delete-code-dialog__copy">
              <p class="delete-code-dialog__lead">{{ req.message }}</p>
              <p class="delete-code-dialog__note">
                This delete action is locked until the authorized code is entered.
              </p>
            </div>
          </div>

          <label class="delete-code-dialog__field">
            <span class="delete-code-dialog__label">Authorization Code</span>
            <input
              #codeInput
              class="delete-code-dialog__input"
              type="password"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              autofocus
              [value]="code()"
              [placeholder]="req.placeholder"
              (input)="onInput($event)"
              (keydown.enter)="submit()"
            />
          </label>

          @if (error()) {
            <div class="delete-code-dialog__error" role="alert">
              <i appIcon="exclamation-triangle"></i>
              <span>{{ error() }}</span>
            </div>
          }

          <div class="delete-code-dialog__actions">
            <button type="button" class="btn delete-code-dialog__btn ghost" (click)="cancel()">
              {{ req.cancelLabel }}
            </button>
            <button type="button" class="btn delete-code-dialog__btn primary" (click)="submit()">
              <i appIcon="unlock"></i>
              <span>{{ req.confirmLabel }}</span>
            </button>
          </div>
        </div>
      }
    </overlay-panel>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      :host ::ng-deep .delete-code-overlay .modal-hdr {
        background:
          linear-gradient(135deg, rgba(0, 196, 180, 0.08), rgba(0, 0, 0, 0)),
          linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0));
        border-bottom: 1px solid rgba(0, 196, 180, 0.16);
      }

      :host ::ng-deep .delete-code-overlay .ttl .title {
        font-weight: 800;
        letter-spacing: 0.02em;
      }

      :host ::ng-deep .delete-code-overlay .ttl .subtitle {
        opacity: 0.8;
      }

      :host ::ng-deep .delete-code-overlay .body {
        background:
          radial-gradient(circle at top right, rgba(0, 196, 180, 0.08), transparent 42%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.01), rgba(255, 255, 255, 0));
      }

      .delete-code-dialog {
        display: grid;
        gap: 16px;
        padding: 20px;
      }

      .delete-code-dialog__hero {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px;
        align-items: start;
        padding: 14px;
        border: 1px solid rgba(0, 196, 180, 0.14);
        border-radius: 16px;
        background: rgba(0, 196, 180, 0.06);
      }

      .delete-code-dialog__icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        font-size: 18px;
        color: rgb(var(--brand-rgb, 0 196 180));
        background: rgba(0, 196, 180, 0.12);
        border: 1px solid rgba(0, 196, 180, 0.18);
      }

      .delete-code-dialog__copy {
        display: grid;
        gap: 6px;
      }

      .delete-code-dialog__lead,
      .delete-code-dialog__note {
        margin: 0;
      }

      .delete-code-dialog__lead {
        font-size: 14px;
        line-height: 1.55;
        font-weight: 600;
      }

      .delete-code-dialog__note {
        font-size: 12px;
        line-height: 1.5;
        opacity: 0.8;
      }

      .delete-code-dialog__field {
        display: grid;
        gap: 8px;
      }

      .delete-code-dialog__label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        opacity: 0.76;
      }

      .delete-code-dialog__input {
        width: 100%;
        min-height: 48px;
        padding: 0 14px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(10, 14, 20, 0.72);
        color: rgb(var(--fg));
        outline: none;
        transition:
          border-color 0.16s ease,
          box-shadow 0.16s ease,
          background-color 0.16s ease;
      }

      .delete-code-dialog__input:focus {
        border-color: rgba(0, 196, 180, 0.5);
        box-shadow: 0 0 0 4px rgba(0, 196, 180, 0.12);
        background: rgba(10, 14, 20, 0.88);
      }

      .delete-code-dialog__error {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 10px;
        align-items: start;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(255, 101, 101, 0.2);
        background: rgba(255, 101, 101, 0.08);
        color: #ffb3b3;
        font-size: 13px;
        line-height: 1.45;
      }

      .delete-code-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }

      .delete-code-dialog__btn {
        min-width: 140px;
        min-height: 44px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-weight: 700;
      }

      .delete-code-dialog__btn.ghost {
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
      }

      .delete-code-dialog__btn.primary {
        border: 1px solid rgba(0, 196, 180, 0.34);
        background: linear-gradient(135deg, rgba(0, 196, 180, 0.24), rgba(0, 196, 180, 0.12));
        color: rgb(var(--fg));
      }

      .delete-code-dialog__btn.primary:hover:not(:disabled) {
        border-color: rgba(0, 196, 180, 0.5);
        background: linear-gradient(135deg, rgba(0, 196, 180, 0.32), rgba(0, 196, 180, 0.18));
      }

      @media (max-width: 640px) {
        .delete-code-dialog {
          padding: 16px;
        }

        .delete-code-dialog__hero {
          grid-template-columns: 1fr;
        }

        .delete-code-dialog__actions {
          flex-direction: column-reverse;
        }

        .delete-code-dialog__btn {
          width: 100%;
        }
      }
    `
  ]
})
export class DeleteCodeDialogComponent {
  @ViewChild('codeInput', { read: ElementRef }) private codeInputRef?: ElementRef<HTMLInputElement>;

  private readonly dialog = inject(DeleteProtectionDialogService);
  readonly request = this.dialog.activeRequest;

  readonly code = signal('');
  readonly error = signal('');

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.code.set(value);

    if (this.error()) {
      this.error.set('');
    }
  }

  submit(): void {
    const request = this.request();
    if (!request) {
      return;
    }

    const code = this.code().trim();
    if (!code) {
      this.error.set(request.requiredMessage);
      this.focusField(true);
      return;
    }

    this.reset();
    this.dialog.submit(code);
  }

  cancel(): void {
    this.reset();
    this.dialog.cancel();
  }

  private reset(): void {
    this.code.set('');
    this.error.set('');
  }

  private focusField(select = false): void {
    const input = this.codeInputRef?.nativeElement;
    if (!input) {
      return;
    }

    input.focus();
    if (select) {
      input.select();
    }
  }
}
