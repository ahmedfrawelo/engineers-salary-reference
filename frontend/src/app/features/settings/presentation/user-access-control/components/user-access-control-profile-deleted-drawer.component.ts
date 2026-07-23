import { Component } from '@angular/core';
import { UserAccessControlHostedSectionBase } from './user-access-control-hosted-section.base';

@Component({
  selector: 'user-access-control-profile-deleted-drawer',
  standalone: false,
  templateUrl: './user-access-control-profile-deleted-drawer.component.html'
})
export class UserAccessControlProfileDeletedDrawerComponent extends UserAccessControlHostedSectionBase {}
