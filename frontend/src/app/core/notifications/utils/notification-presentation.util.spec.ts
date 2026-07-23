import { describe, expect, it } from 'vitest';

import {
  formatNotificationActionLabel,
  formatNotificationActorLabel,
  formatNotificationContextLabel,
  formatNotificationDisplaySubject,
  formatNotificationDisplayTitle,
  formatNotificationHeadline,
  formatNotificationMessage,
  formatNotificationPriorityLabel,
  formatNotificationReferenceLabel,
  formatNotificationSourceLabel,
  formatNotificationSubject,
  formatNotificationSummary,
  formatNotificationTargetLabel,
  formatNotificationTitle,
  notificationTypeSymbol,
  shouldEmphasizeNotificationPriority
} from './notification-presentation.util';

describe('notificationPresentationUtil', () => {
  it('humanizes labels for compact notification UIs', () => {
    expect(formatNotificationTitle('supplier updated')).toBe('Supplier updated');
    expect(formatNotificationSourceLabel('tendering', '')).toBe('Tendering');
    expect(formatNotificationSourceLabel('', 'projectassignment')).toBe('Project assignment');
    expect(formatNotificationContextLabel('tendering', 'supplier')).toBe('Supplier');
    expect(formatNotificationContextLabel('supplier', 'supplier')).toBeNull();
    expect(formatNotificationActionLabel('open suppliers')).toBe('Open suppliers');
    expect(formatNotificationPriorityLabel('urgent')).toBe('Urgent');
  });

  it('derives subject-driven headlines and richer action labels for entity notifications', () => {
    const notification = {
      title: 'Supplier updated',
      message: 'AWAL EAMR was updated in tender suppliers.',
      createdByUserName: 'Rahma Ali',
      entityType: 'Supplier',
      actionUrl: '/tender/suppliers?supplierId=17&panel=supplier',
      metadata: undefined
    };

    expect(formatNotificationSubject(notification)).toBe('AWAL EAMR');
    expect(formatNotificationHeadline(notification)).toBe('AWAL EAMR');
    expect(formatNotificationDisplayTitle(notification)).toBe('AWAL EAMR');
    expect(formatNotificationDisplaySubject(notification)).toBe('Supplier updated');
    expect(formatNotificationSummary(notification)).toBe('Supplier updated');
    expect(formatNotificationMessage(notification)).toBe('Updated in tender suppliers.');
    expect(formatNotificationActionLabel('Open', notification)).toBe('Open supplier details');
    expect(formatNotificationTargetLabel({ ...notification, entityId: 17 })).toBe(
      'Supplier details'
    );
    expect(formatNotificationReferenceLabel({ ...notification, entityId: 17 })).toBe(
      'Supplier #17'
    );
  });

  it('derives route-aware task labels for child task activity targets', () => {
    const notification = {
      title: 'Checklist item updated',
      entityType: 'Task Checklist Item',
      actionUrl: '/tasks?taskId=77&taskChecklistItemId=501&panel=details',
      sourceModule: 'Tasks'
    };

    expect(formatNotificationActionLabel('Open', notification)).toBe('Open checklist item');
    expect(formatNotificationTargetLabel({ ...notification, entityId: 501 })).toBe(
      'Task checklist item'
    );
    expect(formatNotificationReferenceLabel({ ...notification, entityId: 501 })).toBe(
      'Checklist item #501'
    );
  });

  it('keeps access-control notifications specific even when the user id is a string', () => {
    const notification = {
      title: 'Permissions updated',
      entityType: 'PermissionChange',
      actionUrl: '/settings/access-control?userId=auth0%7C123&panel=users',
      sourceModule: 'Auth'
    };

    expect(formatNotificationActionLabel('Open', notification)).toBe('Open access control');
    expect(formatNotificationTargetLabel({ ...notification, entityId: null })).toBe(
      'Access control user'
    );
    expect(formatNotificationReferenceLabel({ ...notification, entityId: null })).toBe(
      'User auth0|123'
    );
  });

  it('prefers access-control email references when present in the action url', () => {
    const notification = {
      title: 'Signup pending approval',
      entityType: 'AccountLifecycle',
      actionUrl: '/settings/access-control?tab=profile&userId=usr-42&email=pending%40engineers-salary-reference.local',
      sourceModule: 'Identity'
    };

    expect(formatNotificationTargetLabel({ ...notification, entityId: null })).toBe(
      'Access control user'
    );
    expect(formatNotificationReferenceLabel({ ...notification, entityId: null })).toBe(
      'User pending@engineers-salary-reference.local'
    );
  });

  it('normalizes workspace-level material and messaging actions into clearer labels', () => {
    expect(
      formatNotificationActionLabel('Open', {
        entityType: 'MaterialItem',
        actionUrl: '/tender/material-classification',
        sourceModule: 'Tender'
      })
    ).toBe('Open material classification');

    expect(
      formatNotificationTargetLabel({
        entityType: 'MaterialItem',
        entityId: 42,
        actionUrl: '/tender/material-classification',
        sourceModule: 'Tender'
      })
    ).toBe('Material classification');

    expect(
      formatNotificationActionLabel('Open', {
        entityType: 'Messaging',
        actionUrl: '/messages',
        sourceModule: 'Messaging'
      })
    ).toBe('Open messages');

    expect(
      formatNotificationTargetLabel({
        entityType: 'Messaging',
        entityId: null,
        actionUrl: '/messages',
        sourceModule: 'Messaging'
      })
    ).toBe('Messages');
  });

  it('normalizes account inbox and lifecycle notifications into clearer account labels', () => {
    expect(formatNotificationSourceLabel('Identity', 'AccountLifecycle')).toBe('Identity');

    expect(
      formatNotificationActionLabel('Open', {
        entityType: 'AccountLifecycle',
        actionUrl: '/account/notifications',
        sourceModule: 'Identity'
      })
    ).toBe('Open notifications inbox');

    expect(
      formatNotificationTargetLabel({
        entityType: 'AccountLifecycle',
        entityId: null,
        actionUrl: '/account/notifications',
        sourceModule: 'Identity'
      })
    ).toBe('Notifications inbox');

    expect(
      formatNotificationReferenceLabel({
        entityType: 'AccountLifecycle',
        entityId: 12,
        actionUrl: '/account/notifications',
        sourceModule: 'Identity'
      })
    ).toBeNull();
  });

  it('normalizes project lookup notifications into the shared projects workspace', () => {
    const notification = {
      entityType: 'Country',
      entityId: 7,
      actionUrl: '/tender/projects',
      sourceModule: 'Tendering'
    };

    expect(formatNotificationActionLabel('Open', notification)).toBe('Open projects workspace');
    expect(formatNotificationTargetLabel(notification)).toBe('Projects workspace');
    expect(formatNotificationReferenceLabel(notification)).toBe('Country #7');
  });

  it('normalizes crm record actions into specific record targets', () => {
    const notification = {
      entityType: 'CrmCompanyNote',
      entityId: 19,
      actionUrl: '/crm/companies/42',
      sourceModule: 'crm'
    };

    expect(formatNotificationSourceLabel('crm', 'CrmCompanyNote')).toBe('CRM');
    expect(formatNotificationActionLabel('Open', notification)).toBe('Open company record');
    expect(formatNotificationTargetLabel(notification)).toBe('Company record');
    expect(formatNotificationReferenceLabel(notification)).toBe('Company note #19');
  });

  it('normalizes task reference notifications into the tasks workspace', () => {
    const notification = {
      entityType: 'TaskStatusType',
      entityId: 8,
      actionUrl: '/tasks',
      sourceModule: 'tasks'
    };

    expect(formatNotificationActionLabel('Open', notification)).toBe('Open tasks workspace');
    expect(formatNotificationTargetLabel(notification)).toBe('Tasks workspace');
    expect(formatNotificationReferenceLabel(notification)).toBe('Task status type #8');
  });

  it('prefers explicit structured subject and summary over heuristic messaging copy', () => {
    const notification = {
      title: 'New message from Rahma Ali',
      message: 'Please review supplier #17 today.',
      subject: 'Rahma Ali',
      summary: 'New direct message',
      createdByUserName: 'Rahma Ali',
      entityType: 'Message',
      sourceModule: 'Messaging'
    };

    expect(formatNotificationSubject(notification)).toBe('Rahma Ali');
    expect(formatNotificationDisplayTitle(notification)).toBe('Rahma Ali');
    expect(formatNotificationSummary(notification)).toBe('New direct message');
    expect(formatNotificationDisplaySubject(notification)).toBe('New direct message');
    expect(formatNotificationMessage(notification)).toBe('Please review supplier #17 today.');
  });

  it('suppresses repetitive body copy when the message only repeats the title', () => {
    expect(
      formatNotificationMessage({
        title: 'Supplier updated',
        message: 'Rahma Ali updated supplier.',
        createdByUserName: 'Rahma Ali'
      })
    ).toBeNull();
  });

  it('preserves meaningful body copy and actor labels', () => {
    expect(
      formatNotificationMessage({
        title: 'Security update',
        message: 'Your password was changed from a new device.',
        createdByUserName: 'System'
      })
    ).toBe('Your password was changed from a new device.');
    expect(formatNotificationActorLabel('Rahma Ali')).toBe('Rahma Ali');
    expect(formatNotificationActorLabel('System')).toBeNull();
  });

  it('only emphasizes high and urgent priorities in compact previews', () => {
    expect(shouldEmphasizeNotificationPriority('medium')).toBe(false);
    expect(shouldEmphasizeNotificationPriority('high')).toBe(true);
    expect(notificationTypeSymbol('warning')).toBe('\u26A0');
  });
});
