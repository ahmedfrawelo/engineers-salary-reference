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

export function findUserArrayDeepHelper(ctx: HelperContext, ...args: unknown[]): unknown[] | null {
  const [root, maxDepthRaw] = args;
  const maxDepth = typeof maxDepthRaw === 'number' ? maxDepthRaw : 5;
  const visited = new Set<unknown>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const { value, depth } = current;
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (visited.has(value)) {
      continue;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      if (ctx.isUserArray(value)) {
        return value;
      }
      if (ctx.isObjectArray(value)) {
        return value;
      }
    }

    if (depth >= maxDepth) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        queue.push({ value: entry, depth: depth + 1 });
      }
      continue;
    }

    for (const entry of Object.values(value)) {
      queue.push({ value: entry, depth: depth + 1 });
    }
  }

  return null;
}

export function collectUserObjectsHelper(ctx: HelperContext, ...args: unknown[]): unknown[] {
  const [root, maxDepthRaw] = args;
  const maxDepth = typeof maxDepthRaw === 'number' ? maxDepthRaw : 6;
  if (!root) {
    return [];
  }
  const collected = new Set<unknown>();
  const visited = new Set<unknown>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const { value, depth } = current;
    if (!value || typeof value !== 'object') {
      continue;
    }
    if (visited.has(value)) {
      continue;
    }
    visited.add(value);

    if (ctx.isUserLike(value) && !collected.has(value)) {
      collected.add(value);
    }

    if (depth >= maxDepth) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        queue.push({ value: entry, depth: depth + 1 });
      }
      continue;
    }

    for (const entry of Object.values(value)) {
      queue.push({ value: entry, depth: depth + 1 });
    }
  }

  return Array.from(collected);
}

export function extractUserListFromHelper(
  ctx: HelperContext,
  ...args: unknown[]
): unknown[] | null {
  const [candidate] = args;
  if (!candidate) {
    return null;
  }
  if (Array.isArray(candidate)) {
    return candidate;
  }
  const candidateRecord = toRecord(candidate);
  const mapValues = ctx.extractObjectMapValues(candidate);
  if (mapValues) {
    return mapValues;
  }
  if (Array.isArray(candidateRecord.items)) {
    return candidateRecord.items;
  }
  if (Array.isArray(candidateRecord.list)) {
    return candidateRecord.list;
  }
  if (Array.isArray(candidateRecord.rows)) {
    return candidateRecord.rows;
  }
  if (Array.isArray(candidateRecord.records)) {
    return candidateRecord.records;
  }
  if (Array.isArray(candidateRecord.results)) {
    return candidateRecord.results;
  }
  if (Array.isArray(candidateRecord.users)) {
    return candidateRecord.users;
  }
  if (Array.isArray(candidateRecord.value)) {
    return candidateRecord.value;
  }
  if (Array.isArray(candidateRecord.data)) {
    return candidateRecord.data;
  }
  const nestedMapValues = ctx.extractObjectMapValues(
    candidateRecord.items ??
      candidateRecord.data ??
      candidateRecord.result ??
      candidateRecord.payload
  );
  if (nestedMapValues) {
    return nestedMapValues;
  }
  return null;
}

export function extractObjectMapValuesHelper(
  ctx: HelperContext,
  ...args: unknown[]
): unknown[] | null {
  const [candidate] = args;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }
  const values = Object.values(candidate);
  if (!values.length) {
    return null;
  }
  const objectValues = values.filter(
    value => value && typeof value === 'object' && !Array.isArray(value)
  );
  if (!objectValues.length) {
    return null;
  }
  if (objectValues.some(value => ctx.isUserLike(value) || ctx.isUserLike(ctx.unwrapUser(value)))) {
    return objectValues;
  }
  for (const value of objectValues) {
    const nestedValues = Object.values(value as Record<string, unknown>).filter(
      item => item && typeof item === 'object' && !Array.isArray(item)
    );
    if (!nestedValues.length) {
      continue;
    }
    if (nestedValues.some(item => ctx.isUserLike(item) || ctx.isUserLike(ctx.unwrapUser(item)))) {
      return nestedValues;
    }
  }
  return null;
}

export function unwrapUserHelper(ctx: HelperContext, ...args: unknown[]): unknown {
  const [payload] = args;
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const payloadRecord = toRecord(payload);
  const candidates = [
    payloadRecord,
    payloadRecord.user,
    payloadRecord.User,
    payloadRecord.account,
    payloadRecord.Account,
    payloadRecord.profile,
    payloadRecord.Profile,
    payloadRecord.details,
    payloadRecord.Details,
    payloadRecord.data,
    payloadRecord.Data,
    payloadRecord.item,
    payloadRecord.Item,
    payloadRecord.value,
    payloadRecord.Value
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }
    if (ctx.hasUserIdentityFields(candidate)) {
      return candidate;
    }
  }
  return payload;
}

