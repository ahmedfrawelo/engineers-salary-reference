import { Directive } from '@angular/core';

import type { GridLooseValue } from '../state';
import { DataGridComponentPresenterOverlayBase } from './data-grid.component.presenter.overlay.base';

@Directive()
export class DataGridComponentPresenter<
  T = GridLooseValue
> extends DataGridComponentPresenterOverlayBase<T> {}
