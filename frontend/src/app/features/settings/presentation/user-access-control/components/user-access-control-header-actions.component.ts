import { Component } from '@angular/core';
import { UserAccessControlHostedSectionBase } from './user-access-control-hosted-section.base';

@Component({
  selector: 'user-access-control-header-actions',
  standalone: false,
  host: {
    'header-actions': ''
  },
  templateUrl: './user-access-control-header-actions.component.html'
})
export class UserAccessControlHeaderActionsComponent extends UserAccessControlHostedSectionBase {}
