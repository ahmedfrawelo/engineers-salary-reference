import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UserAccessControlComponent } from '../user-access-control/user-access-control.component';

@Component({
  selector: 'feature-user-access-overlay-bridge',
  standalone: true,
  imports: [CommonModule, UserAccessControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<user-access-control></user-access-control>'
})
export class UserAccessControlOverlayBridgeComponent {}
