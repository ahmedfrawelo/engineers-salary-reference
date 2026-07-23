import { beforeEach, describe, expect, it } from 'vitest';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    service = new PermissionService();
  });

  it('derives page create/delete access from mapped entity permissions', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['Permissions.Project.Create', 'Permissions.Supplier.Delete']
    });

    expect(service.canCreatePage('tender.projects')).toBe(true);
    expect(service.canDeletePage('tender.projects')).toBe(false);
    expect(service.canDeletePage('tender.suppliers')).toBe(true);
  });

  it('treats entity permissions as valid access-control page access', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['Permissions.Identity.ManagePermissions']
    });

    expect(service.canViewPage('settings.access_control')).toBe(true);
    expect(service.canEditPage('settings.access_control')).toBe(true);
    expect(service.canViewSection('settings.access_control')).toBe(true);
  });

  it('keeps page edit scoped to view/edit without broadening create/delete', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['tender.projects.edit']
    });

    expect(service.canViewPage('tender.projects')).toBe(true);
    expect(service.canEditPage('tender.projects')).toBe(true);
    expect(service.canCreatePage('tender.projects')).toBe(false);
    expect(service.canDeletePage('tender.projects')).toBe(false);
  });

  it('maps direct entity edit permissions to page edit access for projects and suppliers', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['Permissions.Project.Edit', 'Permissions.Supplier.Edit']
    });

    expect(service.canEditPage('tender.projects')).toBe(true);
    expect(service.canEditPage('tender.suppliers')).toBe(true);
    expect(service.canCreatePage('tender.projects')).toBe(false);
    expect(service.canDeletePage('tender.suppliers')).toBe(false);
  });

  it('does not broaden reset-password or permission-management access from EditUser alone', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['Permissions.Identity.EditUser']
    });

    expect(service.canEditAccessControlUsers()).toBe(true);
    expect(service.canResetAccessControlPasswords()).toBe(false);
    expect(service.canManageAccessControlPermissions()).toBe(false);
    expect(service.canManageAccessControlRoles()).toBe(false);
  });

  it('keeps a direct access-control page edit grant scoped to page access only', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['settings.access_control.edit']
    });

    expect(service.canViewAccessControl()).toBe(true);
    expect(service.canEditPage('settings.access_control')).toBe(true);
    expect(service.canCreateAccessControlUsers()).toBe(false);
    expect(service.canEditAccessControlUsers()).toBe(false);
    expect(service.canDeleteAccessControlUsers()).toBe(false);
    expect(service.canManageAccessControlRoles()).toBe(false);
    expect(service.canAssignAccessControlRoles()).toBe(false);
    expect(service.canManageAccessControlPermissions()).toBe(false);
    expect(service.canResetAccessControlPasswords()).toBe(false);
  });

  it('allows reset-password access from the dedicated identity permission without granting user-edit access', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['Permissions.Identity.ResetPassword']
    });

    expect(service.canViewAccessControl()).toBe(true);
    expect(service.canResetAccessControlPasswords()).toBe(true);
    expect(service.canEditAccessControlUsers()).toBe(false);
    expect(service.canManageAccessControlRoles()).toBe(false);
  });

  it('derives field-level view/edit access with entity-level fallbacks', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['Permissions.Project.Edit', 'Permissions.Supplier.Fields.Website.View']
    });

    expect(
      service.canEditField('Permissions.Project.Fields.Owner', ['Permissions.Project.Edit'])
    ).toBe(true);
    expect(
      service.canViewField('Permissions.Project.Fields.Owner', ['Permissions.Project.View'])
    ).toBe(true);
    expect(
      service.canEditField('Permissions.Supplier.Fields.Website', ['Permissions.Supplier.Edit'])
    ).toBe(false);
    expect(
      service.canViewField('Permissions.Supplier.Fields.Website', ['Permissions.Supplier.View'])
    ).toBe(true);
  });

  it('switches to strict field-level mode when scoped field grants are present', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['Permissions.Project.Edit', 'Permissions.Project.Fields.Name.View']
    });

    expect(
      service.canViewField('Permissions.Project.Fields.Name', ['Permissions.Project.View'])
    ).toBe(true);
    expect(
      service.canViewField('Permissions.Project.Fields.Price', ['Permissions.Project.View'])
    ).toBe(false);
    expect(
      service.canEditField('Permissions.Project.Fields.Price', ['Permissions.Project.Edit'])
    ).toBe(false);
  });

  it('treats administrator-style role names as full admin access', () => {
    service.setUserPermissions({
      roles: ['Administrator'],
      permissions: []
    });

    expect(service.canManageAccessControlPermissions()).toBe(true);
    expect(service.canManageAccessControlRoles()).toBe(true);
    expect(service.canAssignAccessControlRoles()).toBe(true);
  });

  it('keeps a normal user out of admin-only and edit-only workspaces', () => {
    service.setUserPermissions({
      roles: ['User'],
      permissions: ['tender.projects.view']
    });

    expect(service.canViewPage('tender.projects')).toBe(true);
    expect(service.canEditPage('tender.projects')).toBe(false);
    expect(service.canManageAccessControlPermissions()).toBe(false);
    expect(service.canManageAccessControlRoles()).toBe(false);
  });

  it('allows a custom permission grant to open only the matching access-control capability', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['Permissions.Identity.AssignRoles']
    });

    expect(service.canViewAccessControl()).toBe(true);
    expect(service.canAssignAccessControlRoles()).toBe(true);
    expect(service.canManageAccessControlRoles()).toBe(false);
    expect(service.canManageAccessControlPermissions()).toBe(false);
    expect(service.canCreateAccessControlUsers()).toBe(false);
  });

  it('treats operations tasks edit as full tasks page access for a scoped user', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['operations.tasks.edit']
    });

    expect(service.canViewPage('operations.tasks')).toBe(true);
    expect(service.canEditPage('operations.tasks')).toBe(true);
  });

  it('maps legacy tender tasks grants to the real operations tasks workspace', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['tender.tasks.view']
    });

    expect(service.canViewPage('operations.tasks')).toBe(true);
    expect(service.canViewPage('tender.tasks')).toBe(true);
    expect(service.canEditPage('operations.tasks')).toBe(false);
  });

  it('maps legacy in-hand tasks grants to the real operations tasks workspace', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['inhand.tasks.view']
    });

    expect(service.canViewPage('operations.tasks')).toBe(true);
    expect(service.canEditPage('operations.tasks')).toBe(false);
    expect(service.canViewPage('inhand.tasks')).toBe(true);
  });

  it('keeps unknown crm pages unavailable', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['operations.tasks.view']
    });

    expect(service.canViewPage('crm.archive')).toBe(false);
    expect(service.canViewSection('crm.archive')).toBe(false);
  });

  it('keeps a scoped in-hand grant limited to its own page family', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['inhand.document_control.drawings.view']
    });

    expect(service.canViewPage('inhand.document_control.drawings')).toBe(true);
    expect(service.canEditPage('inhand.document_control.drawings')).toBe(false);
    expect(service.canViewPage('inhand.document_control.transmittals')).toBe(false);
  });

  it('treats account notifications edit as full notifications workspace access', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['account.notifications.edit']
    });

    expect(service.canViewPage('account.notifications')).toBe(true);
    expect(service.canEditPage('account.notifications')).toBe(true);
  });

  it('keeps notifications view-only users out of edit actions', () => {
    service.setUserPermissions({
      roles: [],
      permissions: ['account.notifications.view']
    });

    expect(service.canViewPage('account.notifications')).toBe(true);
    expect(service.canEditPage('account.notifications')).toBe(false);
  });
});
