import { Component, ViewEncapsulation } from '@angular/core';
import { UserAccessControlComponentDrawer } from './user-access-control.component.drawer';

@Component({
  selector: 'user-access-control',
  standalone: false,
  templateUrl: './user-access-control.component.html',
  styleUrls: ['./user-access-control.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class UserAccessControlComponent extends UserAccessControlComponentDrawer {
  readonly view = this;
}
