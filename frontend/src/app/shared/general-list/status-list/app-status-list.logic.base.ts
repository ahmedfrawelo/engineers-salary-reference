import { Directive } from '@angular/core';

import { AppStatusListLogicKernel } from './app-status-list.logic.core';

@Directive()
export abstract class AppStatusListLogicCore<
  TPayload = unknown
> extends AppStatusListLogicKernel<TPayload> {}
