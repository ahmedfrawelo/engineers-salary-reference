import { Component } from '@angular/core';
import { UserAccessControlHostedSectionBase } from './user-access-control-hosted-section.base';

@Component({
  selector: 'user-access-control-role-members-drawer',
  standalone: false,
  templateUrl: './user-access-control-role-members-drawer.component.html'
})
export class UserAccessControlRoleMembersDrawerComponent extends UserAccessControlHostedSectionBase {}
