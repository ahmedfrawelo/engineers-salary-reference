import { Directive } from '@angular/core';
import { UserAccessControlComponentPresenterUsers } from './user-access-control.component.presenter.users';

@Directive()
export abstract class UserAccessControlComponentPresenter extends UserAccessControlComponentPresenterUsers {}

export * from './user-access-control.component.presenter.core';
export * from './user-access-control.component.presenter.roster';
export * from './user-access-control.component.presenter.users';
