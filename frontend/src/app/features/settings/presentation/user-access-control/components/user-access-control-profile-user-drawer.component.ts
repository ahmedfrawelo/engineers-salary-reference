import { Component } from '@angular/core';
import { UserAccessControlHostedSectionBase } from './user-access-control-hosted-section.base';

@Component({
  selector: 'user-access-control-profile-user-drawer',
  standalone: false,
  templateUrl: './user-access-control-profile-user-drawer.component.html'
})
export class UserAccessControlProfileUserDrawerComponent extends UserAccessControlHostedSectionBase {}
