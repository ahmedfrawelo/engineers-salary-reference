import { Component, Input } from '@angular/core';

interface SupportContact {
  role: string;
  name: string;
  channel: string;
  note: string;
}

interface EngagementItem {
  title: string;
  date: string;
  detail: string;
}

@Component({
  standalone: true,
  selector: 'feature-account-profile-network-tab',
  imports: [],
  templateUrl: './account-profile-network-tab.component.html',
  styleUrls: ['../shared/account-profile-tab-shared.scss']
})
export class AccountProfileNetworkTabComponent {
  @Input() supportContacts: SupportContact[] = [];
  @Input() engagements: EngagementItem[] = [];
}
