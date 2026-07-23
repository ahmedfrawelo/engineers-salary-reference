import { Component } from '@angular/core';
import { UserAccessControlHostedSectionBase } from './user-access-control-hosted-section.base';

@Component({
  selector: 'user-access-control-create-panel',
  standalone: false,
  templateUrl: './user-access-control-create-panel.component.html'
})
export class UserAccessControlCreatePanelComponent extends UserAccessControlHostedSectionBase {}
