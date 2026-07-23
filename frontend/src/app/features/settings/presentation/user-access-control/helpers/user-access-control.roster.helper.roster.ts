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
import { mapUserHelper } from './user-access-control.roster.mapping.helper';

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export function debugWarnHelper(ctx: HelperContext, ...params: unknown[]): void {
  if (ctx.debugEnabled) {
    console.warn(...params);
  }
}

export function isConflictErrorHelper(ctx: HelperContext, err: unknown): boolean {
  const record = toRecord(err);
  const originalError = toRecord(record.originalError);
  const status = record.status ?? originalError.status;
  return status === 409;
}

export function resolveRosterVisibleCountHelper(ctx: HelperContext): number {
  if (Number.isFinite(ctx.rosterVisibleCount) && ctx.rosterVisibleCount > 0) {
    return ctx.rosterVisibleCount;
  }
  return ctx.resolveRosterPageSize();
}

export function normalizeRoleFilterHelper(ctx: HelperContext): string {
  const raw = ctx.rosterRoleFilter.trim().toLowerCase();
  if (!raw) {
    return 'all';
  }
  if (raw.includes('all')) {
    return 'all';
  }
  const roles = ctx
    .roleOptions()
    .map((role: string) => role.trim().toLowerCase())
    .filter(Boolean);
  return roles.includes(raw) ? raw : 'all';
}

export { mapUserHelper };

export function pruneSelectionHelper(ctx: HelperContext, nextRoster: UserRow[]): void {
  const validKeys = new Set(nextRoster.map(user => ctx.getUserKey(user)).filter(Boolean));
  const selectedKeys = Array.from(ctx.selectedKeys()) as string[];
  const next = new Set(selectedKeys.filter(key => validKeys.has(key)));
  if (next.size !== ctx.selectedKeys().size) {
    ctx.selectedKeys.set(next);
  }
  if (!next.size && ctx.showSelectedOnly) {
    ctx.showSelectedOnly = false;
  }
}

export function findDeletedUserByEmailHelper(ctx: HelperContext, email: string): void {
  const authToken = ctx.resolveAuthToken();
  if (!authToken) {
    return;
  }
  const normalizedEmail = ctx.normalizeEmail(email);
  if (!normalizedEmail) {
    return;
  }
  ctx.api.get('Users/deleted', undefined, { authToken }).subscribe({
    next: response => {
      const list = ctx.extractUsers(response);
      const match = list.find(user => {
        const record = toRecord(user);
        const candidateEmail = record.email ?? record.Email ?? record.userName ?? record.UserName;
        return ctx.normalizeEmail(candidateEmail) === normalizedEmail;
      });
      if (!match) {
        return;
      }
      const id = ctx.resolveUserId(match);
      if (!id) {
        return;
      }
      const matchRecord = toRecord(match);
      const name =
        matchRecord.fullName ??
        matchRecord.FullName ??
        matchRecord.name ??
        matchRecord.userName ??
        matchRecord.UserName ??
        null;
      const emailValue =
        ctx.normalizeText(matchRecord.email ?? matchRecord.Email ?? email) || email;
      ctx.restoreCandidate.set({ id, email: emailValue, name: ctx.normalizeNullableText(name) });
      ctx.error.set('User exists but is deleted. Restore instead.');
    },
    error: () => {}
  });
}

