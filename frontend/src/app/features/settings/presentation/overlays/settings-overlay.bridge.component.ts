import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { SettingsComponent } from '../settings.component';

@Component({
  selector: 'feature-settings-overlay-bridge',
  standalone: true,
  imports: [CommonModule, SettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <settings-page
      presentationMode="overlay"
      (closePanel)="closePanel.emit()"
      (openOverlay)="openOverlay.emit()"
      (openMaterialOverlay)="openMaterialOverlay.emit()"
    ></settings-page>
  `
})
export class SettingsOverlayBridgeComponent {
  @Output() closePanel = new EventEmitter<void>();
  @Output() openOverlay = new EventEmitter<void>();
  @Output() openMaterialOverlay = new EventEmitter<void>();
}
