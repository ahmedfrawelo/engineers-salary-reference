import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AUTH_USER_FACADE } from '@core/auth/auth-user.facade';
import { AccountProfileComplianceTabComponent } from './tabs/compliance/account-profile-compliance-tab.component';
import { AccountProfileDevelopmentTabComponent } from './tabs/development/account-profile-development-tab.component';
import { AccountProfileInsightsTabComponent } from './tabs/insights/account-profile-insights-tab.component';
import { AccountProfileNetworkTabComponent } from './tabs/network/account-profile-network-tab.component';
import { AccountProfileOverviewTabComponent } from './tabs/overview/account-profile-overview-tab.component';
import { AccountProfilePerformanceTabComponent } from './tabs/performance/account-profile-performance-tab.component';

type MetricTrend = 'positive' | 'neutral' | 'risk';
type ProfileTabId =
  | 'overview'
  | 'performance'
  | 'insights'
  | 'development'
  | 'network'
  | 'compliance';

interface ProfileTab {
  id: ProfileTabId;
  label: string;
  icon: string;
  count?: number;
}

interface RoleSummary {
  label: string;
  description: string;
}

interface KeyMetric {
  label: string;
  value: string;
  caption: string;
  trend: MetricTrend;
  score: number;
}

interface AvailabilitySlot {
  title: string;
  value: string;
  caption: string;
}

interface ReadinessSummary {
  score: number;
  status: string;
  watchlistCount: number;
  topPriority: string;
}

interface InitiativeItem {
  name: string;
  summary: string;
  owner: string;
  due: string;
  progress: number;
  health: MetricTrend;
}

interface HighlightItem {
  date: string;
  title: string;
  description: string;
  tags: string[];
}

interface RecognitionItem {
  title: string;
  issuer: string;
  date: string;
  summary: string;
}

interface DocumentItem {
  name: string;
  status: string;
  updated: string;
}

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

interface EvaluationPulse {
  label: string;
  value: string;
  note: string;
  trend: MetricTrend;
}

interface CompetencyScore {
  area: string;
  score: number;
  target: number;
  delta: number;
}

interface TrendPoint {
  period: string;
  score: number;
  delivery: number;
}

interface GoalTrackItem {
  title: string;
  owner: string;
  due: string;
  progress: number;
  health: MetricTrend;
}

interface FeedbackItem {
  source: string;
  score: number;
  note: string;
}

interface ActionItem {
  title: string;
  owner: string;
  due: string;
  impact: string;
  priority: 'High' | 'Medium' | 'Normal';
}

interface EssentialCard {
  label: string;
  value: string;
  note: string;
  tone: MetricTrend;
}

interface FocusRecommendation {
  title: string;
  reason: string;
  impact: string;
  priority: 'Priority 1' | 'Priority 2' | 'Priority 3';
}

