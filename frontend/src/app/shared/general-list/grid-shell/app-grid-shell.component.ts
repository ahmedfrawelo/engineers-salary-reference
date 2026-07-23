import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ShellSkeletonVariant } from '@shared/ui/shell-skeleton/shell-skeleton.component';

@Component({
  selector: 'app-grid-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-grid-shell.component.html',
  styleUrls: ['./app-grid-shell.component.scss']
})
export class AppGridShellComponent {
  @Input() loading = false;
  @Input() skeletonVariant: ShellSkeletonVariant = 'table';
  @Input() skeletonRows = 8;
  @Input() skeletonColumns = 9;
  @Input() skeletonHeader = true;
}
