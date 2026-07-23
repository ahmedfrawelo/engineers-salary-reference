import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { PageDesignComponent } from '@shared/ui/page-design';
import { SETTINGS_CATEGORIES } from './settings.data';
import { SettingsAction, SettingsPresentationMode } from './settings.models';

@Component({
  standalone: true,
  selector: 'settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageDesignComponent, AppIconDirective],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  @Input() presentationMode: SettingsPresentationMode = 'page';
  @Output() closePanel = new EventEmitter<void>();
  @Output() openOverlay = new EventEmitter<void>();
  @Output() openMaterialOverlay = new EventEmitter<void>();

  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  readonly categories = SETTINGS_CATEGORIES;
  readonly domainCards = this.categories.map(category => {
    const liveCount = category.availableActions.length;
    const plannedCount = category.plannedActions.length;

    return {
      ...category,
      liveCount,
      plannedCount,
      totalCount: liveCount + plannedCount,
      statusLabel: liveCount > 0 ? 'Live now' : 'Roadmap',
      nextPlannedLabel: category.plannedActions[0]?.label ?? null
    };
  });
  readonly liveEntries = this.domainCards.flatMap(category =>
    category.availableActions.map(action => ({
      id: `${category.id}-${action.label}`,
      categoryId: category.id,
      title: action.label,
      categoryTitle: category.title,
      focus: category.focus,
      icon: category.icon,
      tone: category.tone,
      action
    }))
  );
  activeDomainId = this.domainCards[0]?.id ?? '';

  readonly categoryCount = this.domainCards.length;
  readonly liveToolsCount = this.domainCards.reduce(
    (count, category) => count + category.liveCount,
    0
  );
  readonly plannedToolsCount = this.domainCards.reduce(
    (count, category) => count + category.plannedCount,
    0
  );
  readonly liveDomainCount = this.domainCards.filter(category => category.liveCount > 0).length;
  readonly roadmapDomainCount = this.domainCards.filter(category => category.liveCount === 0)
    .length;
  readonly readinessPercent = Math.round(
    (this.liveToolsCount / Math.max(this.liveToolsCount + this.plannedToolsCount, 1)) * 100
  );

  onActionClick(action: SettingsAction): void {
    if (this.isMaterialClassificationAction(action)) {
      if (this.presentationMode === 'overlay') {
        this.closePanel.emit();
        this.openMaterialOverlay.emit();
      } else {
        void this.router.navigate(['/tender', 'material-classification']);
      }
      return;
    }

    if (this.isAccessControlAction(action)) {
      if (this.presentationMode === 'overlay') {
        this.closePanel.emit();
        this.openOverlay.emit();
      } else {
        void this.router.navigate(['/settings', 'access-control']);
      }
      return;
    }

    if (action.routerLink) {
      if (this.presentationMode === 'overlay') {
        this.closePanel.emit();
      }
      void this.router.navigate(this.resolveLink(action.routerLink));
      return;
    }

    if (this.presentationMode === 'overlay') {
      this.closePanel.emit();
      this.openOverlay.emit();
    }
  }

  scrollToDomain(categoryId: string): void {
    this.activeDomainId = categoryId;
    this.document
      .getElementById(this.domainAnchorId(categoryId))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  domainAnchorId(categoryId: string): string {
    return `settings-domain-${categoryId}`;
  }

  private isMaterialClassificationAction(action: SettingsAction): boolean {
    if (action.label === 'Material Classification') {
      return true;
    }

    if (!action.routerLink) {
      return false;
    }

    const parts = Array.isArray(action.routerLink) ? action.routerLink : [action.routerLink];
    return parts.some(
      part =>
        String(part) === 'material-classification' ||
        String(part).endsWith('/material-classification')
    );
  }

  private isAccessControlAction(action: SettingsAction): boolean {
    return action.label === 'User Access Control';
  }

  private resolveLink(link: string | string[]): string[] {
    const parts = Array.isArray(link) ? link : [link];
    if (parts.length === 0) {
      return ['/settings'];
    }

    const first = String(parts[0]);
    if (first.startsWith('/')) {
      return parts;
    }
    if (first === 'settings') {
      return ['/settings', ...parts.slice(1)];
    }
    if (first.startsWith('settings/')) {
      return ['/' + first, ...parts.slice(1)];
    }
    return ['/settings', ...parts];
  }
}
