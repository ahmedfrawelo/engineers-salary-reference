import type {
  HelperContext,
  UserRow,
  UserStatus
} from './user-access-control.roster.types.internal';

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export function mapUserHelper(
  ctx: HelperContext,
  user: unknown,
  status: UserStatus
): UserRow | null {
  if (!user) {
    return null;
  }
  const base = toRecord(ctx.unwrapUser(user));
  const source = toRecord(user);
  const roles = ctx.normalizeRoles(
    base.roles ??
      base.Roles ??
      base.role ??
      base.Role ??
      base.roleName ??
      base.RoleName ??
      base.role_name ??
      base.Role_Name ??
      source.roles ??
      source.Roles ??
      source.role ??
      source.Role ??
      source.roleName ??
      source.RoleName ??
      source.role_name ??
      source.Role_Name
  );
  const role =
    roles[0] ||
    ctx.normalizeText(
      base.role ??
        base.Role ??
        base.roleName ??
        base.RoleName ??
        base.role_name ??
        base.Role_Name ??
        source.role ??
        source.Role ??
        source.roleName ??
        source.RoleName ??
        source.role_name ??
        source.Role_Name
    ) ||
    'User';
  const permissions =
    ctx.extractPermissionList(
      base.permissions ?? base.Permissions ?? source.permissions ?? source.Permissions
    ) ?? [];
  const email = ctx.normalizeText(
    base.email ??
      base.Email ??
      base.emailAddress ??
      base.EmailAddress ??
      base.email_address ??
      base.Email_Address ??
      base.user_email ??
      base.User_Email ??
      base.userName ??
      base.UserName ??
      base.username ??
      base.Username ??
      base.user_name ??
      base.User_Name ??
      source.email ??
      source.Email ??
      source.emailAddress ??
      source.EmailAddress ??
      source.email_address ??
      source.Email_Address ??
      source.user_email ??
      source.User_Email ??
      source.userName ??
      source.UserName ??
      source.username ??
      source.Username ??
      source.user_name ??
      source.User_Name
  );
  const emailKey = ctx.normalizeEmail(email || undefined);
  const resolvedStatus =
    ctx.normalizeStatusLabel(
      ctx.normalizeText(
        base.status ??
          base.Status ??
          base.statusName ??
          base.StatusName ??
          base.status_name ??
          base.Status_Name ??
          base.accountStatus ??
          base.AccountStatus ??
          base.account_status ??
          base.Account_Status ??
          base.state ??
          base.State ??
          source.status ??
          source.Status ??
          source.statusName ??
          source.StatusName ??
          source.status_name ??
          source.Status_Name ??
          source.accountStatus ??
          source.AccountStatus ??
          source.account_status ??
          source.Account_Status ??
          source.state ??
          source.State
      )
    ) ?? status;
  return {
    id: ctx.resolveUserId(base) ?? ctx.resolveUserId(source) ?? (emailKey || undefined),
    name: ctx.resolveUserName(base),
    email,
    status: resolvedStatus,
    role,
    roles,
    permissions: permissions.length ? permissions : undefined,
    department: ctx.normalizeNullableText(
      base.department ??
        base.Department ??
        base.departmentName ??
        base.DepartmentName ??
        base.department_name ??
        base.Department_Name ??
        source.department ??
        source.Department ??
        source.departmentName ??
        source.DepartmentName ??
        source.department_name ??
        source.Department_Name
    ),
    position: ctx.normalizeNullableText(
      base.position ??
        base.Position ??
        base.positionTitle ??
        base.PositionTitle ??
        base.position_title ??
        base.Position_Title ??
        base.jobTitle ??
        base.JobTitle ??
        base.job_title ??
        base.Job_Title ??
        source.position ??
        source.Position ??
        source.positionTitle ??
        source.PositionTitle ??
        source.position_title ??
        source.Position_Title ??
        source.jobTitle ??
        source.JobTitle ??
        source.job_title ??
        source.Job_Title
    ),
    lastActive:
      ctx.resolveDateField(base, [
        'lastActive',
        'LastActive',
        'lastActiveAt',
        'LastActiveAt',
        'lastLogin',
        'LastLogin',
        'lastLoginAt',
        'LastLoginAt',
        'lastLoginDate',
        'LastLoginDate',
        'lastSignIn',
        'LastSignIn',
        'lastSignInAt',
        'LastSignInAt',
        'lastActivity',
        'LastActivity',
        'updatedAt',
        'UpdatedAt'
      ]) ??
      ctx.resolveDateField(user, [
        'lastActive',
        'LastActive',
        'lastActiveAt',
        'LastActiveAt',
        'lastLogin',
        'LastLogin',
        'lastLoginAt',
        'LastLoginAt',
        'lastLoginDate',
        'LastLoginDate',
        'lastSignIn',
        'LastSignIn',
        'lastSignInAt',
        'LastSignInAt',
        'lastActivity',
        'LastActivity',
        'updatedAt',
        'UpdatedAt'
      ]),
    createdAt:
      ctx.resolveDateField(base, [
        'createdAt',
        'CreatedAt',
        'createdOn',
        'CreatedOn',
        'createdDate',
        'CreatedDate',
        'created',
        'Created',
        'signupDate',
        'SignupDate'
      ]) ??
      ctx.resolveDateField(user, [
        'createdAt',
        'CreatedAt',
        'createdOn',
        'CreatedOn',
        'createdDate',
        'CreatedDate',
        'created',
        'Created',
        'signupDate',
        'SignupDate'
      ]),
    phoneNumber: ctx.normalizeNullableText(
      base.phoneNumber ??
        base.PhoneNumber ??
        base.phone ??
        base.Phone ??
        source.phoneNumber ??
        source.PhoneNumber ??
        source.phone ??
        source.Phone
    ),
    loginCount:
      typeof (base.loginCount ?? base.LoginCount ?? source.loginCount ?? source.LoginCount) ===
      'number'
        ? ((base.loginCount ?? base.LoginCount ?? source.loginCount ?? source.LoginCount) as number)
        : undefined,
    emailConfirmed:
      typeof (base.emailConfirmed ?? base.EmailConfirmed) === 'boolean'
        ? !!(base.emailConfirmed ?? base.EmailConfirmed)
        : typeof (source.emailConfirmed ?? source.EmailConfirmed) === 'boolean'
          ? !!(source.emailConfirmed ?? source.EmailConfirmed)
          : undefined,
    twoFactorEnabled:
      typeof (base.twoFactorEnabled ?? base.TwoFactorEnabled) === 'boolean'
        ? !!(base.twoFactorEnabled ?? base.TwoFactorEnabled)
        : typeof (source.twoFactorEnabled ?? source.TwoFactorEnabled) === 'boolean'
          ? !!(source.twoFactorEnabled ?? source.TwoFactorEnabled)
          : undefined,
    failedAttempts:
      typeof (
        base.accessFailedCount ??
        base.AccessFailedCount ??
        source.accessFailedCount ??
        source.AccessFailedCount
      ) === 'number'
        ? ((base.accessFailedCount ??
            base.AccessFailedCount ??
            source.accessFailedCount ??
            source.AccessFailedCount) as number)
        : undefined,
    lockedUntil:
      ctx.resolveDateField(base, ['lockoutEnd', 'LockoutEnd', 'lockedUntil', 'LockedUntil']) ??
      ctx.resolveDateField(source, ['lockoutEnd', 'LockoutEnd', 'lockedUntil', 'LockedUntil']),
    createdBy: ctx.normalizeNullableText(
      base.createdBy ?? base.CreatedBy ?? source.createdBy ?? source.CreatedBy
    ),
    updatedAt:
      ctx.resolveDateField(base, [
        'updatedAt',
        'UpdatedAt',
        'updatedOn',
        'UpdatedOn',
        'modifiedAt',
        'ModifiedAt'
      ]) ??
      ctx.resolveDateField(source, [
        'updatedAt',
        'UpdatedAt',
        'updatedOn',
        'UpdatedOn',
        'modifiedAt',
        'ModifiedAt'
      ]),
    updatedBy: ctx.normalizeNullableText(
      base.updatedBy ?? base.UpdatedBy ?? source.updatedBy ?? source.UpdatedBy
    ),
    isEditing: false
  };
}
