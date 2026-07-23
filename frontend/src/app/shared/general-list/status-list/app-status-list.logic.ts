import { Directive } from '@angular/core';

import { AppStatusListLogicCore } from './app-status-list.logic.base';

@Directive()
export abstract class AppStatusListLogicBase<
  TPayload = unknown
> extends AppStatusListLogicCore<TPayload> {}
