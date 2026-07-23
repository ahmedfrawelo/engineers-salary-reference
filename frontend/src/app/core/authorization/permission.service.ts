import { Injectable, signal, computed } from '@angular/core';
import { PAGE_PERMISSION_GROUPS } from './permission-registry';

import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
type PagePermissionAction = 'view' | 'edit' | 'create' | 'delete';
type AccessControlPermissionKey =
  | 'viewUsers'
  | 'createUser'
  | 'editUser'
  | 'deleteUser'
  | 'manageRoles'
  | 'assignRoles'
  | 'managePermissions'
  | 'changePassword'
  | 'resetPassword';

const ACCESS_CONTROL_PAGE = 'settings.access_control';
const ACCESS_CONTROL_PAGE_VIEW = `${ACCESS_CONTROL_PAGE}.view`;
const ACCESS_CONTROL_PAGE_EDIT = `${ACCESS_CONTROL_PAGE}.edit`;

const ACCESS_CONTROL_IDENTITY_PERMISSIONS: Record<AccessControlPermissionKey, string> = {
  viewUsers: 'Permissions.Identity.ViewUsers',
  createUser: 'Permissions.Identity.CreateUser',
  editUser: 'Permissions.Identity.EditUser',
  deleteUser: 'Permissions.Identity.DeleteUser',
  manageRoles: 'Permissions.Identity.ManageRoles',
  assignRoles: 'Permissions.Identity.AssignRoles',
  managePermissions: 'Permissions.Identity.ManagePermissions',
  changePassword: 'Permissions.Identity.ChangePassword',
  resetPassword: 'Permissions.Identity.ResetPassword'
};

const PAGE_PERMISSION_ALIASES: Record<string, string[]> = {
  'settings.material_classification.view': ['settings.material_codes.view'],
  'settings.material_classification.edit': ['settings.material_codes.edit'],
  'settings.material_classification.create': ['settings.material_codes.create'],
  'settings.material_classification.delete': ['settings.material_codes.delete'],
  'settings.material_codes.view': ['settings.material_classification.view'],
  'settings.material_codes.edit': ['settings.material_classification.edit'],
  'settings.material_codes.create': ['settings.material_classification.create'],
  'settings.material_codes.delete': ['settings.material_classification.delete'],
  'tender.tasks.view': ['operations.tasks.view'],
  'tender.tasks.edit': ['operations.tasks.edit'],
  'operations.tasks.view': ['tender.tasks.view'],
  'operations.tasks.edit': ['tender.tasks.edit'],
  'inhand.tasks.view': ['operations.tasks.view'],
  'inhand.tasks.edit': ['operations.tasks.edit']
};

const IDENTITY_PERMISSION_CODES = [
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.viewUsers,
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.createUser,
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.editUser,
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.deleteUser,
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.manageRoles,
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.assignRoles,
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.managePermissions,
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.changePassword,
  ACCESS_CONTROL_IDENTITY_PERMISSIONS.resetPassword
] as const;

const PAGE_ENTITY_PERMISSION_FALLBACKS: Record<
  string,
  Partial<Record<PagePermissionAction, string[]>>