export function resolveUserNameHelper(ctx: HelperContext, ...args: unknown[]): string {
  const [user] = args;
  const userRecord = toRecord(user);
  const nestedName = toRecord(userRecord.name);
  const direct =
    userRecord.fullName ??
    userRecord.FullName ??
    userRecord.full_name ??
    userRecord.Full_Name ??
    userRecord.displayName ??
    userRecord.DisplayName ??
    userRecord.display_name ??
    userRecord.Display_Name ??
    userRecord.name ??
    userRecord.Name ??
    userRecord.userName ??
    userRecord.UserName ??
    userRecord.user_name ??
    userRecord.User_Name ??
    userRecord.username ??
    userRecord.Username ??
    '';
  const normalized = ctx.normalizeText(direct);
  if (normalized) {
    return normalized;
  }
  const first = ctx.normalizeText(
    userRecord.firstName ??
      userRecord.FirstName ??
      userRecord.first_name ??
      userRecord.First_Name ??
      userRecord.givenName ??
      userRecord.GivenName ??
      userRecord.given_name ??
      userRecord.Given_Name ??
      nestedName.firstName ??
      nestedName.FirstName ??
      nestedName.first ??
      nestedName.First
  );
  const last = ctx.normalizeText(
    userRecord.lastName ??
      userRecord.LastName ??
      userRecord.last_name ??
      userRecord.Last_Name ??
      userRecord.familyName ??
      userRecord.FamilyName ??
      userRecord.family_name ??
      userRecord.Family_Name ??
      nestedName.lastName ??
      nestedName.LastName ??
      nestedName.last ??
      nestedName.Last
  );
  const combined = [first, last].filter(Boolean).join(' ').trim();
  return combined || 'N/A';
}

export function normalizeStatusLabelHelper(ctx: HelperContext, ...args: unknown[]): string | null {
  const [value] = args;
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'active') {
    return 'Active';
  }
  if (
    normalized === 'invited' ||
    normalized === 'pending' ||
    normalized === 'pending acceptance' ||
    normalized === 'pending_acceptance' ||
    normalized === 'invite_pending' ||
    normalized === 'invitation_pending'
  ) {
    return 'Invited';
  }
  if (
    normalized === 'suspended' ||
    normalized === 'inactive' ||
    normalized === 'blocked' ||
    normalized === 'disabled'
  ) {
    return 'Suspended';
  }
  return ctx.normalizeText(value);
}

export function compareUsersHelper(ctx: HelperContext, ...args: unknown[]): number {
  const [a, b] = args;
  const left = toRecord(a) as UserRow;
  const right = toRecord(b) as UserRow;
  switch (ctx.rosterSort) {
    case 'NameAsc':
      return ctx.compareWithFallback(ctx.safeCompare(left.name, right.name), left, right);
    case 'NameDesc':
      return ctx.compareWithFallback(ctx.safeCompare(right.name, left.name), left, right);
    case 'EmailAsc':
      return ctx.compareWithFallback(ctx.safeCompare(left.email, right.email), left, right);
    case 'Newest': {
      const dateA = ctx.getDateValue(left.createdAt);
      const dateB = ctx.getDateValue(right.createdAt);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return ctx.compareWithFallback(ctx.safeCompare(left.name, right.name), left, right);
    }
    case 'Oldest': {
      const dateA = ctx.getDateValue(left.createdAt);
      const dateB = ctx.getDateValue(right.createdAt);
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return ctx.compareWithFallback(ctx.safeCompare(left.name, right.name), left, right);
    }
    case 'LastActive': {
      const dateA = ctx.getDateValue(left.lastActive ?? left.createdAt);
      const dateB = ctx.getDateValue(right.lastActive ?? right.createdAt);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return ctx.compareWithFallback(ctx.safeCompare(left.name, right.name), left, right);
    }
    default: {
      const rankA = ctx.getStatusRank(left.status);
      const rankB = ctx.getStatusRank(right.status);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return ctx.compareWithFallback(ctx.safeCompare(left.name, right.name), left, right);
    }
  }
}

export function displayedRosterHelper(ctx: HelperContext, ...args: unknown[]): UserRow[] {
  try {
    const query = ctx.safeLower(ctx.rosterQuery);
    const statusFilter = ctx.normalizeStatusFilter();
    const roleFilter = ctx.normalizeRoleFilter();

    let list = [...ctx.ensureUserArray(ctx.roster())];

    if (statusFilter && statusFilter !== 'all') {
      list = list.filter(user => ctx.safeLower(user.status) === statusFilter);
    }

    if (roleFilter && roleFilter !== 'all') {
      list = list.filter(user => {
        const roles = ctx
          .normalizeRoles(user.roles ?? user.role)
          .map((role: string) => ctx.safeLower(role));
        return roles.includes(roleFilter) || ctx.safeLower(user.role) === roleFilter;
      });
    }

    if (query) {
      list = list.filter(user => ctx.userMatchesQuery(user, query));
    }

    const filtersActive =
      !!query ||
      statusFilter !== 'all' ||
      roleFilter !== 'all' ||
      (ctx.showSelectedOnly && ctx.selectedKeys().size > 0);

    if (ctx.showSelectedOnly && ctx.selectedKeys().size) {
      const selected = ctx.selectedKeys();
      list = list.filter(user => {
        const key = ctx.getUserKey(user);
        return key ? selected.has(key) : false;
      });
    }

    if (!filtersActive && list.length === 0 && ctx.roster().length) {
      list = [...ctx.ensureUserArray(ctx.roster())];
    }

    return list.sort((a, b) => ctx.compareUsers(a, b));
  } catch (err) {
    console.error('[UserAccess] Failed to build roster view', err);
    return [...ctx.ensureUserArray(ctx.roster())];
  }
}
