import { Component, Input } from '@angular/core';

interface OverviewStatItem {
  label: string;
  value: string;
}

interface OverviewHighlightItem {
  date: string;
  title: string;
  description: string;
  tags: string[];
}

interface OverviewRecognitionItem {
  title: string;
  issuer: string;
  date: string;
  summary: string;
}

interface OverviewProfileModel {
  email: string;
  phone: string;
  location: string;
  timezone: string;
  employmentType: string;
  joinDate: string;
  focusAreas: string;
}

interface OverviewReadiness {
  score: number;
  status: string;
}

@Component({
  standalone: true,
  selector: 'feature-account-profile-overview-tab',
  imports: [],
  templateUrl: './account-profile-overview-tab.component.html',
  styleUrls: ['../shared/account-profile-tab-shared.scss']
})
export class AccountProfileOverviewTabComponent {
  @Input() model!: OverviewProfileModel;
  @Input() headlineStats: OverviewStatItem[] = [];
  @Input() readiness!: OverviewReadiness;
  @Input() highlights: OverviewHighlightItem[] = [];
  @Input() recognitions: OverviewRecognitionItem[] = [];
}
