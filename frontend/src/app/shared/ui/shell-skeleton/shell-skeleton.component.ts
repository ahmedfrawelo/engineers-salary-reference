import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type ShellSkeletonVariant = 'table' | 'list';

@Component({
  selector: 'app-shell-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shell-skeleton.component.html',
  styleUrls: ['./shell-skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellSkeletonComponent {
  @Input() variant: ShellSkeletonVariant = 'table';
  @Input() rows = 8;
  @Input() columns = 9;
  @Input() header = true;

  get rowsArray(): number[] {
    const total = Number.isFinite(this.rows) ? Math.max(1, Math.floor(this.rows)) : 8;
    return Array.from({ length: total }, (_, index) => index);
  }

  get columnsArray(): number[] {
    const total = Number.isFinite(this.columns) ? Math.max(1, Math.floor(this.columns)) : 9;
    return Array.from({ length: total }, (_, index) => index);
  }

  rowPrimaryWidth(rowIndex: number): number {
    return 84 - ((rowIndex * 13) % 24);
  }

  rowSecondaryWidth(rowIndex: number): number {
    return 48 + ((rowIndex * 11) % 36);
  }

  tableCellWidth(rowIndex: number, colIndex: number): number {
    return 58 + ((rowIndex * 17 + colIndex * 11) % 34);
  }
}
