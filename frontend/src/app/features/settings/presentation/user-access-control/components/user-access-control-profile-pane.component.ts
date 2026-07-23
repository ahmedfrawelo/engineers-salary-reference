import { Component } from '@angular/core';
import { UserAccessControlHostedSectionBase } from './user-access-control-hosted-section.base';

@Component({
  selector: 'user-access-control-profile-pane',
  standalone: false,
  styles: [
    `
      :host {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
      }
    `
  ],
  templateUrl: './user-access-control-profile-pane.component.html'
})
export class UserAccessControlProfilePaneComponent extends UserAccessControlHostedSectionBase {}
