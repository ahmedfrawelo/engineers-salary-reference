import {
  type PermissionGroup,
  type PermissionItem,
  PAGE_PERMISSION_GROUPS,
  mergePermissionGroups
} from '../../../../../core/authorization/permission-registry';
import type {
  GroupPath,
  HelperContext,
  PermissionAction,
  PermissionPage,
  PermissionRow,
  PermissionRowInfo,
  PermissionSection,
  UserRow,
  UserStatus
} from './user-access-control.roster.types.internal';

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const PERMISSION_TREE_CACHE_KEY = 'engineers-salary-reference.portal.access-control.permission-tree';

function readPermissionTreeCache(): PermissionGroup[] | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(PERMISSION_TREE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const groups = parsed
      .map(item => {
        const groupRecord = toRecord(item);
        const groupName = typeof groupRecord.group === 'string' ? groupRecord.group.trim() : '';
        const permissions = Array.isArray(groupRecord.permissions)
          ? groupRecord.permissions
              .map(permission => {
                const permissionRecord = toRecord(permission);
                const code = typeof permissionRecord.code === 'string' ? permissionRecord.code : '';
                const label =
                  typeof permissionRecord.label === 'string' ? permissionRecord.label : '';
                return code ? { code, label } : null;
              })
              .filter((permission): permission is NonNullable<typeof permission> => !!permission)
          : [];

        return groupName && permissions.length ? { group: groupName, permissions } : null;
      })
      .filter((group): group is PermissionGroup => !!group);

    return groups.length ? groups : null;
  } catch {
    return null;
  }
}

function writePermissionTreeCache(groups: PermissionGroup[]): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(PERMISSION_TREE_CACHE_KEY, JSON.stringify(groups));
  } catch {
    // Ignore storage failures.
  }
}

