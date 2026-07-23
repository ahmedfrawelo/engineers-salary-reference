import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  inject
} from '@angular/core';

@Component({
  selector: 'app-tip-panel',
  standalone: true,
  template: `
    <div class="app-tip-panel" [class.is-below]="placement === 'below'">
      {{ text }}
    </div>
  `,
  styleUrl: './app-tip-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppTipPanelComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() text = '';
  @Input() placement: 'above' | 'below' = 'above';

  /** Keep caret aimed at the trigger center (px from panel left). */
  setArrowOffset(offsetPx: number | null): void {
    const panel = this.host.nativeElement.querySelector(
      '.app-tip-panel'
    ) as HTMLElement | null;
    if (!panel) {
      return;
    }
    if (offsetPx == null || !Number.isFinite(offsetPx)) {
      panel.style.removeProperty('--app-tip-arrow-left');
      return;
    }
    panel.style.setProperty('--app-tip-arrow-left', `${Math.round(offsetPx)}px`);
  }
}
