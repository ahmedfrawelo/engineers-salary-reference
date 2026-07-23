import { Component } from '@angular/core';
import { UserAccessControlHostedSectionBase } from './user-access-control-hosted-section.base';

@Component({
  selector: 'user-access-control-permission-drawer',
  standalone: false,
  templateUrl: './user-access-control-permission-drawer.component.html'
})
export class UserAccessControlPermissionDrawerComponent extends UserAccessControlHostedSectionBase {}
