import { Component } from '@angular/core';
import { UserAccessControlHostedSectionBase } from './user-access-control-hosted-section.base';

@Component({
  selector: 'user-access-control-dialogs',
  standalone: false,
  templateUrl: './user-access-control-dialogs.component.html'
})
export class UserAccessControlDialogsComponent extends UserAccessControlHostedSectionBase {}