export function applyRosterResponseHelper(ctx: HelperContext, ...args: unknown[]): void {
  const [usersResponse] = args;
  ctx.debugLog('[UserAccess] Raw users response:', usersResponse);

  const users = ctx.extractUsers(usersResponse);
  const resolvedUsers = users.length ? users : ctx.collectUserObjects(usersResponse);

  const deriveStatus = (user: unknown): UserStatus => {
    const record = toRecord(user);
    const raw =
      record.status ??
      record.Status ??
      record.state ??
      record.State ??
      record.accountStatus ??
      record.AccountStatus;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (normalized.includes('active')) return 'Active';
      if (
        normalized.includes('suspend') ||
        normalized.includes('inactive') ||
        normalized.includes('disabled')
      ) {
        return 'Suspended';
      }
      if (normalized.includes('invite') || normalized.includes('pending')) return 'Invited';
    }
    const isActive =
      record.isActive ??
      record.IsActive ??
      record.active ??
      record.Active ??
      record.enabled ??
      record.Enabled;
    if (typeof isActive === 'boolean') {
      if (isActive) {
        return 'Active';
      }

      const loginCountRaw =
        record.loginCount ??
        record.LoginCount ??
        record.accessCount ??
        record.AccessCount ??
        record.signInCount ??
        record.SignInCount;
      const loginCount =
        typeof loginCountRaw === 'number'
          ? loginCountRaw
          : typeof loginCountRaw === 'string'
            ? Number.parseInt(loginCountRaw, 10)
            : Number.NaN;
      const lastSeen =
        record.lastActive ??
        record.LastActive ??
        record.lastActiveAt ??
        record.LastActiveAt ??
        record.lastLogin ??
        record.LastLogin ??
        record.lastLoginAt ??
        record.LastLoginAt ??
        record.lastLoginDate ??
        record.LastLoginDate ??
        record.lastSignIn ??
        record.LastSignIn ??
        record.lastSignInAt ??
        record.LastSignInAt;

      if ((!Number.isFinite(loginCount) || loginCount <= 0) && !ctx.normalizeText(lastSeen)) {
        return 'Invited';
      }

      return 'Suspended';
    }
    return 'Active';
  };

  const mappedUsers = resolvedUsers
    .map(user => ctx.mapUser(user, deriveStatus(user)))
    .filter((user: UserRow | null): user is UserRow => !!user);

  const deduped = new Map<string, UserRow>();
  mappedUsers.forEach((user: UserRow, index: number) => {
    const fallbackKey = `row-${index + 1}`;
    const key = String(
      user.id || user.email || `${user.name || 'user'}-${index + 1}` || fallbackKey
    );
    if (deduped.has(key)) {
      return;
    }
    if (!user.id && !user.email) {
      user.id = key;
    }
    deduped.set(key, user);
  });

  const finalUsers = Array.from(deduped.values());
  if (!finalUsers.length) {
    ctx.debugWarn('[UserAccess] No users mapped from backend response', { usersResponse });
  }
  if (!ctx.availableRoles().length) {
    ctx.setAvailableRoles(ctx.collectRoles(finalUsers));
  }

  ctx.debugLog(`[UserAccess] Successfully loaded ${finalUsers.length} users from backend`);
  ctx.roster.set(finalUsers);
  ctx.normalizeRosterFilters();
  ctx.resetRosterPagination();
  ctx.ensureRosterVisible();
  ctx.clearSelection();
  ctx.lastSync.set(new Date().toISOString());
  ctx.loading.set(false);
  ctx.error.set(null);
  ctx.rosterFallbackAttempted = false;
}

export function extractBackendMessageHelper(ctx: HelperContext, ...args: unknown[]): string | null {
  const [payload] = args;
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    return ctx.toMessage(payload);
  }

  if (Array.isArray(payload)) {
    const collected = payload
      .map(item => ctx.toMessage(item))
      .filter((msg): msg is string => !!msg);
    return collected.length ? collected.join(' ') : null;
  }

  if (typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const direct =
    ctx.toMessage(record.message) ||
    ctx.toMessage(record.Message) ||
    ctx.toMessage(record.error) ||
    ctx.toMessage(record.Error) ||
    ctx.toMessage(record.detail) ||
    ctx.toMessage(record.Detail);

  if (direct) {
    return direct;
  }

  const title = ctx.toMessage(record.title) || ctx.toMessage(record.Title);
  if (title && title !== 'One or more validation errors occurred.') {
    return title;
  }

  const errors = record.errors ?? record.Errors;
  if (!errors) {
    return null;
  }

  if (Array.isArray(errors)) {
    const collected = errors.map(item => ctx.toMessage(item)).filter((msg): msg is string => !!msg);
    return collected.length ? collected.join(' ') : null;
  }

  if (typeof errors === 'object') {
    const messages: string[] = [];
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          const msg = ctx.toMessage(entry);
          if (msg) {
            messages.push(msg);
          }
        }
        continue;
      }
      const msg = ctx.toMessage(value);
      if (msg) {
        messages.push(msg);
      }
    }
    if (messages.length) {
      return messages.join(' ');
    }
  }

  return null;
}