function clearPermissionTreeCache(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(PERMISSION_TREE_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function permissionSectionsHelper(
  ctx: HelperContext,
  ...args: unknown[]
): PermissionSection[] {
  const sections = new Map<string, Map<string, PermissionGroup[]>>();
  const groups = ctx.permissionTree();

  for (const group of groups) {
    if (!group?.group) {
      continue;
    }
    if (ctx.isModuleGroup(group)) {
      const pageGroups = ctx.splitGroupByBase(group.permissions);
      for (const [pageTitle, perms] of pageGroups.entries()) {
        const accessGroup: PermissionGroup = {
          group: 'Page Access',
          permissions: perms
        };
        ctx.addPermissionGroup(sections, group.group, pageTitle, accessGroup);
      }
      continue;
    }

    const resolved = ctx.resolveGroupPath(group);
    const subgroup: PermissionGroup = {
      group: resolved.subgroup || group.group,
      permissions: group.permissions
    };
    ctx.addPermissionGroup(sections, resolved.module, resolved.page, subgroup);
  }

  const moduleOrder = [
    'Tender',
    'CRM',
    'Materials',
    'Settings',
    'Identity & Access',
    'Account',
    'Operations',
    'HR',
    'In-Hand'
  ];
  const result: PermissionSection[] = [];
  const moduleKeys = Array.from(sections.keys());
  moduleKeys.sort((a, b) => {
    const indexA = moduleOrder.indexOf(a);
    const indexB = moduleOrder.indexOf(b);
    if (indexA !== -1 || indexB !== -1) {
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }
    return a.localeCompare(b);
  });

  for (const moduleTitle of moduleKeys) {
    const pagesMap = sections.get(moduleTitle) as Map<string, PermissionGroup[]>;
    const pageTitles = Array.from(pagesMap.keys()).sort((a, b) => a.localeCompare(b));
    const pages: PermissionPage[] = pageTitles.map(pageTitle => ({
      title: pageTitle,
      groups: pagesMap.get(pageTitle) || []
    }));
    result.push({ title: moduleTitle, pages });
  }

  return result;
}

export function parsePermissionRowHelper(
  ctx: HelperContext,
  ...args: unknown[]
): PermissionRowInfo {
  const [perm] = args;
  const permRecord = toRecord(perm);
  const label = ctx.normalizeText(permRecord.label || '');
  const code = ctx.normalizeText(permRecord.code || '');
  const fallback = label || code || 'Permission';

  const dashMatch = label.match(/^(.*)\s*-\s*(View|Edit|Create|Delete)\s*$/i);
  if (dashMatch) {
    return {
      kind: dashMatch[2].toLowerCase() as 'view' | 'edit' | 'create' | 'delete',
      base: dashMatch[1].trim() || fallback
    };
  }

  const prefixMatch = label.match(/^(View|Edit|Create|Delete)\s+(.*)$/i);
  if (prefixMatch) {
    return {
      kind: prefixMatch[1].toLowerCase() as 'view' | 'edit' | 'create' | 'delete',
      base: prefixMatch[2].trim() || fallback
    };
  }

  const actionMatch = label.match(
    /^(Create|Delete|Manage|Assign|Approve|Reset|Change|Export|Import|Archive|Restore)\s+(.*)$/i
  );
  if (actionMatch) {
    return {
      kind: 'action',
      base: actionMatch[2].trim() || fallback,
      actionLabel: ctx.normalizeActionLabel(actionMatch[1])
    };
  }

  const lowerCode = code.toLowerCase();
  if (lowerCode.endsWith('.view')) {
    return { kind: 'view', base: label || ctx.humanizePermissionBase(code) };
  }
  if (lowerCode.endsWith('.edit')) {
    return { kind: 'edit', base: label || ctx.humanizePermissionBase(code) };
  }
  if (lowerCode.endsWith('.create')) {
    return { kind: 'create', base: label || ctx.humanizePermissionBase(code) };
  }
  if (lowerCode.endsWith('.delete')) {
    return { kind: 'delete', base: label || ctx.humanizePermissionBase(code) };
  }

  const actionFromCode = ctx.extractActionFromCode(code);
  if (actionFromCode) {
    return {
      kind: 'action',
      base: actionFromCode.base,
      actionLabel: actionFromCode.action
    };
  }

  return { kind: 'action', base: fallback, actionLabel: 'Allow' };
}

export function resolveGroupPathHelper(ctx: HelperContext, ...args: unknown[]): GroupPath {
  const [group] = args;
  const groupRecord = toRecord(group);
  const rawGroup = ctx.normalizeText(groupRecord.group || '');
  const normalized = rawGroup.toLowerCase().trim();

  // Comprehensive mapping for all backend entity groups → module / page
  const entityGroupMap: Record<string, { module: string; page: string }> = {
    // ── Identity & Access ─────────────────────────────────────────────
    identity: { module: 'Identity & Access', page: 'Users & Roles' },

    // ── Tender ────────────────────────────────────────────────────────
    project: { module: 'Tender', page: 'Projects' },
    'project fields': { module: 'Tender', page: 'Projects' },
    checklist: { module: 'Tender', page: 'Projects' },
    checklists: { module: 'Tender', page: 'Projects' },
    'checklist fields': { module: 'Tender', page: 'Projects' },
    'check list': { module: 'Tender', page: 'Projects' },
    'check list fields': { module: 'Tender', page: 'Projects' },
    building: { module: 'Tender', page: 'Projects' },
    boq: { module: 'Tender', page: 'BOQ' },
    'boq fields': { module: 'Tender', page: 'BOQ' },
    'boq item': { module: 'Tender', page: 'BOQ' },
    'boq item fields': { module: 'Tender', page: 'BOQ' },
    'boq item version': { module: 'Tender', page: 'BOQ' },
    'boq item version fields': { module: 'Tender', page: 'BOQ' },
    'boq version': { module: 'Tender', page: 'BOQ' },
    'boq version fields': { module: 'Tender', page: 'BOQ' },
    mention: { module: 'Tender', page: 'Projects' },

    // ── Tender: Suppliers workspace ──────────────────────────────────
    supplier: { module: 'Tender', page: 'Suppliers' },
    'supplier fields': { module: 'Tender', page: 'Suppliers' },
    official: { module: 'Tender', page: 'Suppliers' },
    contact: { module: 'Tender', page: 'Suppliers' },
    'supplier material connection': { module: 'Tender', page: 'Suppliers' },
    suppliermaterialconnection: { module: 'Tender', page: 'Suppliers' },
    'supplier material connection fields': { module: 'Tender', page: 'Suppliers' },
    suppliermaterialconnectionfields: { module: 'Tender', page: 'Suppliers' },

    // ── CRM ───────────────────────────────────────────────────────────
    owner: { module: 'CRM', page: 'Companies' },
    'owner fields': { module: 'CRM', page: 'Companies' },

    // ── Settings / Material Classification / Lookups ─────────────────
    lookup: { module: 'Settings', page: 'Material Classification' },
    country: { module: 'Settings', page: 'Material Classification' },
    status: { module: 'Settings', page: 'Material Classification' },
    'tender stage': { module: 'Settings', page: 'Material Classification' },
    tenderstage: { module: 'Settings', page: 'Material Classification' },
    'type of project': { module: 'Settings', page: 'Material Classification' },
    typeofproject: { module: 'Settings', page: 'Material Classification' },
    tag: { module: 'Settings', page: 'Material Classification' },
    'unit category': { module: 'Settings', page: 'Material Classification' },
    unitcategory: { module: 'Settings', page: 'Material Classification' },
    family: { module: 'Settings', page: 'Material Classification' },
    'family level type': { module: 'Settings', page: 'Material Classification' },
    familyleveltype: { module: 'Settings', page: 'Material Classification' },
    'building level type': { module: 'Settings', page: 'Material Classification' },
    buildingleveltype: { module: 'Settings', page: 'Material Classification' },
    material: { module: 'Settings', page: 'Material Classification' },
    'material fields': { module: 'Settings', page: 'Material Classification' },
    'material item': { module: 'Settings', page: 'Material Classification' },
    materialitem: { module: 'Settings', page: 'Material Classification' },
    'material level map': { module: 'Settings', page: 'Material Classification' },
    materiallevelmap: { module: 'Settings', page: 'Material Classification' },
    'material level map fields': { module: 'Settings', page: 'Material Classification' },
    materiallevelmapfields: { module: 'Settings', page: 'Material Classification' },
    'material level type': { module: 'Settings', page: 'Material Classification' },
    materialleveltype: { module: 'Settings', page: 'Material Classification' },
    'material level type fields': { module: 'Settings', page: 'Material Classification' },
    materialleveltypefields: { module: 'Settings', page: 'Material Classification' },
    'value conversion': { module: 'Settings', page: 'Material Classification' },
    valueconversion: { module: 'Settings', page: 'Material Classification' },
    'value conversion fields': { module: 'Settings', page: 'Material Classification' }
  };

  const staticMapping = entityGroupMap[normalized];
  if (staticMapping) {
    return { module: staticMapping.module, page: staticMapping.page, subgroup: rawGroup };
  }

  // "Module: Page" format (used by In-Hand groups like "In-Hand: Document Control")
  if (rawGroup.includes(':')) {
    const [moduleTitle, pageTitle] = rawGroup.split(':').map((part: string) => part.trim());
    if (moduleTitle && pageTitle) {
      return { module: moduleTitle, page: pageTitle, subgroup: rawGroup };
    }
  }

  // Infer from permission code prefix (e.g. "tender.projects.view" → Tender > Projects)
  const permissions = Array.isArray(groupRecord.permissions)
    ? (groupRecord.permissions as PermissionItem[])
    : [];
  const code = permissions.find((perm: PermissionItem) => !!perm?.code)?.code || '';
  const segments = code.split('.').filter(Boolean);
  const moduleMap: Record<string, string> = {
    tender: 'Tender',
    settings: 'Settings',
    account: 'Account',
    operations: 'Operations',
    crm: 'CRM',
    hr: 'HR',
    inhand: 'In-Hand',
    'in-hand': 'In-Hand',
    materials: 'Materials'
  };
  if (segments.length >= 2) {
    const moduleLabel = moduleMap[segments[0].toLowerCase()];
    if (moduleLabel) {
      return {
        module: moduleLabel,
        page: ctx.humanizePermissionBase(segments[1]),
        subgroup: rawGroup
      };
    }
  }

  return { module: rawGroup || 'Other', page: 'General', subgroup: rawGroup || 'Other' };
}

export function permissionRowsHelper(ctx: HelperContext, ...args: unknown[]): PermissionRow[] {
  const [group] = args;
  const groupRecord = toRecord(group);
  const permissions = Array.isArray(groupRecord.permissions)
    ? (groupRecord.permissions as PermissionItem[])
    : [];
  if (!permissions.length) {
    return [];
  }
  const rows: PermissionRow[] = [];
  const rowIndex = new Map<string, number>();

  for (const perm of permissions) {
    if (!perm?.code && !perm?.label) {
      continue;
    }
    const info = ctx.parsePermissionRow(perm);
    const key = ctx.safeLower(info.base);
    const index = rowIndex.get(key);
    let row: PermissionRow;
    if (index === undefined) {
      row = { label: info.base, actions: [] };
      rows.push(row);
      rowIndex.set(key, rows.length - 1);
    } else {
      row = rows[index];
    }

    if (info.kind === 'view') {
      row.view = perm;
    } else if (info.kind === 'edit') {
      row.edit = perm;
    } else if (info.kind === 'create') {
      row.create = perm;
    } else if (info.kind === 'delete') {
      row.delete = perm;
    } else {
      const actionKey = `${perm.code || perm.label || info.actionLabel || 'allow'}`.toLowerCase();
      if (!row.actions.some((action: PermissionAction) => action.key === actionKey)) {
        row.actions.push({
          key: actionKey,
          label: info.actionLabel || 'Allow',
          perm
        });
      }
    }
  }

  rows.forEach(row => {
    row.actions.sort((a: PermissionAction, b: PermissionAction) => a.label.localeCompare(b.label));
  });

  return rows;
}

export function normalizePermissionCodesHelper(ctx: HelperContext, ...args: unknown[]): string[] {
  const [items] = args;
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map(item => {
      if (item === null || item === undefined) {
        return '';
      }
      if (typeof item === 'string') {
        return item.trim();
      }
      if (typeof item === 'number' || typeof item === 'boolean') {
        return String(item);
      }
      if (typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const candidate =
          record.code ??
          record.Code ??
          record.id ??
          record.Id ??
          record.permission ??
          record.Permission ??
          record.name ??
          record.Name ??
          record.value ??
          record.Value;
        if (typeof candidate === 'string') {
          return candidate.trim();
        }
      }
      return '';
    })
    .filter(Boolean);
}

export function ensureUserArrayHelper(ctx: HelperContext, ...args: unknown[]): UserRow[] {
  const [value] = args;
  if (Array.isArray(value)) {
    return value.filter(Boolean) as UserRow[];
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  if (value instanceof Map) {
    return Array.from(value.values()).filter(Boolean) as UserRow[];
  }
  if (value instanceof Set) {
    return Array.from(value.values()).filter(Boolean) as UserRow[];
  }
  if (ctx.isUserLike(value)) {
    return [value as UserRow];
  }
  const values = Object.values(value as Record<string, unknown>);
  if (!values.length) {
    return [];
  }
  const userValues = values.filter(
    item => item && typeof item === 'object' && ctx.isUserLike(item)
  );
  if (userValues.length) {
    return userValues as UserRow[];
  }
  const nestedUsers = values
    .filter(Array.isArray)
    .flat()
    .filter(item => item && typeof item === 'object' && ctx.isUserLike(item));
  if (nestedUsers.length) {
    return nestedUsers as UserRow[];
  }
  return [];
}

export function loadPermissionTreeHelper(ctx: HelperContext, ...args: unknown[]): void {
  const [authToken] = args;
  const cachedTree = readPermissionTreeCache();
  if (cachedTree?.length) {
    ctx.permissionTree.set(cachedTree);
    ctx.permissionTreeLoaded.set(true);
  }

  ctx.permissionTreeLoading.set(true);
  ctx.permissionsError.set(null);
  ctx.api.get('Roles/permissions-tree', undefined, { authToken }).subscribe({
    next: response => {
      const tree = ctx.extractPermissionTree(response);
      const merged = mergePermissionGroups(PAGE_PERMISSION_GROUPS, tree);
      const nextTree = merged.length ? merged : [...PAGE_PERMISSION_GROUPS];
      ctx.permissionTree.set(nextTree);
      ctx.permissionTreeLoaded.set(true);
      writePermissionTreeCache(nextTree);
      ctx.permissionTreeLoading.set(false);
    },
    error: err => {
      ctx.permissionTreeLoading.set(false);
      // Check if the error is related to access permissions.
      const errRecord = toRecord(err);
      const nestedError = toRecord(errRecord.error);
      const errorMessage = String(errRecord.message || nestedError.message || '');
      const isPermissionError = /permission|access denied|forbidden|not authorized/i.test(
        errorMessage
      );

      if ((errRecord.status === 401 && isPermissionError) || errRecord.status === 403) {
        clearPermissionTreeCache();
        ctx.permissionTreeLoaded.set(false);
        ctx.permissionTree.set([...PAGE_PERMISSION_GROUPS]);
        ctx.permissionsError.set("Access denied - You don't have permission to view permissions");
      } else if (errRecord.status === 404) {
        if (!cachedTree?.length) {
          ctx.permissionTreeLoaded.set(false);
          ctx.permissionTree.set([...PAGE_PERMISSION_GROUPS]);
          ctx.permissionsError.set('Permissions API endpoint not found. Using default permissions.');
        }
      } else {
        if (!cachedTree?.length) {
          ctx.permissionTreeLoaded.set(false);
          ctx.permissionTree.set([...PAGE_PERMISSION_GROUPS]);
          ctx.permissionsError.set('Failed to load permissions from backend');
        }
      }
      ctx.debugWarn('[UserAccess] Failed to load permissions tree', {
        status: errRecord.status,
        message: errorMessage
      });
    }
  });
}

export function exportRosterCsvHelper(ctx: HelperContext, ...args: unknown[]): void {
  const list = ctx.displayedRoster();
  if (!list.length) {
    return;
  }
  const headers = [
    'Name',
    'Email',
    'Status',
    'Role',
    'Department',
    'Position',
    'Joined',
    'LastActive'
  ];
  const rows = list.map((user: UserRow) => [
    user.name,
    user.email,
    user.status,
    user.role ?? '',
    user.department ?? '',
    user.position ?? '',
    ctx.formatDate(user.createdAt),
    ctx.formatDate(user.lastActive)
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(value => ctx.escapeCsv(value)).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
