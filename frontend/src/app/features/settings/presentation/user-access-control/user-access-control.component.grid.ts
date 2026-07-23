import { Directive } from '@angular/core';
import { UserAccessControlComponentGridLayout } from './user-access-control.component.grid.layout';

@Directive()
export abstract class UserAccessControlComponentGrid extends UserAccessControlComponentGridLayout {}

export * from './user-access-control.component.grid.columns';
export * from './user-access-control.component.grid.layout';
