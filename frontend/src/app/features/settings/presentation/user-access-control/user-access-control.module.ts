import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { AppStatusListComponent } from '../../../../shared/general-list';
import { AppIconDirective } from '../../../../shared/icons/app-icon.directive';
import { CustomDropdownComponent } from '../../../../shared/custom-dropdown/custom-dropdown.component';
import { StretchTabsIndicatorDirective } from '../../../../shared/directives/stretch-tabs-indicator.directive';
import { OverlayPanelComponent } from '../../../../shared/ui/overlay-panel.component';
import { PageDesignComponent } from '@shared/ui/page-design';
import { SideDrawerComponent } from '../../../../shared/ui/side-drawer.component';
import { UserAccessControlComponent } from './user-access-control.component';
import { UserAccessControlCreatePanelComponent } from './components/user-access-control-create-panel.component';
import { UserAccessControlDialogsComponent } from './components/user-access-control-dialogs.component';
import { UserAccessControlHeaderActionsComponent } from './components/user-access-control-header-actions.component';
import { UserAccessControlPermissionDrawerComponent } from './components/user-access-control-permission-drawer.component';
import { UserAccessControlPermissionsPaneComponent } from './components/user-access-control-permissions-pane.component';
import { UserAccessControlProfileDeletedDrawerComponent } from './components/user-access-control-profile-deleted-drawer.component';
import { UserAccessControlProfilePaneComponent } from './components/user-access-control-profile-pane.component';
import { UserAccessControlProfileUserDrawerComponent } from './components/user-access-control-profile-user-drawer.component';
import { UserAccessControlRoleMembersDrawerComponent } from './components/user-access-control-role-members-drawer.component';
import { USER_ACCESS_CONTROL_ROUTES } from './user-access-control.routes';

@NgModule({
  declarations: [
    UserAccessControlComponent,
    UserAccessControlCreatePanelComponent,
    UserAccessControlHeaderActionsComponent,
    UserAccessControlProfilePaneComponent,
    UserAccessControlProfileDeletedDrawerComponent,
    UserAccessControlProfileUserDrawerComponent,
    UserAccessControlPermissionsPaneComponent,
    UserAccessControlPermissionDrawerComponent,
    UserAccessControlRoleMembersDrawerComponent,
    UserAccessControlDialogsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(USER_ACCESS_CONTROL_ROUTES),
    HugeiconsIconComponent,
    AppIconDirective,
    StretchTabsIndicatorDirective,
    CustomDropdownComponent,
    PageDesignComponent,
    AppStatusListComponent,
    OverlayPanelComponent,
    SideDrawerComponent
  ]
})
export class UserAccessControlModule {}