interface ProfileData {
  name: string;
  email: string;
  employeeCode: string;
  roles: string[];
  jobTitle: string;
  department: string;
  summary: string;
  manager: string;
  level: string;
  employmentType: string;
  joinDate: string;
  experience: string;
  workMode: string;
  location: string;
  timezone: string;
  phone: string;
  focusAreas: string;
  coverage: string;
  badges: string[];
  wellbeingNote?: string;
}
@Component({
  standalone: true,
  selector: 'feature-account-profile-page',
  imports: [
    AccountProfileOverviewTabComponent,
    AccountProfilePerformanceTabComponent,
    AccountProfileInsightsTabComponent,
    AccountProfileDevelopmentTabComponent,
    AccountProfileNetworkTabComponent,
    AccountProfileComplianceTabComponent
  ],
  templateUrl: './account-profile-page.component.html',
  styleUrls: ['./account-profile-page.component.scss']
})
export class AccountProfilePageComponent {
  private readonly auth = inject(AUTH_USER_FACADE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly fallbackProfile: ProfileData = {
    name: 'Mariam Khaled',
    email: 'mariam.khaled@engineers-salary-reference.io',
    employeeCode: 'EMP-472815',
    roles: ['Procurement Lead', 'Workspace Admin'],
    jobTitle: 'Senior Procurement Analyst',
    department: 'Global Supply Chain - MEA',
    summary:
      'Driving strategic sourcing initiatives across the MEA region with a focus on resilient supplier ecosystems, risk mitigation, and digital procurement acceleration.',
    manager: 'Daniel Ortiz',
    level: 'Career Level 4 (Lead)',
    employmentType: 'Full-time - Hybrid',
    joinDate: 'Feb 2019',
    experience: '6 years in role - 11 years total',
    workMode: 'Hybrid (3 days on-site)',
    location: 'Dubai HQ, United Arab Emirates',
    timezone: 'GST (UTC+4)',
    phone: '+971 50 555 2910',
    focusAreas:
      'Supplier partnership orchestration, resilience programmes, operating cost optimisation, and digital procurement enablement across MEA.',
    coverage:
      'Weekly sync with APAC sourcing hub and automated escalations through the global command centre.',
    badges: ['MEA Coverage', 'Procurement Guild', 'Diversity Council'],
    wellbeingNote:
      'Recharge slot held every Wednesday at 16:00 GST with leadership coverage confirmed.'
  };

  readonly hasUser = computed(() => Boolean(this.auth.user()));

  readonly vm = computed(() => {
    const fallback = this.fallbackProfile;
    const user = this.auth.user();

    const name = this.normalise(user?.name, fallback.name);
    const email = this.normalise(user?.email, fallback.email);
    const employeeCode = this.normalise(
      user?.id != null ? String(user.id) : undefined,
      fallback.employeeCode
    );
    const roles = user?.roles?.length ? user.roles : fallback.roles;

    return {
      ...fallback,
      name,
      email,
      employeeCode,
      roles,
      initials: this.initialsFrom(name)
    };
  });

  readonly primaryRole = computed<RoleSummary | null>(() => {
    const role = this.vm().roles[0];
    if (!role) {
      return null;
    }

    const normalized = role.toLowerCase();
    if (normalized.includes('admin')) {
      return {
        label: 'Admin',
        description: 'Can update profile data and manage account access settings.'
      };
    }

    if (normalized.includes('lead')) {
      return {
        label: role,
        description: 'Leads team decisions and approvals within this workspace.'
      };
    }

    return {
      label: role,
      description: 'Defines your current workspace scope and permissions.'
    };
  });

  readonly headlineStats = computed(() => {
    const model = this.vm();
    return [
      { label: 'Employee ID', value: model.employeeCode },
      { label: 'Manager', value: model.manager },
      { label: 'Work mode', value: model.workMode },
      { label: 'Tenure', value: model.experience }
    ];
  });

  readonly keyMetrics: KeyMetric[] = [
    {
      label: 'OKR completion',
      value: '86%',
      caption: '+4% vs last quarter',
      trend: 'positive',
      score: 86
    },
    {
      label: 'Supplier NPS',
      value: '9.1',
      caption: 'Top 5% within global benchmark',
      trend: 'positive',
      score: 91
    },
    {
      label: 'Compliance score',
      value: '97%',
      caption: 'Audit-ready with two minor actions open',
      trend: 'neutral',
      score: 97
    },
    {
      label: 'Cycle time (RFx)',
      value: '5.3 days',
      caption: '38% faster year over year',
      trend: 'positive',
      score: 82
    }
  ];

  readonly availability: AvailabilitySlot[] = [
    {
      title: 'Next PTO window',
      value: '8-15 Dec',
      caption: 'APAC team covering sourcing queue through the automation hub'
    },
    {
      title: 'Flex days remaining',
      value: '4 this quarter',
      caption: 'Aligned with wellbeing charter and People Ops'
    },
    {
      title: 'Wellbeing check-in',
      value: 'On track',
      caption: 'Last session completed 28 Oct with People Partner'
    }
  ];

  readonly initiatives: InitiativeItem[] = [
    {
      name: 'Digital supplier cockpit rollout',
      summary:
        'Deploying predictive analytics dashboards across MEA priority categories to close visibility gaps.',
      owner: 'MEA Automation PMO',
      due: 'Q2 2026',
      progress: 78,
      health: 'positive'
    },
    {
      name: 'Risk taxonomy alignment',
      summary:
        'Consolidating legal and compliance playbooks into a unified supplier risk framework.',
      owner: 'Legal and Compliance Guild',
      due: 'Apr 2026',
      progress: 64,
      health: 'neutral'
    },
    {
      name: 'MEA logistics consolidation',
      summary: 'Driving cost-out and resilience by renegotiating regional logistics agreements.',
      owner: 'Regional Sourcing Squad',
      due: 'Jul 2026',
      progress: 52,
      health: 'risk'
    }
  ];

  readonly highlights: HighlightItem[] = [
    {
      date: 'Jan 2026',
      title: 'MEA supplier consolidation wave completed',
      description: 'Delivered $4.6M run-rate savings across packaging and logistics portfolios.',
      tags: ['Savings', 'MEA']
    },
    {
      date: 'Dec 2025',
      title: 'Risk playbook deployed with Legal and Compliance',
      description: 'Implemented new supplier risk taxonomy and command centre dashboards.',
      tags: ['Risk', 'Compliance']
    },
    {
      date: 'Oct 2025',
      title: 'Recognised as Global Procurement Guild mentor',
      description: 'Coached three strategic sourcing associates through the accelerator cohort.',
      tags: ['People', 'Mentorship']
    }
  ];

  readonly recognitions: RecognitionItem[] = [
    {
      title: 'Global Procurement Guild mentor award',
      issuer: 'Global Procurement Guild',
      date: 'Dec 2025',
      summary:
        'Mentored the first MEA cohort of the strategic sourcing accelerator achieving full certification.'
    },
    {
      title: 'Leadership spotlight - resilient supply chains',
      issuer: 'ENGINEERS_SALARY_REFERENCE CEO Forum',
      date: 'Nov 2025',
      summary:
        'Highlighted in the CEO town hall for orchestrating the MEA supplier diversification programme delivering 7 percent resilience uplift.'
    }
  ];

  readonly documents: DocumentItem[] = [
    { name: 'Code of conduct attestation', status: 'Current', updated: '14 Jan 2026' },
    { name: 'Data privacy training', status: 'Pending review', updated: 'Due 30 Mar 2026' },
    { name: 'Travel risk acknowledgment', status: 'Current', updated: '02 Dec 2025' }
  ];

  readonly learning: LearningItem[] = [
    {
      name: 'Strategic Supplier Risk Masterclass',
      provider: 'MIT Sloan Online',
      due: 'Complete by 04 Mar'
    },
    {
      name: 'Leadership Circle 360 Coaching',
      provider: 'ENGINEERS_SALARY_REFERENCE Talent Lab',
      due: 'Session 2 on 18 Feb'
    }
  ];

  readonly certifications: CertificationItem[] = [
    { name: 'CIPS Level 4 Diploma in Procurement and Supply', issuer: 'CIPS', status: 'Active' },
    { name: 'Certified Professional in Supply Management (CPSM)', issuer: 'ISM', status: 'Active' }
  ];

  readonly evaluationPulse: EvaluationPulse[] = [
    {
      label: 'Performance index',
      value: '89',
      note: 'Composite index across delivery, quality, and collaboration.',
      trend: 'positive'
    },
    {
      label: 'Team impact',
      value: 'Top 12%',
      note: 'Relative contribution score versus peer cohort.',
      trend: 'positive'
    },
    {
      label: 'Quality reliability',
      value: '94%',
      note: 'Deliverables accepted without rework.',
      trend: 'neutral'
    },
    {
      label: 'Risk exposure',
      value: '2 open',
      note: 'Two initiatives currently under watchlist.',
      trend: 'risk'
    }
  ];

  readonly competencyScores: CompetencyScore[] = [
    { area: 'Execution reliability', score: 91, target: 88, delta: 5 },
    { area: 'Stakeholder alignment', score: 84, target: 82, delta: 3 },
    { area: 'Commercial negotiation', score: 88, target: 85, delta: 4 },
    { area: 'Risk control discipline', score: 79, target: 83, delta: -2 },
    { area: 'Digital adoption', score: 86, target: 84, delta: 6 }
  ];

  readonly trendPoints: TrendPoint[] = [
    { period: 'Oct', score: 74, delivery: 71 },
    { period: 'Nov', score: 78, delivery: 75 },
    { period: 'Dec', score: 81, delivery: 77 },
    { period: 'Jan', score: 86, delivery: 83 },
    { period: 'Feb', score: 89, delivery: 86 }
  ];

  readonly goalTrack: GoalTrackItem[] = [
    {
      title: 'Supplier onboarding cycle optimisation',
      owner: 'MEA Process Squad',
      due: '15 Mar 2026',
      progress: 86,
      health: 'positive'
    },
    {
      title: 'Contract variance reduction',
      owner: 'Commercial Excellence',
      due: '28 Mar 2026',
      progress: 63,
      health: 'neutral'
    },
    {
      title: 'Critical supplier risk closure',
      owner: 'Risk and Legal Hub',
      due: '10 Apr 2026',
      progress: 47,
      health: 'risk'
    }
  ];

  readonly feedbackPulse: FeedbackItem[] = [
    {
      source: 'Manager review',
      score: 92,
      note: 'Strong ownership and decision velocity in cross-functional alignment.'
    },
    {
      source: 'Peer feedback',
      score: 87,
      note: 'Consistent collaboration, with room to improve documentation depth.'
    },
    {
      source: 'Stakeholder NPS',
      score: 90,
      note: 'Business partners rate communication clarity and follow-through highly.'
    }
  ];

  readonly actionPlan: ActionItem[] = [
    {
      title: 'Close legal sign-off backlog for risk playbook',
      owner: 'Daniel Ortiz',
      due: '20 Feb 2026',
      impact: 'Unblocks compliance milestone and removes one watch item.',
      priority: 'High'
    },
    {
      title: 'Publish supplier cockpit adoption dashboard v2',
      owner: 'Priya Bansal',
      due: '27 Feb 2026',
      impact: 'Improves weekly visibility for category owners.',
      priority: 'Medium'
    },
    {
      title: 'Mentor two sourcing associates for accelerator cycle',
      owner: 'People Partner',
      due: '05 Mar 2026',
      impact: 'Builds succession depth and talent readiness.',
      priority: 'Normal'
    }
  ];

  readonly essentials: EssentialCard[] = [
    {
      label: 'Next 1:1',
      value: '19 Feb - 11:00 GST',
      note: 'Monthly growth and delivery checkpoint with manager.',
      tone: 'neutral'
    },
    {
      label: 'PTO balance',
      value: '11 days',
      note: 'Recommended to plan at least 4 days this quarter.',
      tone: 'positive'
    },
    {
      label: 'Pending approvals',
      value: '3 items',
      note: '2 supplier reviews and 1 contract addendum pending.',
      tone: 'risk'
    },
    {
      label: 'Open dependencies',
      value: '5 cross-team',
      note: 'Mainly linked to legal and technology workstreams.',
      tone: 'neutral'
    }
  ];

  readonly focusRecommendations: FocusRecommendation[] = [
    {
      title: 'Close high-risk supplier controls first',
      reason: 'Current risk-control score is below target by 2 points.',
      impact: 'Reduces watchlist pressure and improves audit posture.',
      priority: 'Priority 1'
    },
    {
      title: 'Standardise weekly stakeholder update',
      reason: 'Peer feedback highlights documentation consistency gap.',
      impact: 'Improves cross-team execution clarity and accountability.',
      priority: 'Priority 2'
    },
    {
      title: 'Accelerate digital cockpit adoption coaching',
      reason: 'Adoption trend is positive but uneven across categories.',
      impact: 'Increases forecasting reliability and decision speed.',
      priority: 'Priority 3'
    }
  ];

  readonly supportContacts: SupportContact[] = [
    {
      role: 'People partner',
      name: 'Sara Al Hamadi',
      channel: 'sara.alhamadi@engineers-salary-reference.io',
      note: 'Wellbeing cadence, mobility conversations, and leadership coaching links.'
    },
    {
      role: 'Finance controller',
      name: 'Jonah Ramirez',
      channel: 'jonah.ramirez@engineers-salary-reference.io',
      note: 'Quarterly forecast, productivity tracking, and savings governance.'
    },
    {
      role: 'Technology liaison',
      name: 'Priya Bansal',
      channel: 'priya.bansal@engineers-salary-reference.io',
      note: 'Automation squad lead for Ariba and digital supplier cockpit implementation.'
    }
  ];

  readonly engagements: EngagementItem[] = [
    {
      title: 'Procurement COE sync',
      date: '20 Feb - 09:30 GST',
      detail: 'Review automation adoption KPIs and risk mitigations.'
    },
    {
      title: 'Supplier innovation forum',
      date: '05 Mar - 15:00 GST',
      detail: 'Co-hosting with APAC cluster on sustainable packaging.'
    },
    {
      title: 'Leadership 1:1',
      date: '22 Mar - 11:00 GST',
      detail: 'Quarterly development conversation with regional VP.'
    }
  ];

  readonly readiness = computed<ReadinessSummary>(() => {
    const scores = this.keyMetrics.map(metric => metric.score);
    const score = Math.round(
      scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1)
    );
    const watchlistCount = this.initiatives.filter(item => item.health === 'risk').length;

    return {
      score,
      status: watchlistCount > 0 ? 'Watchlist active' : 'Stable trajectory',
      watchlistCount,
      topPriority: this.initiatives[0]?.name ?? 'No active priorities'
    };
  });

