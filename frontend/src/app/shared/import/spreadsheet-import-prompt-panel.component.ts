import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Upload01Icon } from '@shared/icons/app-icon.registry';
import { OverlayPanelComponent } from '@shared/ui/overlay-panel.component';
import { SPREADSHEET_IMPORT_EXTENSIONS } from './spreadsheet-import.service';

type LooseValue = ReturnType<typeof JSON.parse>;
type RecentFile = { key: string; file: File };

@Component({
  selector: 'spreadsheet-import-prompt-panel',
  standalone: true,
  imports: [OverlayPanelComponent, HugeiconsIconComponent],
  template: `
    <overlay-panel
      [open]="open"
      [title]="loading ? loadingTitle : title"
      [subtitle]="loading ? loadingSubtitle : subtitle"
      [variant]="'dialog'"
      [panelClass]="panelCssClass"
      [maxWidth]="520"
      [minWidth]="420"
      [maxHeight]="loading ? 260 : 320 + recentBoxH"
      [minHeight]="loading ? 220 : 240"
      [fitRatioWDesktop]="0"
      [fitRatioHDesktop]="0"
      [bodyPadding]="0"
      [autoFitContent]="false"
      [backdropBlur]="0"
      [backdropSaturate]="1"
      [backdropBrightness]="1"
      [geometryMode]="'viewport'"
      (closed)="loading || finalizing ? null : close.emit()"
    >
      @if (!loading) {
        <div class="prompt-shell">
          <label class="file-cta" [class.disabled]="disabled" (click)="resetPicker()">
            <input
              #picker
              type="file"
              [attr.accept]="accept"
              (change)="onFile($event)"
              [disabled]="disabled"
            />
            <hugeicons-icon
              [icon]="uploadFileIcon"
              [size]="18"
              [strokeWidth]="2"
              aria-hidden="true"
            ></hugeicons-icon>
            <span>{{ recent.length ? replaceFileLabel : chooseFileLabel }}</span>
          </label>

          <p class="hint">Supported: {{ supportedFormatsLabel }}</p>

          @if (showTemplateAction) {
            <button type="button" class="template-cta" (click)="templateRequested.emit()">
              {{ templateLabel }}
            </button>
          }

          @if (recent.length) {
            <section #recentBox class="recent-panel">
              <strong>Recent files</strong>
              <div class="recent-list">
                @for (recentFile of recent; track recentFile.key) {
                  <button
                    type="button"
                    class="recent-file"
                    (click)="onReimportClick(recentFile.file)"
                  >
                    <span>{{ recentFile.file.name }}</span>
                    <small>{{ formatBytes(recentFile.file.size) }}</small>
                  </button>
                }
              </div>
            </section>
          }
        </div>
      }

      @if (loading) {
        <div class="loading-shell" aria-live="polite">
          <div class="spinner" role="status" aria-label="Loading"></div>
          <strong>{{ loadingBody }}</strong>
        </div>
      }
    </overlay-panel>
  `,
  styles: [
    `
      :host {
        display: block;
        position: fixed;
        inset: 0;
        width: 0;
        height: 0;
        min-width: 0;
        min-height: 0;
        max-width: 0;
        max-height: 0;
        overflow: visible;
        pointer-events: none;
        line-height: 0;
        font-size: 0;
        font-family: Inter, ui-sans-serif, system-ui;
        --ip-accent: rgb(var(--primary));
      }

      :host ::ng-deep .panel.loading .hdr-actions {
        visibility: hidden;
      }

      :host ::ng-deep .panel.loading {
        pointer-events: none;
      }

      :host ::ng-deep .body {
        overflow: visible !important;
      }

      .prompt-shell,
      .loading-shell {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
      }

      .file-cta,
      .recent-file {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 48px;
        padding: 0 16px;
        border-radius: 14px;
        border: 1px solid rgb(var(--border) / 0.42);
        font-weight: 800;
      }

      .file-cta {
        background: linear-gradient(
          135deg,
          var(--ip-accent) 0%,
          color-mix(in oklab, rgb(var(--primary)) 68%, rgb(var(--success))) 100%
        );
        color: rgb(var(--bg0));
        cursor: pointer;
      }

      .file-cta.disabled {
        opacity: 0.58;
        pointer-events: none;
      }

      .file-cta input {
        display: none;
      }

      .hint,
      small {
        margin: 0;
        color: rgb(var(--fg) / 0.68);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .template-cta {
        align-self: flex-start;
        min-height: 28px;
        padding: 0;
        border: 0;
        background: transparent;
        color: rgb(var(--primary));
        font-size: 0.8rem;
        font-weight: 850;
        line-height: 1;
        cursor: pointer;
      }

      .template-cta:hover,
      .template-cta:focus-visible {
        color: color-mix(in oklab, rgb(var(--primary)) 74%, rgb(var(--fg)));
        outline: none;
      }

      .recent-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .recent-panel strong,
      .loading-shell strong {
        font-weight: 900;
      }

      .recent-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .recent-file {
        justify-content: space-between;
        background: color-mix(in oklab, rgb(var(--bg1)) 95%, transparent);
        cursor: pointer;
      }

      .loading-shell {
        align-items: center;
        justify-content: center;
        min-height: 150px;
      }

      .spinner {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid rgb(var(--border) / 0.42);
        border-top-color: var(--ip-accent);
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `
  ]
})
export class SpreadsheetImportPromptPanelComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  readonly uploadFileIcon = Upload01Icon;
  readonly supportedFormatsLabel = SPREADSHEET_IMPORT_EXTENSIONS.join(', ');

  @Input() open = false;
  @Input() disabled = false;
  @Input() accept = SPREADSHEET_IMPORT_EXTENSIONS.join(',');
  @Input() loaderMs = 200;
  @Input() title = 'Import';
  @Input() subtitle = 'Choose Excel or CSV file';
  @Input() loadingTitle = 'Preparing import';
  @Input() loadingSubtitle = 'Reading file...';
  @Input() loadingBody = 'Preparing import workspace';
  @Input() chooseFileLabel = 'Choose file';
  @Input() replaceFileLabel = 'Choose another file';
  @Input() showTemplateAction = false;
  @Input() templateLabel = 'Download template';

  @Output() close = new EventEmitter<void>();
  @Output() filePicked = new EventEmitter<File>();
  @Output() templateRequested = new EventEmitter<void>();

  @ViewChild('picker') picker?: ElementRef<HTMLInputElement>;
  @ViewChild('recentBox') recentBox?: ElementRef<HTMLDivElement>;
  @ViewChild(OverlayPanelComponent) overlayPanel?: OverlayPanelComponent;

  recent: RecentFile[] = [];
  recentBoxH = 0;
  loading = false;
  finalizing = false;

  private ro?: ResizeObserver;
  private loaderTimer?: LooseValue;

  constructor(private readonly zone: NgZone) {}

  get panelCssClass(): string {
    return [this.finalizing ? 'instant-hide' : '', this.loading ? 'loading' : '']
      .filter(Boolean)
      .join(' ');
  }

  ngAfterViewInit(): void {
    this.setupRO();
  }

  ngOnDestroy(): void {
    if (this.loaderTimer) {
      clearTimeout(this.loaderTimer);
    }
    this.ro?.disconnect();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.loading = false;
      this.finalizing = false;
      this.setupRO();
      this.requestOverlayLayoutRefit();
    }

    if (changes['open']?.currentValue === false && this.loaderTimer) {
      clearTimeout(this.loaderTimer);
      this.loaderTimer = null;
      this.loading = false;
      this.finalizing = false;
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) {
      return '0 B';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const units = ['KB', 'MB', 'GB'];
    let size = bytes / 1024;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    const digits = size >= 100 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(digits)} ${units[unitIndex]}`;
  }

  resetPicker(): void {
    const element = this.picker?.nativeElement;
    if (element) {
      element.value = '';
    }
  }

  onReimportClick(file: File): void {
    this.startLoadingThenHandover(file);
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.pushRecent(file);
    this.resetPicker();
    this.startLoadingThenHandover(file);
  }

  private setupRO(): void {
    const box = this.recentBox?.nativeElement;
    if (!box) {
      return;
    }

    this.ro?.disconnect();
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(entries => {
        const height = Math.ceil(entries[0].contentRect.height || 0);
        this.recentBoxH = Math.max(0, Math.min(height, 120));
        this.requestOverlayLayoutRefit();
      });
      this.ro.observe(box);
    }
  }

  private makeKey(file: File): string {
    return `${file.name}__${file.size}__${file.lastModified}`;
  }

  private pushRecent(file: File): void {
    const key = this.makeKey(file);
    this.recent = [{ key, file }, ...this.recent.filter(entry => entry.key !== key)];
    if (this.recent.length > 4) {
      this.recent.length = 4;
    }
    this.requestOverlayLayoutRefit();
  }

  private startLoadingThenHandover(file: File): void {
    this.loading = true;
    this.requestOverlayLayoutRefit();

    this.zone.runOutsideAngular(() => {
      this.loaderTimer = setTimeout(
        () => {
          this.loaderTimer = null;
          this.finalizing = true;
          this.zone.run(() => {
            this.filePicked.emit(file);
            this.close.emit();
          });
        },
        Math.max(200, this.loaderMs | 0)
      );
    });
  }

  private requestOverlayLayoutRefit(): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => this.overlayPanel?.requestLayoutRefit());
    });
  }
}