> = {
  'tender.projects': {
    view: [
      'Permissions.Project.View',
      'Permissions.Project.Edit',
      'Permissions.Project.Create',
      'Permissions.Project.Delete'
    ],
    edit: ['Permissions.Project.Edit'],
    create: ['Permissions.Project.Create'],
    delete: ['Permissions.Project.Delete']
  },
  'tender.suppliers': {
    view: [
      'Permissions.Supplier.View',
      'Permissions.Supplier.Edit',
      'Permissions.Supplier.Create',
      'Permissions.Supplier.Delete'
    ],
    edit: ['Permissions.Supplier.Edit'],
    create: ['Permissions.Supplier.Create'],
    delete: ['Permissions.Supplier.Delete']
  },
  'tender.boq': {
    view: [
      'Permissions.Boq.View',
      'Permissions.Boq.Edit',
      'Permissions.Boq.Create',
      'Permissions.Boq.Delete',
      'Permissions.BoqItem.View',
      'Permissions.BoqItem.Edit',
      'Permissions.BoqItem.Create',
      'Permissions.BoqItem.Delete',
      'Permissions.BoqVersion.View',
      'Permissions.BoqVersion.Edit',
      'Permissions.BoqVersion.Create',
      'Permissions.BoqVersion.Delete',
      'Permissions.BoqItemVersion.View',
      'Permissions.BoqItemVersion.Edit',
      'Permissions.BoqItemVersion.Create',
      'Permissions.BoqItemVersion.Delete'
    ],
    edit: [
      'Permissions.Boq.Edit',
      'Permissions.BoqItem.Edit',
      'Permissions.BoqVersion.Edit',
      'Permissions.BoqItemVersion.Edit'
    ],
    create: [
      'Permissions.Boq.Create',
      'Permissions.BoqItem.Create',
      'Permissions.BoqVersion.Create',
      'Permissions.BoqItemVersion.Create'
    ],
    delete: [
      'Permissions.Boq.Delete',
      'Permissions.BoqItem.Delete',
      'Permissions.BoqVersion.Delete',
      'Permissions.BoqItemVersion.Delete'
    ]
  },
  'settings.material_classification': {
    view: [
      'Permissions.Lookup.View',
      'Permissions.Lookup.Edit',
      'Permissions.Lookup.Create',
      'Permissions.Lookup.Delete',
      'Permissions.Country.View',
      'Permissions.Country.Edit',
      'Permissions.Country.Create',
      'Permissions.Country.Delete',
      'Permissions.Status.View',
      'Permissions.Status.Edit',
      'Permissions.Status.Create',
      'Permissions.Status.Delete',
      'Permissions.TenderStage.View',
      'Permissions.TenderStage.Edit',
      'Permissions.TenderStage.Create',
      'Permissions.TenderStage.Delete',
      'Permissions.TypeOfProject.View',
      'Permissions.TypeOfProject.Edit',
      'Permissions.TypeOfProject.Create',
      'Permissions.TypeOfProject.Delete',
      'Permissions.Tag.View',
      'Permissions.Tag.Edit',
      'Permissions.Tag.Create',
      'Permissions.Tag.Delete',
      'Permissions.UnitCategory.View',
      'Permissions.UnitCategory.Edit',
      'Permissions.UnitCategory.Create',
      'Permissions.UnitCategory.Delete',
      'Permissions.Family.View',
      'Permissions.Family.Edit',
      'Permissions.Family.Create',
      'Permissions.Family.Delete',
      'Permissions.FamilyLevelType.View',
      'Permissions.FamilyLevelType.Edit',
      'Permissions.FamilyLevelType.Create',
      'Permissions.FamilyLevelType.Delete',
      'Permissions.BuildingLevelType.View',
      'Permissions.BuildingLevelType.Edit',
      'Permissions.BuildingLevelType.Create',
      'Permissions.BuildingLevelType.Delete',
      'Permissions.Material.View',
      'Permissions.Material.Edit',
      'Permissions.Material.Create',
      'Permissions.Material.Delete',
      'Permissions.MaterialItem.View',
      'Permissions.MaterialItem.Edit',
      'Permissions.MaterialItem.Create',
      'Permissions.MaterialItem.Delete',
      'Permissions.MaterialLevelMap.View',
      'Permissions.MaterialLevelMap.Edit',
      'Permissions.MaterialLevelMap.Create',
      'Permissions.MaterialLevelMap.Delete',
      'Permissions.MaterialLevelType.View',
      'Permissions.MaterialLevelType.Edit',
      'Permissions.MaterialLevelType.Create',
      'Permissions.MaterialLevelType.Delete',
      'Permissions.ValueConversion.View',
      'Permissions.ValueConversion.Edit',
      'Permissions.ValueConversion.Create',
      'Permissions.ValueConversion.Delete'
    ],
    edit: [
      'Permissions.Lookup.Edit',
      'Permissions.Country.Edit',
      'Permissions.Status.Edit',
      'Permissions.TenderStage.Edit',
      'Permissions.TypeOfProject.Edit',
      'Permissions.Tag.Edit',
      'Permissions.UnitCategory.Edit',
      'Permissions.Family.Edit',
      'Permissions.FamilyLevelType.Edit',
      'Permissions.BuildingLevelType.Edit',
      'Permissions.Material.Edit',
      'Permissions.MaterialItem.Edit',
      'Permissions.MaterialLevelMap.Edit',
      'Permissions.MaterialLevelType.Edit',
      'Permissions.ValueConversion.Edit'
    ],
    create: [
      'Permissions.Lookup.Create',
      'Permissions.Country.Create',
      'Permissions.Status.Create',
      'Permissions.TenderStage.Create',
      'Permissions.TypeOfProject.Create',
      'Permissions.Tag.Create',
      'Permissions.UnitCategory.Create',
      'Permissions.Family.Create',
      'Permissions.FamilyLevelType.Create',
      'Permissions.BuildingLevelType.Create',
      'Permissions.Material.Create',
      'Permissions.MaterialItem.Create',
      'Permissions.MaterialLevelMap.Create',
      'Permissions.MaterialLevelType.Create',
      'Permissions.ValueConversion.Create'
    ],
    delete: [
      'Permissions.Lookup.Delete',
      'Permissions.Country.Delete',
      'Permissions.Status.Delete',
      'Permissions.TenderStage.Delete',
      'Permissions.TypeOfProject.Delete',
      'Permissions.Tag.Delete',
      'Permissions.UnitCategory.Delete',
      'Permissions.Family.Delete',
      'Permissions.FamilyLevelType.Delete',
      'Permissions.BuildingLevelType.Delete',
      'Permissions.Material.Delete',
      'Permissions.MaterialItem.Delete',
      'Permissions.MaterialLevelMap.Delete',
      'Permissions.MaterialLevelType.Delete',
      'Permissions.ValueConversion.Delete'
    ]
  },
  [ACCESS_CONTROL_PAGE]: {
    view: [...IDENTITY_PERMISSION_CODES],
    edit: IDENTITY_PERMISSION_CODES.filter(
      permission => permission !== ACCESS_CONTROL_IDENTITY_PERMISSIONS.viewUsers
    ),
    create: [ACCESS_CONTROL_IDENTITY_PERMISSIONS.createUser],
    delete: [ACCESS_CONTROL_IDENTITY_PERMISSIONS.deleteUser]
  }
};

