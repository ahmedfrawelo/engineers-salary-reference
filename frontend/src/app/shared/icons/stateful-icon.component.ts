import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';

@Component({
  selector: 'app-stateful-icon',
  standalone: true,
  imports: [HugeiconsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-stateful-icon',
    '[class.is-active]': 'active',
    '[style.--stateful-icon-size.px]': 'size'
  },
  template: `
    <hugeicons-icon
      class="app-stateful-icon__layer app-stateful-icon__outline"
      [icon]="outlineIcon"
      [size]="size"
      [strokeWidth]="strokeWidth"
      [absoluteStrokeWidth]="true"
      aria-hidden="true"
    ></hugeicons-icon>
    <hugeicons-icon
      class="app-stateful-icon__layer app-stateful-icon__filled"
      [icon]="filledIcon"
      [size]="size"
      [strokeWidth]="filledIcon === outlineIcon ? strokeWidth : 0"
      [absoluteStrokeWidth]="filledIcon === outlineIcon"
      aria-hidden="true"
    ></hugeicons-icon>
  `
})
export class StatefulIconComponent {
  @Input({ required: true }) outlineIcon!: IconSvgObject;
  @Input({ required: true }) filledIcon!: IconSvgObject;
  @Input() active = false;
  @Input() size = 18;
  @Input() strokeWidth = 2.05;
}
