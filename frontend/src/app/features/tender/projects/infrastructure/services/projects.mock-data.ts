import type { TenderProject } from './projects.api';
import type {
  Country,
  DegreeOfImportance,
  Owner,
  OwnerType,
  Status,
  TenderStage,
  TypeOfProject
} from '@shared/services/lookups.api';

const statuses: Status[] = [
  { id: 1, name: 'New' },
  { id: 2, name: 'Under Study' },
  { id: 3, name: 'Pricing' },
  { id: 4, name: 'Submitted' },
  { id: 5, name: 'Won' },
  { id: 6, name: 'Lost' },
  { id: 7, name: 'On Hold' }
];

const stages: TenderStage[] = [
  { id: 1, name: 'Prequalification' },
  { id: 2, name: 'Technical Submission' },
  { id: 3, name: 'Commercial Submission' },
  { id: 4, name: 'Negotiation' },
  { id: 5, name: 'Award' }
];

const types: TypeOfProject[] = [
  { id: 1, name: 'Infrastructure' },
  { id: 2, name: 'Residential' },
  { id: 3, name: 'Healthcare' },
  { id: 4, name: 'Hospitality' }
];

const degrees: DegreeOfImportance[] = [
  { id: 1, name: 'Critical' },
  { id: 2, name: 'High' },
  { id: 3, name: 'Medium' },
  { id: 4, name: 'Low' }
];

const countries: Country[] = [
  { id: 1, name: 'Saudi Arabia' },
  { id: 2, name: 'Egypt' },
  { id: 3, name: 'UAE' }
];

const owners: Owner[] = [
  { id: 1, name: 'Aurora Developers', email: 'aurora@engineers-salary-reference.sa', countryId: 1 },
  { id: 2, name: 'Helios Construction', email: 'contact@helios.sa', countryId: 1 },
  { id: 3, name: 'Delta Housing', email: 'info@deltahousing.eg', countryId: 2 },
  { id: 4, name: 'Palm Resorts', email: 'projects@palmresorts.ae', countryId: 3 }
];

const ownerTypes: OwnerType[] = [
  { id: 1, name: 'Government' },
  { id: 2, name: 'Private' },
  { id: 3, name: 'Developer' },
  { id: 4, name: 'Joint Venture' }
];

const projects: TenderProject[] = [
  {
    id: 1,
    name: 'Riyadh Metro Extension',
    ownerId: 1,
    ownerName: owners[0].name,
    ownerTypeId: 1,
    ownerTypeName: ownerTypes[0].name,
    statusId: 2,
    statusName: statuses[1].name,
    tenderStageId: 2,
    tenderStageName: stages[1].name,
    typeOfProjectId: 1,
    typeOfProjectName: types[0].name,
    degreeOfImportanceId: 1,
    degreeOfImportanceName: degrees[0].name,
    countryId: 1,
    countryName: countries[0].name,
    assignTo: 'Sultan Ahmed',
    inCharge: 'Omar Khalid',
    consultant: 'AECOM',
    startDate: '2025-02-01',
    acceptDate: '2025-03-14',
    deadline: '2025-06-30',
    endDate: null,
    price: 2800000000,
    prb: 0.4,
    delayReasons: null,
    description: null,
    tone: null,
    customLabel: null,
    createdAt: null
  },
  {
    id: 2,
    name: 'NEOM Hospitality Cluster',
    ownerId: 2,
    ownerName: owners[1].name,
    ownerTypeId: 3,
    ownerTypeName: ownerTypes[2].name,
    statusId: 3,
    statusName: statuses[2].name,
    tenderStageId: 3,
    tenderStageName: stages[2].name,
    typeOfProjectId: 4,
    typeOfProjectName: types[3].name,
    degreeOfImportanceId: 1,
    degreeOfImportanceName: degrees[0].name,
    countryId: 1,
    countryName: countries[0].name,
    assignTo: 'Layla Faris',
    inCharge: 'Mansour Ali',
    consultant: 'Atkins',
    startDate: '2025-01-10',
    acceptDate: '2025-02-18',
    deadline: '2025-05-22',
    endDate: null,
    price: 1750000000,
    prb: 0.25,
    delayReasons: null,
    description: null,
    tone: null,
    customLabel: null,
    createdAt: null
  },
  {
    id: 3,
    name: 'Cairo Medical City',
    ownerId: 3,
    ownerName: owners[2].name,
    ownerTypeId: 2,
    ownerTypeName: ownerTypes[1].name,
    statusId: 1,
    statusName: statuses[0].name,
    tenderStageId: 1,
    tenderStageName: stages[0].name,
    typeOfProjectId: 3,
    typeOfProjectName: types[2].name,
    degreeOfImportanceId: 2,
    degreeOfImportanceName: degrees[1].name,
    countryId: 2,
    countryName: countries[1].name,
    assignTo: 'Hossam Emad',
    inCharge: 'Mariam Fouad',
    consultant: 'Dar',
    startDate: null,
    acceptDate: null,
    deadline: '2025-07-15',
    endDate: null,
    price: 820000000,
    prb: 0.6,
    delayReasons: null,
    description: null,
    tone: null,
    customLabel: null,
    createdAt: null
  },
  {
    id: 4,
    name: 'Dubai Marina Residences',
    ownerId: 4,
    ownerName: owners[3].name,
    ownerTypeId: 4,
    ownerTypeName: ownerTypes[3].name,
    statusId: 4,
    statusName: statuses[3].name,
    tenderStageId: 4,
    tenderStageName: stages[3].name,
    typeOfProjectId: 2,
    typeOfProjectName: types[1].name,
    degreeOfImportanceId: 3,
    degreeOfImportanceName: degrees[2].name,
    countryId: 3,
    countryName: countries[2].name,
    assignTo: 'Noura Hassan',
    inCharge: 'Yousef Rahman',
    consultant: 'WSP',
    startDate: '2024-11-01',
    acceptDate: '2025-01-05',
    deadline: '2025-04-12',
    endDate: null,
    price: 960000000,
    prb: 0.18,
    delayReasons: 'Pending client revisions',
    description: null,
    tone: null,
    customLabel: null,
    createdAt: null
  }
];

export const MOCK_LOOKUPS = {
  statuses,
  stages,
  types,
  degrees,
  owners,
  ownerTypes,
  countries
};

export const MOCK_PROJECTS = projects;

export const mockLookupStore = {
  statuses: statuses.map(s => ({ ...s })),
  stages: stages.map(s => ({ ...s })),
  types: types.map(t => ({ ...t })),
  degrees: degrees.map(d => ({ ...d })),
  owners: owners.map(o => ({ ...o })),
  ownerTypes: ownerTypes.map(o => ({ ...o })),
  countries: countries.map(c => ({ ...c }))
};

export const mockProjectStore: TenderProject[] = projects.map(p => JSON.parse(JSON.stringify(p)));

export const mockProjectIdSeed = projects.reduce((max, item) => Math.max(max, item.id), 0) + 1;
