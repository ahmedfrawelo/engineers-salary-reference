import { SettingsCategory } from './settings.models';

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'supplier',
    eyebrow: 'Supplier Data',
    title: 'Supplier Enablement',
    focus: 'Define the supplier-facing vocabulary used across PQ and RFQ flows.',
    description:
      'Makes suppliers answer against the same definitions, tags, and qualification structure.',
    scope: ['Supplier tags', 'PQ templates', 'Submission references'],
    icon: 'people-fill',
    tone: 'supplier',
    availableActions: [],
    plannedActions: [{ label: 'Supplier Tags' }, { label: 'Prequalification Templates' }]
  },
  {
    id: 'commercial',
    eyebrow: 'Commercial Rules',
    title: 'Commercial Controls',
    focus: 'Set the pricing rules and approvals that keep bids aligned.',
    description: 'Stops pricing and approvals from drifting between teams or tenders.',
    scope: ['Pricing bands', 'Approval rules', 'Benchmark policies'],
    icon: 'cash-coin',
    tone: 'commercial',
    availableActions: [],
    plannedActions: [{ label: 'Pricing Bands' }, { label: 'Approval Rules' }]
  },
  {
    id: 'access',
    eyebrow: 'Governance',
    title: 'People & Access',
    focus: 'Control who can enter each workspace and what they can change.',
    description: 'Keeps account access, roles, and future audit visibility in one governance area.',
    scope: ['User roles', 'Workspace permissions', 'Audit history'],
    icon: 'shield-lock',
    tone: 'access',
    availableActions: [{ label: 'User Access Control', primary: true }],
    plannedActions: [{ label: 'Audit Trails' }]
  },
  {
    id: 'appearance',
    eyebrow: 'Experience',
    title: 'Look & Feel',
    focus: 'Shape the brand system that appears across the whole workspace.',
    description: 'Centralizes color, background, and future typography decisions for every theme.',
    scope: ['Theme tokens', 'Brand accents', 'Typography system'],
    icon: 'palette',
    tone: 'appearance',
    availableActions: [{ label: 'Theme & Colors', routerLink: ['appearance'], primary: true }],
    plannedActions: [{ label: 'Typography System' }]
  },
  {
    id: 'active-sessions',
    eyebrow: 'Monitoring',
    title: 'Active Sessions',
    focus: 'See who is on the platform right now and what they are doing.',
    description:
      'Real-time visibility into online users, current pages, session duration, and devices.',
    scope: ['Online users', 'Current page', 'Session duration', 'Device'],
    icon: 'activity',
    tone: 'access',
    availableActions: [
      { label: 'View Active Sessions', routerLink: ['active-sessions'], primary: true }
    ],
    plannedActions: []
  }
];
