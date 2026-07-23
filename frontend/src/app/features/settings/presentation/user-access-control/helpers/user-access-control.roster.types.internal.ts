import {
  type PermissionGroup,
  type PermissionItem
} from '../../../../../core/authorization/permission-registry';

export type UserStatus = 'Active' | 'Suspended' | 'Invited';

export type UserRow = {
  id?: string;
  name: string;
  email: string;
  status: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  department?: string | null;
  position?: string | null;
  lastActive?: string | null;
  createdAt?: string | null;
  isEditing?: boolean;
  [key: string]: unknown;
};

export type PermissionAction = {
  key: string;
  label: string;
  perm: PermissionItem;
};

export type PermissionRow = {
  label: string;
  view?: PermissionItem;
  edit?: PermissionItem;
  create?: PermissionItem;
  delete?: PermissionItem;
  actions: PermissionAction[];
};

export type PermissionPage = {
  title: string;
  groups: PermissionGroup[];
};

export type PermissionSection = {
  title: string;
  pages: PermissionPage[];
};

export type PermissionRowInfo = {
  kind: 'view' | 'edit' | 'create' | 'delete' | 'action';
  base: string;
  actionLabel?: string;
};

export type GroupPath = {
  module: string;
  page: string;
  subgroup?: string;
};

export type RestoreCandidate = {
  id: string;
  email: string;
  name?: string | null;
};

export type ApiSubscription<T = unknown> = {
  subscribe: (handlers: { next?: (value: T) => void; error?: (err: unknown) => void }) => void;
};

export type HelperContext = {
  debugEnabled: boolean;
  rosterVisibleCount: number;
  rosterRoleFilter: string;
  rosterSort: string;
  rosterQuery: string;
  showSelectedOnly: boolean;
  rosterFallbackAttempted: boolean;
  resolveRosterPageSize: () => number;
  roleOptions: () => string[];
  normalizeRoles: (value: unknown) => string[];
  normalizeText: (value: unknown) => string;
  normalizeNullableText: (value: unknown) => string | null;
  normalizeStatusLabel: (value: string | null) => string | null;
  normalizeStatusFilter: () => string;
  normalizeRoleFilter: () => string;
  normalizeEmail: (value?: unknown) => string;
  normalizeRosterFilters: () => void;
  resolveUserId: (value: unknown) => string | null | undefined;
  resolveUserName: (value: unknown) => string;
  resolveDateField: (value: unknown, keys: string[]) => string | null;
  resolveAuthToken: () => string | null;
  getUserKey: (user: unknown) => string | null;
  selectedKeys: { (): Set<string>; set: (value: Set<string>) => void };
  extractPermissionList: (payload: unknown) => string[] | null;
  extractUsers: (response: unknown) => unknown[];
  extractUserListFrom: (candidate: unknown) => unknown[] | null;
  extractObjectMapValues: (candidate: unknown) => unknown[] | null;
  extractPermissionTree: (response: unknown) => PermissionGroup[];
  findUserArrayDeep: (root: unknown, maxDepth?: number) => unknown[] | null;
  collectUserObjects: (root: unknown) => unknown[];
  mapUser: (user: unknown, status: UserStatus) => UserRow | null;
  collectRoles: (users: UserRow[]) => string[];
  setAvailableRoles: (roles: string[]) => void;
  availableRoles: () => string[];
  roster: { (): UserRow[]; set: (value: UserRow[]) => void };
  resetRosterPagination: () => void;
  ensureRosterVisible: () => void;
  clearSelection: () => void;
  lastSync: { set: (value: string | null) => void };
  loading: { set: (value: boolean) => void };
  error: { set: (value: string | null) => void };
  restoreCandidate: { set: (value: RestoreCandidate | null) => void };
  toMessage: (value: unknown) => string | null;
  isUserLike: (value: unknown) => boolean;
  isUserArray: (value: unknown[]) => boolean;
  isObjectArray: (value: unknown[]) => boolean;
  unwrapUser: (payload: unknown) => unknown;
  hasUserIdentityFields: (value: unknown) => boolean;
  safeCompare: (a: unknown, b: unknown) => number;
  compareWithFallback: (primary: number, a: UserRow, b: UserRow) => number;
  getDateValue: (value?: string | null) => number;
  getStatusRank: (status?: string) => number;
  safeLower: (value: unknown) => string;
  userMatchesQuery: (user: UserRow, query: string) => boolean;
  compareUsers: (a: UserRow, b: UserRow) => number;
  ensureUserArray: (value: unknown) => UserRow[];
  permissionTree: { (): PermissionGroup[]; set: (value: PermissionGroup[]) => void };
  isModuleGroup: (group: PermissionGroup) => boolean;
  splitGroupByBase: (permissions: PermissionItem[]) => Map<string, PermissionItem[]>;
  resolveGroupPath: (group: PermissionGroup) => GroupPath;
  addPermissionGroup: (
    sections: Map<string, Map<string, PermissionGroup[]>>,
    moduleTitle: string,
    pageTitle: string,
    group: PermissionGroup
  ) => void;
  parsePermissionRow: (perm: PermissionItem) => PermissionRowInfo;
  normalizeActionLabel: (value: string) => string;
  humanizePermissionBase: (code: string) => string;
  extractActionFromCode: (code: string) => { base: string; action: string } | null;
  permissionTreeLoading: { set: (value: boolean) => void };
  permissionsLoading: { set: (value: boolean) => void };
  permissionsError: { set: (value: string | null) => void };
  permissionTreeLoaded: { set: (value: boolean) => void };
  displayedRoster: () => UserRow[];
  formatDate: (value?: string | null) => string;
  escapeCsv: (value: unknown) => string;
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
  api: {
    get: (path: string, query?: unknown, options?: unknown) => ApiSubscription;
  };
};