export function extractUsersHelper(ctx: HelperContext, ...args: unknown[]): unknown[] {
  const [response] = args;
  if (!response) {
    return [];
  }
  if (Array.isArray(response)) {
    return response;
  }
  const responseRecord = toRecord(response);

  const direct = ctx.extractUserListFrom(response);
  if (direct) {
    return direct;
  }

  const keyed = ctx.extractUserListFrom(
    responseRecord.users ??
      responseRecord.Users ??
      responseRecord.activeUsers ??
      responseRecord.ActiveUsers ??
      responseRecord.inactiveUsers ??
      responseRecord.InactiveUsers ??
      responseRecord.members ??
      responseRecord.Members ??
      responseRecord.accounts ??
      responseRecord.Accounts
  );
  if (keyed) {
    return keyed;
  }

  const nested =
    responseRecord.data ??
    responseRecord.Data ??
    responseRecord.result ??
    responseRecord.Result ??
    responseRecord.payload ??
    responseRecord.Payload;
  const nestedRecord = toRecord(nested);
  const nestedList = ctx.extractUserListFrom(nested);
  if (nestedList) {
    return nestedList;
  }

  const nestedKeyed = ctx.extractUserListFrom(
    nestedRecord.users ??
      nestedRecord.Users ??
      nestedRecord.activeUsers ??
      nestedRecord.ActiveUsers ??
      nestedRecord.inactiveUsers ??
      nestedRecord.InactiveUsers ??
      nestedRecord.members ??
      nestedRecord.Members ??
      nestedRecord.accounts ??
      nestedRecord.Accounts
  );
  if (nestedKeyed) {
    return nestedKeyed;
  }

  const deepList = ctx.findUserArrayDeep(response);
  if (deepList) {
    return deepList;
  }

  return ctx.isUserLike(response) ? [response] : [];
}

export function hasUserIdentityFieldsHelper(ctx: HelperContext, ...args: unknown[]): boolean {
  const [value] = args;
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (
    'id' in value ||
    'Id' in value ||
    'userId' in value ||
    'UserId' in value ||
    'user_id' in value ||
    'User_Id' in value ||
    'uid' in value ||
    'UID' in value ||
    'email' in value ||
    'Email' in value ||
    'emailAddress' in value ||
    'EmailAddress' in value ||
    'email_address' in value ||
    'Email_Address' in value ||
    'user_email' in value ||
    'User_Email' in value ||
    'userName' in value ||
    'UserName' in value ||
    'username' in value ||
    'Username' in value ||
    'user_name' in value ||
    'User_Name' in value ||
    'name' in value ||
    'Name' in value ||
    'fullName' in value ||
    'FullName' in value ||
    'full_name' in value ||
    'Full_Name' in value ||
    'displayName' in value ||
    'DisplayName' in value ||
    'display_name' in value ||
    'Display_Name' in value ||
    'firstName' in value ||
    'FirstName' in value ||
    'lastName' in value ||
    'LastName' in value ||
    'first_name' in value ||
    'First_Name' in value ||
    'last_name' in value ||
    'Last_Name' in value ||
    'givenName' in value ||
    'GivenName' in value ||
    'familyName' in value ||
    'FamilyName' in value ||
    'given_name' in value ||
    'Given_Name' in value ||
    'family_name' in value ||
    'Family_Name' in value
  );
}