  readonly initiativeOverview = computed(() => {
    const total = this.initiatives.length;
    const healthy = this.initiatives.filter(item => item.health === 'positive').length;
    const needsAttention = this.initiatives.filter(item => item.health === 'risk').length;
    const completion = Math.round(
      this.initiatives.reduce((sum, item) => sum + item.progress, 0) / Math.max(total, 1)
    );
    return {
      total,
      healthy,
      needsAttention,
      completion
    };
  });

  readonly quickSignals = computed(() => {
    const model = this.vm();
    const readiness = this.readiness();
    const initiatives = this.initiativeOverview();

    return [
      {
        label: 'Command score',
        value: `${readiness.score}%`,
        caption: readiness.status
      },
      {
        label: 'Open initiatives',
        value: `${initiatives.total}`,
        caption: `${initiatives.healthy} healthy, ${initiatives.needsAttention} at risk`
      },
      {
        label: 'Avg delivery',
        value: `${initiatives.completion}%`,
        caption: 'Cross-program execution progress'
      },
      {
        label: 'Coverage cadence',
        value: model.workMode,
        caption: model.coverage
      }
    ];
  });

  readonly activeTab = signal<ProfileTabId>('overview');

  readonly tabs = computed<ProfileTab[]>(() => [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    {
      id: 'performance',
      label: 'Performance',
      icon: 'graph-up-arrow',
      count: this.initiatives.length + this.keyMetrics.length
    },
    {
      id: 'insights',
      label: 'Insights',
      icon: 'bar-chart-line',
      count: this.competencyScores.length + this.actionPlan.length
    },
    {
      id: 'development',
      label: 'People & Growth',
      icon: 'mortarboard',
      count: this.learning.length + this.certifications.length
    },
    {
      id: 'network',
      label: 'Network',
      icon: 'people',
      count: this.supportContacts.length + this.engagements.length
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: 'shield-check',
      count: this.documents.length
    }
  ]);

  constructor() {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (this.isProfileTabId(requestedTab)) {
      this.activeTab.set(requestedTab);
    }
  }

  setActiveTab(tabId: ProfileTabId): void {
    if (this.activeTab() === tabId) {
      return;
    }

    this.activeTab.set(tabId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabId },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private initialsFrom(name: string): string {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
    return initials || 'AB';
  }

  private normalise(value: string | undefined, fallback: string): string {
    if (!value) {
      return fallback;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
  }

  private isProfileTabId(value: string | null): value is ProfileTabId {
    return (
      value === 'overview' ||
      value === 'performance' ||
      value === 'insights' ||
      value === 'development' ||
      value === 'network' ||
      value === 'compliance'
    );
  }
}
