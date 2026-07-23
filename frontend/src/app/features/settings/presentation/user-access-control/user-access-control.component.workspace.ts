import { Directive } from '@angular/core';
import { UserAccessControlComponentWorkspacePermissions } from './user-access-control.component.workspace.permissions';

@Directive()
export abstract class UserAccessControlComponentWorkspace extends UserAccessControlComponentWorkspacePermissions {}

export * from './user-access-control.component.workspace.core';
export * from './user-access-control.component.workspace.permissions';