function expandPermissionAliases(permission: string): string[] {
  return [permission, ...(PAGE_PERMISSION_ALIASES[permission] ?? [])];
}

function normalizePermissions(permissions: string[]): string[] {
  const unique = new Map<string, string>();
  permissions.flatMap(expandPermissionAliases).forEach(permission => {
    const value = permission?.trim();
    if (!value) {
      return;
    }
    const key = value.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, value);
    }
  });
  return Array.from(unique.values());
}

function normalizeRoleToken(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

type PermissionLookupState = {
  hasWildcard: boolean;
  normalized: Set<string>;
  prefixes: Set<string>;
};

function normalizePermissionKey(permission: string): string {
  return permission.trim().toLowerCase();
}

function buildPermissionPrefixes(permission: string): string[] {
  const normalized = normalizePermissionKey(permission);
  const prefixes: string[] = [];
  let separatorIndex = normalized.indexOf('.');

  while (separatorIndex >= 0) {
    prefixes.push(normalized.slice(0, separatorIndex + 1));
    separatorIndex = normalized.indexOf('.', separatorIndex + 1);
  }

  return prefixes;
}

function createPermissionLookupState(permissions: string[]): PermissionLookupState {
  const normalized = new Set<string>();
  const prefixes = new Set<string>();
  let hasWildcard = false;

  for (const permission of permissions) {
    const key = normalizePermissionKey(permission);
    if (!key) {
      continue;
    }

    normalized.add(key);
    if (key === '*') {
      hasWildcard = true;
      continue;
    }

    for (const prefix of buildPermissionPrefixes(key)) {
      prefixes.add(prefix);
    }
  }

  return { hasWildcard, normalized, prefixes };
}

function flattenMappedPermissions(
  mappedPermissions: Partial<Record<PagePermissionAction, string[]>>,
  action: PagePermissionAction
): string[] {
  const permissions =
    action === 'view'
      ? [
          ...(mappedPermissions.view ?? []),
          ...(mappedPermissions.edit ?? []),
          ...(mappedPermissions.create ?? []),
          ...(mappedPermissions.delete ?? [])
        ]
      : action === 'edit'
        ? [
            ...(mappedPermissions.edit ?? []),
            ...(mappedPermissions.create ?? []),
            ...(mappedPermissions.delete ?? [])
          ]
        : [...(mappedPermissions[action] ?? [])];

  return normalizePermissions(permissions);
}

function isAdministrativeRole(role: string): boolean {
  const normalized = normalizeRoleToken(role);
  return (
    normalized === 'admin' ||
    normalized === 'superadmin' ||
    normalized === 'administrator' ||
    normalized === 'systemadministrator'
  );
}

const PAGE_PERMISSIONS: Permission[] = PAGE_PERMISSION_GROUPS.flatMap(group =>
  group.permissions.map(permission => ({
    id: permission.code,
    name: permission.label || permission.code,
    category: 'pages'
  }))
);

const SECTION_FALLBACK_PERMISSIONS = Object.fromEntries(
  Object.entries(PAGE_ENTITY_PERMISSION_FALLBACKS).map(([pageId, mappedPermissions]) => [
    pageId,
    flattenMappedPermissions(mappedPermissions, 'view')
  ])
) as Record<string, string[]>;

const PAGE_ACTION_PERMISSION_LOOKUP = Object.fromEntries(
  Object.entries(PAGE_ENTITY_PERMISSION_FALLBACKS).map(([pageId, mappedPermissions]) => [
    pageId,
    {
      view: flattenMappedPermissions(mappedPermissions, 'view'),
      edit: flattenMappedPermissions(mappedPermissions, 'edit'),
      create: flattenMappedPermissions(mappedPermissions, 'create'),
      delete: flattenMappedPermissions(mappedPermissions, 'delete')
    }
  ])
) as Record<string, Record<PagePermissionAction, string[]>>;

/**
 * Permission Definition
 */
export interface Permission {
  /** Permission ID */
  id: string;
  /** Permission name */
  name: string;
  /** Permission description */
  description?: string;
  /** Permission category */
  category?: string;
}

/**
 * Role Definition
 */
export interface Role {
  /** Role ID */
  id: string;
  /** Role name */
  name: string;
  /** Role description */
  description?: string;
  /** Permissions granted to this role */
  permissions: string[];
}

/**
 * User Permissions
 */
export interface UserPermissions {
  roles: string[];
  permissions: string[];
}

/**
 * Permission Service
 *
 * Advanced authorization system with:
 * - Role-based access control (RBAC)
 * - Permission-based access control
 * - Feature flags
 * - Row-level security helpers
 *
 * @example
 * ```typescript
 * // Check permission
 * if (this.permission.can('suppliers.edit')) {
 *   // Allow edit
 * }
 *
 * // Check multiple permissions (OR)
 * if (this.permission.canAny(['suppliers.edit', 'suppliers.delete'])) {
 *   // Allow if user has LooseValue of these permissions
 * }
 *
 * // Check multiple permissions (AND)
 * if (this.permission.canAll(['suppliers.view', 'suppliers.edit'])) {
 *   // Allow only if user has all permissions
 * }
 *
 * // Check role
 * if (this.permission.hasRole('admin')) {
 *   // Allow
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  // User permissions state
  private _userPermissions = signal<UserPermissions>({
    roles: [],
    permissions: []
  });

  readonly userPermissions = this._userPermissions.asReadonly();

  // Available permissions registry
  private _availablePermissions = signal<Permission[]>([
    ...PAGE_PERMISSIONS,
    // Suppliers
    { id: 'suppliers.view', name: 'View Suppliers', category: 'suppliers' },
    { id: 'suppliers.create', name: 'Create Suppliers', category: 'suppliers' },
    { id: 'suppliers.edit', name: 'Edit Suppliers', category: 'suppliers' },
    { id: 'suppliers.delete', name: 'Delete Suppliers', category: 'suppliers' },

    // Projects
    { id: 'projects.view', name: 'View Projects', category: 'projects' },
    { id: 'projects.create', name: 'Create Projects', category: 'projects' },
    { id: 'projects.edit', name: 'Edit Projects', category: 'projects' },
    { id: 'projects.delete', name: 'Delete Projects', category: 'projects' },

    // Tender
    { id: 'tender.view', name: 'View Tender', category: 'tender' },
    { id: 'tender.create', name: 'Create Tender', category: 'tender' },
    { id: 'tender.edit', name: 'Edit Tender', category: 'tender' },
    { id: 'tender.delete', name: 'Delete Tender', category: 'tender' },
    { id: 'tender.approve', name: 'Approve Tender', category: 'tender' },

    // BOQ
    { id: 'boq.view', name: 'View BOQ', category: 'boq' },
    { id: 'boq.edit', name: 'Edit BOQ', category: 'boq' },
    { id: 'boq.import', name: 'Import BOQ', category: 'boq' },
    { id: 'boq.export', name: 'Export BOQ', category: 'boq' },

    // Materials
    { id: 'materials.view', name: 'View Materials', category: 'materials' },
    { id: 'materials.edit', name: 'Edit Materials', category: 'materials' },
    { id: 'materials.delete', name: 'Delete Materials', category: 'materials' },

    // Stores
    { id: 'stores.view', name: 'View Stores', category: 'stores' },
    { id: 'stores.manage', name: 'Manage Stores', category: 'stores' },

    // Procurement
    { id: 'procurement.view', name: 'View Procurement', category: 'procurement' },
    { id: 'procurement.create', name: 'Create Procurement', category: 'procurement' },
    { id: 'procurement.approve', name: 'Approve Procurement', category: 'procurement' },

    // Settings
    { id: 'settings.view', name: 'View Settings', category: 'settings' },
    { id: 'settings.edit', name: 'Edit Settings', category: 'settings' },
    { id: 'users.manage', name: 'Manage Users', category: 'settings' },

    // Reports
    { id: 'reports.view', name: 'View Reports', category: 'reports' },
    { id: 'reports.export', name: 'Export Reports', category: 'reports' }
  ]);

  readonly availablePermissions = this._availablePermissions.asReadonly();

  // Available roles
  private _availableRoles = signal<Role[]>([
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      permissions: ['*'] // All permissions
    },
    {
      id: 'manager',
      name: 'Manager',
      description: 'Can manage projects and approve tenders',
      permissions: [
        'suppliers.view',
        'suppliers.edit',
        'projects.view',
        'projects.create',
        'projects.edit',
        'tender.view',
        'tender.create',
        'tender.edit',
        'tender.approve',
        'boq.view',
        'boq.edit',
        'boq.import',
        'boq.export',
        'materials.view',
        'materials.edit',
        'stores.view',
        'procurement.view',
        'procurement.create',
        'procurement.approve',
        'reports.view',
        'reports.export'
      ]
    },
    {
      id: 'engineer',
      name: 'Engineer',
      description: 'Can view and edit BOQs and projects',
      permissions: [
        'suppliers.view',
        'projects.view',
        'projects.edit',
        'tender.view',
        'tender.edit',
        'boq.view',
        'boq.edit',
        'boq.import',
        'boq.export',
        'materials.view',
        'reports.view'
      ]
    },
    {
      id: 'procurement_officer',
      name: 'Procurement Officer',
      description: 'Can manage procurement and stores',
      permissions: [
        'suppliers.view',
        'suppliers.edit',
        'materials.view',
        'stores.view',
        'stores.manage',
        'procurement.view',
        'procurement.create',
        'reports.view'
      ]
    },
    {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access',
      permissions: [
        'suppliers.view',
        'projects.view',
        'tender.view',
        'boq.view',
        'materials.view',
        'stores.view',
        'procurement.view',
        'reports.view'
      ]
    }
  ]);

  readonly availableRoles = this._availableRoles.asReadonly();

  // Computed permissions (expanded from roles)
  readonly effectivePermissions = computed(() => {
    const user = this._userPermissions();
    const roles = this._availableRoles();

    // Accept both compact ids ("Admin") and backend/display variants ("Administrator").
    const isAdmin = user.roles.some(isAdministrativeRole);
    if (isAdmin) return ['*'];

    // Get permissions from roles
    const rolePermissions = user.roles.flatMap(roleId => {
      const normalizedRoleId = normalizeRoleToken(roleId);
      const role = roles.find(
        r =>
          normalizeRoleToken(r.id) === normalizedRoleId ||
          normalizeRoleToken(r.name) === normalizedRoleId
      );
      return role?.permissions || [];
    });

    // Combine with direct permissions
    const allPermissions = [...new Set([...rolePermissions, ...user.permissions])];

    // Check for wildcard (legacy hardcoded roles)
    if (allPermissions.includes('*')) {
      return allPermissions;
    }

    return allPermissions;
  });

  private readonly effectivePermissionLookup = computed(() =>
    createPermissionLookupState(this.effectivePermissions())
  );

  private readonly normalizedRoleLookup = computed(
    () => new Set(this._userPermissions().roles.map(normalizeRoleToken))
  );

  /**
   * Set user permissions
   * @param permissions User roles and permissions
   */
  setUserPermissions(permissions: UserPermissions): void {
    this._userPermissions.set({
      roles: permissions.roles,
      permissions: normalizePermissions(permissions.permissions)
    });
  }

  /**
   * Load user permissions from auth service
   * This should be called after login
   */
  loadUserPermissions(user: { roles?: string[]; permissions?: string[] }): void {
    this._userPermissions.set({
      roles: user.roles || [],
      permissions: normalizePermissions(user.permissions || [])
    });
  }

  /**
   * Check if user has permission
   * @param permission Permission ID (e.g., 'suppliers.edit')
   */
  can(permission: string): boolean {
    return this.matchesPermission(permission, this.effectivePermissionLookup());
  }

  /**
   * Check if user has LooseValue of the permissions (OR)
   * @param permissions Array of permission IDs
   */
  canAny(permissions: string[]): boolean {
    const lookup = this.effectivePermissionLookup();
    return permissions.some(permission => this.matchesPermission(permission, lookup));
  }

  /**
   * Check if user has all of the permissions (AND)
   * @param permissions Array of permission IDs
   */
  canAll(permissions: string[]): boolean {
    const lookup = this.effectivePermissionLookup();
    return permissions.every(permission => this.matchesPermission(permission, lookup));
  }

  /**
   * Check if user can view a page (view or edit implies view)
   * @param pageId Page permission base (e.g., 'tender.dashboard')
   */
  canViewPage(pageId: string): boolean {
    if (environment.bypassPermissionsInDevelopment) {
      return true;
    }
    return this.canPerformPageAction(pageId, 'view');
  }

  /**
   * Check if user can edit a page
   * @param pageId Page permission base (e.g., 'tender.dashboard')
   */
  canEditPage(pageId: string): boolean {
    return this.canPerformPageAction(pageId, 'edit');
  }

  /**
   * Check if user can create items on a page
   * @param pageId Page permission base (e.g., 'tender.suppliers')
   */
  canCreatePage(pageId: string): boolean {
    return this.canPerformPageAction(pageId, 'create');
  }

  /**
   * Check if user can delete items on a page
   * @param pageId Page permission base (e.g., 'tender.suppliers')
   */
  canDeletePage(pageId: string): boolean {
    return this.canPerformPageAction(pageId, 'delete');
  }

  canViewField(permissionBase: string, fallbackPermissions: string[] = []): boolean {
    const lookup = this.effectivePermissionLookup();
    const expandedFallbacks = fallbackPermissions.flatMap(permission =>
      permission.endsWith('.View') ? [permission, permission.slice(0, -5) + '.Edit'] : [permission]
    );
    const candidates = [`${permissionBase}.View`, `${permissionBase}.Edit`];
    if (this.usesScopedFieldPermissions(permissionBase, lookup)) {
      return candidates.some(candidate => this.matchesPermission(candidate, lookup));
    }
    return normalizePermissions([...candidates, ...expandedFallbacks]).some(candidate =>
      this.matchesPermission(candidate, lookup)
    );
  }

  canEditField(permissionBase: string, fallbackPermissions: string[] = []): boolean {
    const lookup = this.effectivePermissionLookup();
    const candidates = [`${permissionBase}.Edit`];
    if (this.usesScopedFieldPermissions(permissionBase, lookup)) {
      return candidates.some(candidate => this.matchesPermission(candidate, lookup));
    }
    return normalizePermissions([...candidates, ...fallbackPermissions]).some(candidate =>
      this.matchesPermission(candidate, lookup)
    );
  }

  /**
   * Check if user has ANY permission under a section prefix.
   * Used for sidebar visibility — if user has any sub-permission, show the section.
   * @param prefix Section prefix, e.g. 'tender.projects', 'inhand.document_control'
   */
  canViewSection(prefix: string): boolean {
    if (environment.bypassPermissionsInDevelopment) {
      return true;
    }

    const lookup = this.effectivePermissionLookup();
    if (lookup.hasWildcard) {
      return true;
    }

    if (lookup.prefixes.has(normalizePermissionKey(prefix) + '.')) {
      return true;
    }

    const fallbackPermissions = SECTION_FALLBACK_PERMISSIONS[prefix];
    if (!fallbackPermissions) {
      return false;
    }

    return fallbackPermissions.some(permission => this.matchesPermission(permission, lookup));
  }

  canAccessSection(sectionKey?: string | null): boolean {
    return !sectionKey || this.canViewSection(sectionKey);
  }

  /**
   * Check if user has role
   * @param role Role ID
   */
  hasRole(role: string): boolean {
    return this.normalizedRoleLookup().has(normalizeRoleToken(role));
  }

  /**
   * Check if user has LooseValue of the roles (OR)
   * @param roles Array of role IDs
   */
  hasAnyRole(roles: string[]): boolean {
    return roles.some(r => this.hasRole(r));
  }

  /**
   * Check if user has all of the roles (AND)
   * @param roles Array of role IDs
   */
  hasAllRoles(roles: string[]): boolean {
    return roles.every(r => this.hasRole(r));
  }

  /**
   * Get all permissions for a category
   * @param category Permission category
   */
  getPermissionsByCategory(category: string): Permission[] {
    return this._availablePermissions().filter(p => p.category === category);
  }

  /**
   * Get role by ID
   * @param roleId Role ID
   */
  getRole(roleId: string): Role | undefined {
    const normalizedRoleId = roleId.toLowerCase();
    return this._availableRoles().find(r => r.id.toLowerCase() === normalizedRoleId);
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return (
      this.effectivePermissionLookup().hasWildcard ||
      this._userPermissions().roles.some(isAdministrativeRole)
    );
  }

  /**
   * Clear user permissions (logout)
   */
  clear(): void {
    this._userPermissions.set({
      roles: [],
      permissions: []
    });
  }

  canViewAccessControl(): boolean {
    return this.canViewPage(ACCESS_CONTROL_PAGE);
  }

  canCreateAccessControlUsers(): boolean {
    return this.canAccessControlAction(ACCESS_CONTROL_IDENTITY_PERMISSIONS.createUser);
  }

  canEditAccessControlUsers(): boolean {
    return this.canAccessControlAction(ACCESS_CONTROL_IDENTITY_PERMISSIONS.editUser);
  }

  canDeleteAccessControlUsers(): boolean {
    return this.canAccessControlAction(ACCESS_CONTROL_IDENTITY_PERMISSIONS.deleteUser);
  }

  canManageAccessControlRoles(): boolean {
    return this.canAccessControlAction(ACCESS_CONTROL_IDENTITY_PERMISSIONS.manageRoles);
  }

  canAssignAccessControlRoles(): boolean {
    return this.canAccessControlAction(ACCESS_CONTROL_IDENTITY_PERMISSIONS.assignRoles);
  }

  canManageAccessControlPermissions(): boolean {
    return this.canAccessControlAction(ACCESS_CONTROL_IDENTITY_PERMISSIONS.managePermissions);
  }

  canResetAccessControlPasswords(): boolean {
    return this.canAccessControlAction(ACCESS_CONTROL_IDENTITY_PERMISSIONS.resetPassword);
  }

  canChangeAccessControlPasswords(): boolean {
    return this.canAccessControlAction(ACCESS_CONTROL_IDENTITY_PERMISSIONS.changePassword);
  }

  private canPerformPageAction(pageId: string, action: PagePermissionAction): boolean {
    const lookup = this.effectivePermissionLookup();
    const directCandidates = [`${pageId}.${action}`];

    if (action === 'view') {
      directCandidates.push(`${pageId}.edit`);
      directCandidates.push(`${pageId}.create`);
      directCandidates.push(`${pageId}.delete`);
    }

    if (directCandidates.some(candidate => this.matchesPermission(candidate, lookup))) {
      return true;
    }

    return this.getMappedActionPermissions(pageId, action).some(permission =>
      this.matchesPermission(permission, lookup)
    );
  }

  private getMappedActionPermissions(pageId: string, action: PagePermissionAction): string[] {
    return PAGE_ACTION_PERMISSION_LOOKUP[pageId]?.[action] ?? [];
  }

  private canAccessControlAction(identityPermission: string): boolean {
    return this.can(identityPermission);
  }

  private matchesPermission(permission: string, lookup: PermissionLookupState): boolean {
    if (lookup.hasWildcard) {
      return true;
    }

    return expandPermissionAliases(permission).some(candidate =>
      lookup.normalized.has(normalizePermissionKey(candidate))
    );
  }

  private usesScopedFieldPermissions(
    permissionBase: string,
    lookup: PermissionLookupState
  ): boolean {
    if (lookup.hasWildcard) {
      return false;
    }

    const marker = permissionBase.slice(0, permissionBase.lastIndexOf('.') + 1).toLowerCase();
    return lookup.prefixes.has(marker);
  }
}

/**
 * Permission Directive Helper
 * You can create a directive using this service
 *
 * @example
 * ```typescript
 * @Directive({ selector: '[canAccess]' })
 * export class CanAccessDirective {
 *   @Input() canAccess!: string;
 *
 *   constructor(
 *     private permission: PermissionService,
 *     private templateRef: TemplateRef<LooseValue>,
 *     private viewContainer: ViewContainerRef
 *   ) {}
 *
 *   ngOnInit() {
 *     if (this.permission.can(this.canAccess)) {
 *       this.viewContainer.createEmbeddedView(this.templateRef);
 *     } else {
 *       this.viewContainer.clear();
 *     }
 *   }
 * }
 * ```
 */
