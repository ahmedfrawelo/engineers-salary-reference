import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Cancel01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Edit01Icon,
  FilterIcon,
  LayoutThreeColumnIcon,
  Search01Icon,
  Settings01Icon,
  UserMultipleIcon,
  ViewIcon
} from '@shared/icons/app-icon.registry';
import { AppIconDirective } from '@shared/icons/app-icon.directive';

import { PageDesignLogicBase } from './page-design.logic';
import { SharedColumnsPanelComponent, SharedCustomizePanelComponent } from '../panels';
import { SharedFilterMenuComponent, type SharedFilterMenuHost } from '../menus';
import { SharedGroupMenuComponent } from '../menus';
import { AssigneeFilterMenuComponent } from '@shared/ui/assignee-filter-menu.component';
import { MineQuickFilterMenuComponent } from '@shared/ui/mine-quick-filter-menu.component';

@Component({
  selector: 'engineers-salary-reference-page-design',
  standalone: true,
  host: {
    '[attr.title]': 'null'
  },
  imports: [
    NgClass,
    AppIconDirective,
    HugeiconsIconComponent,
    AssigneeFilterMenuComponent,
    MineQuickFilterMenuComponent,
    SharedColumnsPanelComponent,
    SharedCustomizePanelComponent,
    SharedFilterMenuComponent,
    SharedGroupMenuComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './page-design.component.html',
  styleUrls: ['./page-design.component.scss']
})
export class PageDesignComponent extends PageDesignLogicBase {
  readonly sharedFilterPanelHost = this as unknown as SharedFilterMenuHost;
  readonly columnsToolbarIcon = LayoutThreeColumnIcon;
  readonly editToolbarIcon = Edit01Icon;
  readonly deleteToolbarIcon = Delete02Icon;
  readonly viewsToolbarIcon = ViewIcon;
  readonly filterToolbarIcon = FilterIcon;
  readonly closedToolbarIcon = CheckmarkCircle02Icon;
  readonly assigneeToolbarIcon = UserMultipleIcon;
  readonly searchToolbarIcon = Search01Icon;
  readonly clearSearchToolbarIcon = Cancel01Icon;
  readonly customizeToolbarIcon = Settings01Icon;
  readonly expandGroupsToolbarIcon = ArrowDown01Icon;
  readonly collapseGroupsToolbarIcon = ArrowUp01Icon;
}
