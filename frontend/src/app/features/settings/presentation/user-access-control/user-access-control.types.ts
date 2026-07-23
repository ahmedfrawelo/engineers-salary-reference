import type {
  PermissionGroup,
  PermissionItem
} from '../../../../core/authorization/permission-registry';

export type AccessTab = 'profile' | 'permissions' | 'audit';
export type PermissionScope = 'role' | 'user';

export type UserDraft = {
  name: string;
  email: string;
  status: string;
  role: string;
  department: string;
  position: string;
  phoneNumber: string;
  password: string;
};

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
  phoneNumber?: string | null;
  // Activity
  lastActive?: string | null;
  createdAt?: string | null;
  loginCount?: number;
  // Security
  emailConfirmed?: boolean;
  twoFactorEnabled?: boolean;
  failedAttempts?: number;
  lockedUntil?: string | null;
  // Audit
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  isQuickEditing?: boolean;
  quickEdit?: {
    status: string;
    role: string;
  };
  edit?: UserDraft;
  isEditing?: boolean;
};

export type RoleItem = {
  id: string;
  name: string;
  normalizedName?: string | null;
  isEditing?: boolean;
  editName?: string;
};

export type RoleUserItem = {
  id: string;
  email?: string | null;
  name?: string | null;
  isActive: boolean;
};

export type PermissionRow = {
  label: string;
  view?: PermissionItem;
  edit?: PermissionItem;
  create?: PermissionItem;
  delete?: PermissionItem;
  actions: PermissionAction[];
};

export type PermissionAction = {
  key: string;
  label: string;
  perm: PermissionItem;
};

export type PermissionPage = {
  title: string;
  groups: PermissionGroup[];
};

export type PermissionSection = {
  title: string;
  pages: PermissionPage[];
};

export type PermissionListPagePayload = {
  sectionTitle: string;
  page: PermissionPage;
};

export type RestoreCandidate = {
  id: string;
  email: string;
  name?: string | null;
};
