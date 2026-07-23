import { describe, expect, it } from 'vitest';
import { resolveGroupPathHelper } from './user-access-control.roster.helper.permissions';
import type { HelperContext } from './user-access-control.roster.types.internal';

function createContext(): HelperContext {
  return {
    debugEnabled: false,
    rosterVisibleCount: 0,
    rosterRoleFilter: '',
    rosterSort: '',
    rosterQuery: '',
    showSelectedOnly: false,
    rosterFallbackAttempted: false,
    resolveRosterPageSize: () => 0,
    roleOptions: () => [],
    normalizeRoles: () => [],
    normalizeText: value => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()),
    normalizeNullableText: value =>
      typeof value === 'string' && value.trim() ? value.trim() : null,
    normalizeStatusLabel: value => value,
    normalizeStatusFilter: () => '',
    normalizeRoleFilter: () => '',
    normalizeEmail: value => String(value ?? ''),
    normalizeRosterFilters: () => undefined,
    resolveUserId: () => null,
    resolveUserName: () => '',
    resolveDateField: () => null,
    resolveAuthToken: () => null,
    getUserKey: () => null,
    selectedKeys: Object.assign(() => new Set<string>(), { set: () => undefined }),
    extractPermissionList: () => null,
    extractUsers: () => [],
    extractUserListFrom: () => null,
    extractObjectMapValues: () => null,
    extractPermissionTree: () => [],
    findUserArrayDeep: () => null,
    collectUserObjects: () => [],
    mapUser: () => null,
    collectRoles: () => [],
    setAvailableRoles: () => undefined,
    availableRoles: () => [],
    roster: Object.assign(() => [], { set: () => undefined }),
    resetRosterPagination: () => undefined,
    ensureRosterVisible: () => undefined,
    clearSelection: () => undefined,
    lastSync: { set: () => undefined },
    loading: { set: () => undefined },
    error: { set: () => undefined },
    restoreCandidate: { set: () => undefined },
    toMessage: () => null,
    isUserLike: () => false,
    isUserArray: () => false,
    isObjectArray: () => false,
    unwrapUser: value => value,
    hasUserIdentityFields: () => false,
    safeCompare: () => 0,
    compareWithFallback: primary => primary,
    getDateValue: () => 0,
    getStatusRank: () => 0,
    safeLower: value => String(value ?? '').toLowerCase(),
    userMatchesQuery: () => false,
    compareUsers: () => 0,
    ensureUserArray: () => [],
    permissionTree: Object.assign(() => [], { set: () => undefined }),
    isModuleGroup: () => false,
    splitGroupByBase: () => new Map(),
    resolveGroupPath: () => ({ module: 'Other', page: 'General' }),
    addPermissionGroup: () => undefined,
    parsePermissionRow: () => ({ kind: 'action', base: 'General', actionLabel: 'Allow' }),
    normalizeActionLabel: value => value,
    humanizePermissionBase: code => code,
    extractActionFromCode: () => null,
    permissionTreeLoading: { set: () => undefined },
    permissionsLoading: { set: () => undefined },
    permissionsError: { set: () => undefined },
    permissionTreeLoaded: { set: () => undefined },
    displayedRoster: () => [],
    formatDate: () => '',
    escapeCsv: value => String(value ?? ''),
    debugLog: () => undefined,
    debugWarn: () => undefined,
    api: {
      get: () => ({ subscribe: () => undefined })
    }
  };
}

describe('resolveGroupPathHelper', () => {
  const ctx = createContext();

  it('maps supplier entity groups into Tender > Suppliers', () => {
    expect(
      resolveGroupPathHelper(ctx, {
        group: 'Supplier',
        permissions: [{ code: 'Permissions.Supplier.View', label: 'View Supplier' }]
      })
    ).toEqual({
      module: 'Tender',
      page: 'Suppliers',
      subgroup: 'Supplier'
    });

    expect(
      resolveGroupPathHelper(ctx, {
        group: 'Official',
        permissions: [{ code: 'Permissions.Official.View', label: 'View Official' }]
      })
    ).toEqual({
      module: 'Tender',
      page: 'Suppliers',
      subgroup: 'Official'
    });
  });

  it('maps material and lookup entities into Settings > Material Classification', () => {
    expect(
      resolveGroupPathHelper(ctx, {
        group: 'Lookup',
        permissions: [{ code: 'Permissions.Lookup.View', label: 'View Lookup' }]
      })
    ).toEqual({
      module: 'Settings',
      page: 'Material Classification',
      subgroup: 'Lookup'
    });

    expect(
      resolveGroupPathHelper(ctx, {
        group: 'Material',
        permissions: [{ code: 'Permissions.Material.View', label: 'View Material' }]
      })
    ).toEqual({
      module: 'Settings',
      page: 'Material Classification',
      subgroup: 'Material'
    });

    expect(
      resolveGroupPathHelper(ctx, {
        group: 'UnitCategory',
        permissions: [{ code: 'Permissions.UnitCategory.View', label: 'View Unit Category' }]
      })
    ).toEqual({
      module: 'Settings',
      page: 'Material Classification',
      subgroup: 'UnitCategory'
    });
  });

  it('maps owner entities into CRM > Companies', () => {
    expect(
      resolveGroupPathHelper(ctx, {
        group: 'Owner',
        permissions: [{ code: 'Permissions.Owner.View', label: 'View Owner' }]
      })
    ).toEqual({
      module: 'CRM',
      page: 'Companies',
      subgroup: 'Owner'
    });
  });
});
