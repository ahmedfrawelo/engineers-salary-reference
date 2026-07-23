import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject
} from '@angular/core';
import { Add01Icon, SlidersHorizontalIcon } from '@shared/icons/app-icon.registry';
import { DataGridComponent, DataGridModule } from '@shared/data-grid';
import { AppGridShellComponent } from '@shared/general-list';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { StretchTabsIndicatorDirective } from '@shared/directives/stretch-tabs-indicator.directive';
import { CalendarModule } from '@shared/ui/calendar.module';
import { OverlayPanelComponent } from '@shared/ui/overlay-panel.component';
import { PageDesignComponent, type SharedToolbarAction } from '@shared/ui/page-design';
import { AddTenderPanelComponent } from './add-tender-tab/add-tender-panel.component';
import { TenderProjectDetailsComponent } from './tender-project-details/project-details.component';
import { TenderProjectSettingsComponent } from './tender-project-settings/tender-settings.component';
import { TenderProjectsComponentUiBase } from './tender-projects.component.ui.base';
@Component({
  selector: 'tender-projects',
  standalone: true,
  imports: [
    AppGridShellComponent,
    DataGridModule,
    AppIconDirective,
    StretchTabsIndicatorDirective,
    CalendarModule,
    PageDesignComponent,
    TenderProjectDetailsComponent,
    AddTenderPanelComponent,
    TenderProjectSettingsComponent,
    OverlayPanelComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: 'display:flex;flex:1 1 auto;min-width:0;min-height:0;height:100%;'
  },
  templateUrl: './tender-projects.component.html',
  styleUrls: ['./tender-projects.component.scss']
})
export class TenderProjectsComponent extends TenderProjectsComponentUiBase {
  protected override readonly hostElementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private sharedToolbarActionsCacheKey = '';
  private sharedToolbarActionsCache: SharedToolbarAction[] = [];

  get sharedToolbarActions(): SharedToolbarAction[] {
    const canEdit = this.permission.canEditPage('tender.projects');
    const canCreate = this.permission.canCreatePage('tender.projects');
    const cacheKey = `${canEdit ? 1 : 0}|${canCreate ? 1 : 0}`;
    if (this.sharedToolbarActionsCacheKey === cacheKey) {
      return this.sharedToolbarActionsCache;
    }

    const actions: SharedToolbarAction[] = [];
    if (canEdit) {
      actions.push({
        id: 'settings',
        label: 'Tender Settings',
        hugeIcon: SlidersHorizontalIcon,
        hugeIconSize: 16,
        hugeIconStrokeWidth: 2.1,
        variant: 'softRect'
      });
    }
    if (canCreate) {
      actions.push({
        id: 'addTender',
        label: 'Add New Project',
        hugeIcon: Add01Icon,
        hugeIconSize: 16,
        hugeIconStrokeWidth: 2.15,
        className: 'proj-toolbar-btn--add-project',
        tone: 'primary',
        variant: 'softRect'
      });
    }
    this.sharedToolbarActionsCacheKey = cacheKey;
    this.sharedToolbarActionsCache = actions;
    return actions;
  }
  @ViewChild('projectGroupMenu', { read: ElementRef })
  protected override projectGroupMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChild('projectGroupByMenu', { read: ElementRef })
  protected override projectGroupByMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChild('projectGroupOrderMenu', { read: ElementRef })
  protected override projectGroupOrderMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChild('projectColumnsMenu', { read: ElementRef })
  protected override projectColumnsMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChild('projectFiltersMenu', { read: ElementRef })
  protected override projectFiltersMenuRef?: ElementRef<HTMLDetailsElement>;
  @ViewChild('projectFiltersPanel', { read: ElementRef })
  protected override projectFiltersPanelRef?: ElementRef<HTMLDivElement>;
  @ViewChild('projectColumnsSearchInput', { read: ElementRef })
  protected override projectColumnsSearchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('toolbarSearchInput', { read: ElementRef })
  protected override toolbarSearchInputRef?: ElementRef<HTMLInputElement>;
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    this.handleProjectDocumentPointerDown(event);
  }
  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    this.handleProjectDocumentEscape();
  }
  @HostListener('window:resize')
  onWindowResize(): void {
    this.handleProjectWindowResize();
  }
}
