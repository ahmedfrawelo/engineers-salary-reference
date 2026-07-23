import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { OverlayPanelComponent } from './overlay-panel.component';

export type TextPromptDialogField = {
  key: string;
  label: string;
  value?: string | null;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  readonly?: boolean;
  multiline?: boolean;
  rows?: number;
  codeStyle?: boolean;
  autocomplete?: string;
};

@Component({
  selector: 'app-text-prompt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayPanelComponent],
  template: `
    <overlay-panel
      [open]="open"
      [title]="title"
      [subtitle]="subtitle"
      [variant]="'dialog'"
      [panelClass]="'text-prompt-dialog'"
      [maxWidth]="maxWidth"
      [minWidth]="minWidth"
      [maxHeight]="maxHeight"
      [minHeight]="minHeight"
      [fitRatioWDesktop]="0"
      [fitRatioHDesktop]="0"
      [dense]="false"
      [bodyPadding]="0"
      [autoFitContent]="true"
      (closed)="busy ? null : close.emit()"
    >
      <form class="tpd-shell" (ngSubmit)="submitDialog()">
        @if (description) {
          <p class="tpd-description">{{ description }}</p>
        }

        <div class="tpd-fields">
          @for (field of fields; track field.key) {
            <label class="tpd-field">
              <span class="tpd-label">
                {{ field.label }}
                @if (field.required) {
                  <span class="tpd-required">*</span>
                }
              </span>

              @if (field.multiline) {
                <textarea
                  #fieldControl
                  class="tpd-control tpd-control-textarea"
                  [class.tpd-control-code]="field.codeStyle"
                  [value]="getValue(field.key)"
                  [attr.placeholder]="field.placeholder || null"
                  [attr.rows]="resolveRows(field)"
                  [attr.readonly]="field.readonly ? true : null"
                  [attr.autocomplete]="field.autocomplete || 'off'"
                  [spellcheck]="!field.codeStyle"
                  (input)="onFieldInput(field.key, $event)"
                ></textarea>
              } @else {
                <input
                  #fieldControl
                  class="tpd-control"
                  [class.tpd-control-code]="field.codeStyle"
                  type="text"
                  [value]="getValue(field.key)"
                  [attr.placeholder]="field.placeholder || null"
                  [attr.readonly]="field.readonly ? true : null"
                  [attr.autocomplete]="field.autocomplete || 'off'"
                  [spellcheck]="false"
                  (input)="onFieldInput(field.key, $event)"
                />
              }

              @if (field.helperText) {
                <span class="tpd-helper">{{ field.helperText }}</span>
              }
            </label>
          }
        </div>

        <div class="tpd-actions">
          <button
            type="button"
            class="tpd-btn tpd-btn-secondary"
            [disabled]="busy"
            (click)="close.emit()"
          >
            {{ showSubmitButton ? cancelLabel : closeLabel }}
          </button>

          @if (showSubmitButton) {
            <button type="submit" class="tpd-btn tpd-btn-primary" [disabled]="busy || !canSubmit">
              {{ submitLabel }}
            </button>
          }
        </div>
      </form>
    </overlay-panel>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .tpd-shell {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 18px;
      }

      .tpd-description {
        margin: 0;
        color: rgba(var(--fg), 0.72);
        font-size: 13px;
        line-height: 1.6;
      }

      .tpd-fields {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .tpd-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tpd-label {
        color: rgb(var(--fg));
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .tpd-required {
        color: rgb(var(--danger, 220 38 38));
      }

      .tpd-control {
        width: 100%;
        min-height: 44px;
        border: 1px solid rgba(var(--border), 0.72);
        border-radius: 14px;
        background: rgba(var(--bg1), 0.82);
        color: rgb(var(--fg));
        padding: 0 14px;
        font-size: 13px;
        line-height: 1.5;
        transition:
          border-color 140ms ease,
          box-shadow 140ms ease,
          background 140ms ease;
        box-sizing: border-box;
      }

      .tpd-control:focus {
        outline: none;
        border-color: rgba(var(--primary), 0.7);
        box-shadow: 0 0 0 3px rgba(var(--primary), 0.14);
        background: rgba(var(--bg1), 0.96);
      }

      .tpd-control[readonly] {
        background: rgba(var(--bg0), 0.72);
        color: rgba(var(--fg), 0.78);
      }

      .tpd-control-textarea {
        min-height: 140px;
        padding: 12px 14px;
        resize: vertical;
      }

      .tpd-control-code {
        font-family: 'Cascadia Code', 'Consolas', monospace;
        font-size: 12.5px;
      }

      .tpd-helper {
        color: rgba(var(--fg), 0.56);
        font-size: 12px;
        line-height: 1.5;
      }

      .tpd-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
      }

      .tpd-btn {
        min-height: 42px;
        padding: 0 16px;
        border-radius: 12px;
        border: 1px solid transparent;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition:
          transform 120ms ease,
          filter 120ms ease,
          border-color 120ms ease;
      }

      .tpd-btn:disabled {
        opacity: 0.56;
        cursor: default;
        transform: none;
      }

      .tpd-btn:not(:disabled):hover {
        filter: brightness(1.03);
      }

      .tpd-btn-secondary {
        border-color: rgba(var(--border), 0.72);
        background: rgba(var(--bg0), 0.72);
        color: rgb(var(--fg));
      }

      .tpd-btn-primary {
        background: rgba(var(--primary), 0.92);
        color: rgb(var(--primary-contrast, 255 255 255));
      }
    `
  ]
})
export class TextPromptDialogComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() open = false;
  @Input() title = 'Edit';
  @Input() subtitle = '';
  @Input() description = '';
  @Input() submitLabel = 'Save';
  @Input() cancelLabel = 'Cancel';
  @Input() closeLabel = 'Close';
  @Input() busy = false;
  @Input() minWidth = 420;
  @Input() maxWidth = 560;
  @Input() minHeight = 180;
  @Input() maxHeight = 720;
  @Input() fields: ReadonlyArray<TextPromptDialogField> = [];

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<Record<string, string>>();

  @ViewChildren('fieldControl')
  private fieldControls?: QueryList<ElementRef<HTMLInputElement | HTMLTextAreaElement>>;

  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private values: Record<string, string> = {};

  ngAfterViewInit(): void {
    if (this.open) {
      this.scheduleFocus();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields'] || changes['open']) {
      this.values = this.buildValues();
    }
    if (changes['open']?.currentValue) {
      this.scheduleFocus();
    } else if (changes['open']) {
      this.clearFocusTimer();
    }
  }

  ngOnDestroy(): void {
    this.clearFocusTimer();
  }

  get showSubmitButton(): boolean {
    return this.fields.some(field => !field.readonly);
  }

  get canSubmit(): boolean {
    const editableFields = this.fields.filter(field => !field.readonly);
    if (!editableFields.length) {
      return false;
    }
    return editableFields.every(
      field => !field.required || this.getValue(field.key).trim().length > 0
    );
  }

  getValue(key: string): string {
    return this.values[key] ?? '';
  }

  resolveRows(field: TextPromptDialogField): number {
    return Math.max(4, field.rows ?? 8);
  }

  onFieldInput(key: string, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    this.values = {
      ...this.values,
      [key]: input?.value ?? ''
    };
  }

  submitDialog(): void {
    if (!this.canSubmit || this.busy) {
      return;
    }
    this.submit.emit({ ...this.values });
  }

  private buildValues(): Record<string, string> {
    return this.fields.reduce<Record<string, string>>((acc, field) => {
      acc[field.key] = String(field.value ?? '');
      return acc;
    }, {});
  }

  private scheduleFocus(): void {
    this.clearFocusTimer();
    this.focusTimer = setTimeout(() => {
      const target = this.fieldControls
        ?.toArray()
        .map(ref => ref.nativeElement)
        .find(control => !control.readOnly);
      if (!target) {
        return;
      }
      target.focus();
      if (typeof target.select === 'function') {
        target.select();
      }
    }, 30);
  }

  private clearFocusTimer(): void {
    if (!this.focusTimer) {
      return;
    }
    clearTimeout(this.focusTimer);
    this.focusTimer = null;
  }
}
