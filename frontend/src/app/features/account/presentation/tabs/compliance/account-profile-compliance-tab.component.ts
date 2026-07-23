import { Component, Input } from '@angular/core';

interface DocumentItem {
  name: string;
  status: string;
  updated: string;
}

interface ComplianceProfileModel {
  manager: string;
  level: string;
  employmentType: string;
  joinDate: string;
  workMode: string;
  coverage: string;
}

@Component({
  standalone: true,
  selector: 'feature-account-profile-compliance-tab',
  imports: [],
  templateUrl: './account-profile-compliance-tab.component.html',
  styleUrls: ['../shared/account-profile-tab-shared.scss']
})
export class AccountProfileComplianceTabComponent {
  @Input() documents: DocumentItem[] = [];
  @Input() model!: ComplianceProfileModel;
}
