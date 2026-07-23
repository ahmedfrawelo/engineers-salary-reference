export type PermissionItem = {
  code: string;
  label: string;
};

export type PermissionGroup = {
  group: string;
  permissions: PermissionItem[];
};

const pageAccess = (base: string, label: string): PermissionItem[] => [
  { code: `${base}.view`, label: `${label} - View` },
  { code: `${base}.edit`, label: `${label} - Edit` }
];

const pageAccessCrud = (base: string, label: string): PermissionItem[] => [
  { code: `${base}.view`, label: `${label} - View` },
  { code: `${base}.edit`, label: `${label} - Edit` },
  { code: `${base}.create`, label: `${label} - Create` },
  { code: `${base}.delete`, label: `${label} - Delete` }
];

export const PAGE_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: 'Salary Reference',
    permissions: [
      ...pageAccessCrud('salary.reports', 'Salary Reports')
    ]
  },
  {
    group: 'Settings',
    permissions: [
      ...pageAccess('settings.global', 'Settings'),
      ...pageAccess('settings.access_control', 'Access Control'),
      ...pageAccess('settings.appearance', 'Appearance'),
      ...pageAccess('settings.active_sessions', 'Active Sessions')
    ]
  },
  {
    group: 'Account',
    permissions: [
      ...pageAccess('account.profile', 'Profile'),
      ...pageAccess('account.settings', 'Account Settings'),
      ...pageAccess('account.notifications', 'Notifications')
    ]
  }
];

export function mergePermissionGroups(
  primary: PermissionGroup[],
  extra: PermissionGroup[]
): PermissionGroup[] {
  const result: PermissionGroup[] = [];
  const groupIndex = new Map<string, number>();

  const normalizeGroupKey = (group: string) => group.trim().toLowerCase();
  const normalizeCode = (code: string) => code.trim().toLowerCase();

  const addGroup = (group: PermissionGroup) => {
    if (!group?.group) {
      return;
    }
    const key = normalizeGroupKey(group.group);
    if (!key) {
      return;
    }
    if (groupIndex.has(key)) {
      const index = groupIndex.get(key) as number;
      const target = result[index];
      const existingCodes = new Set(target.permissions.map(perm => normalizeCode(perm.code)));
      group.permissions.forEach(perm => {
        if (!perm?.code) {
          return;
        }
        const codeKey = normalizeCode(perm.code);
        if (existingCodes.has(codeKey)) {
          return;
        }
        existingCodes.add(codeKey);
        target.permissions.push(perm);
      });
      return;
    }
    groupIndex.set(key, result.length);
    result.push({
      group: group.group,
      permissions: [...group.permissions]
    });
  };

  primary.forEach(addGroup);
  extra.forEach(addGroup);

  return result;
}
