import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TenderProjectsComponent } from './page/tender-projects.component';

@Component({
  selector: 'feature-tender-projects-page',
  standalone: true,
  imports: [TenderProjectsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: 'display:flex;flex:1 1 auto;min-height:0;height:100%;'
  },
  template: '<tender-projects />'
})
export class TenderProjectsFeaturePageComponent {}
