import type { MenuItem } from './app-navigation.data';

export interface AppSearchStaticDestination extends MenuItem {
  sectionLabel: string;
  contextTerms?: string[];
}

// Keep nested search destinations static so the app shell can search lazy pages
// without importing route trees into the root bundle.
export const APP_SEARCH_SUBPAGE_DESTINATIONS: AppSearchStaticDestination[] = [
  {
    key: 'settings-access-control',
    label: 'Access Control',
    ico: 'shield-lock',
    path: 'settings/access-control',
    sectionKey: 'settings.access_control',
    sectionLabel: 'Settings',
    contextTerms: ['Settings'],
    searchTerms: ['permissions', 'roles', 'user access']
  },
  {
    key: 'settings-appearance',
    label: 'Appearance',
    ico: 'palette',
    path: 'settings/appearance',
    sectionKey: 'settings.appearance',
    sectionLabel: 'Settings',
    contextTerms: ['Settings'],
    searchTerms: ['theme', 'display settings']
  }
];
