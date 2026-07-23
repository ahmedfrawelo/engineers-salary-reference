import { Component, Input } from '@angular/core';

interface AvailabilitySlot {
  title: string;
  value: string;
  caption: string;
}

interface LearningItem {
  name: string;
  provider: string;
  due: string;
}

interface CertificationItem {
  name: string;
  issuer: string;
  status: string;
}

@Component({
  standalone: true,
  selector: 'feature-account-profile-development-tab',
  imports: [],
  templateUrl: './account-profile-development-tab.component.html',
  styleUrls: ['../shared/account-profile-tab-shared.scss']
})
export class AccountProfileDevelopmentTabComponent {
  @Input() availability: AvailabilitySlot[] = [];
  @Input() learning: LearningItem[] = [];
  @Input() certifications: CertificationItem[] = [];
  @Input() wellbeingNote: string | undefined;
}
