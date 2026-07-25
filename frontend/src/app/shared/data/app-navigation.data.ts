export type Area = 'Tender';

export type MenuItem = {
  key: string;
  label: string;
  ico: string;
  path: string;
  externalUrl?: string;
  disabled?: boolean;
  availabilityLabel?: string;
  searchTerms?: string[];
  sectionKey?: string;
};

export const AREA_ICONS: Record<Area, string> = {
  Tender: 'file-earmark-text'
};

export const AREA_LABELS: Record<Area, string> = {
  Tender: 'Salary Reference'
};

export const AREA_ORDER: Area[] = ['Tender'];

export const APP_SHELL_ITEMS: MenuItem[] = [
  {
    key: 'app-dashboard',
    label: 'Dashboard',
    ico: 'home-03',
    path: 'dashboard',
    searchTerms: ['home', 'overview', 'general dashboard', 'main dashboard']
  }
];

export const ABOUT_DEVELOPER_ITEM: MenuItem = {
  key: 'about-developer',
  label: 'About Developer',
  ico: 'user',
  path: 'about-developer',
  externalUrl: 'https://ahmed-frawelo.pages.dev/en',
  searchTerms: ['about', 'developer', 'ahmed', 'frawelo', 'portfolio']
};

export const INFORMATION_SOURCE_ITEM: MenuItem = {
  key: 'information-source',
  label: 'Information Source',
  ico: 'link-dots',
  path: 'information-source',
  externalUrl: 'https://www.linkedin.com/in/mechahmedradwan/',
  searchTerms: ['information source', 'linkedin', 'source', 'ahmed radwan', 'mechahmedradwan']
};

export const AREA_MENUS: Record<Area, MenuItem[]> = {
  Tender: [
    {
      key: 'salary-reports',
      label: 'Salary Reports',
      ico: 'folder2-open',
      path: 'salary-reports'
    },
    {
      key: 'submit-salary-report',
      label: 'Submit Report',
      ico: 'file-add',
      path: 'submit-report'
    }
  ]
};
