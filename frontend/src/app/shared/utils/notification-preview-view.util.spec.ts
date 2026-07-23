import { describe, expect, it } from 'vitest';

import type { Notification } from '../../core/notifications/notification-center.service';
import { buildNotificationPreviewView } from './notification-preview-view.util';

describe('notificationPreviewViewUtil', () => {
  it('precomputes compact topbar notification presentation fields', () => {
    const notification: Notification = {
      id: 'n-1',
      type: 'warning',
      priority: 'high',
      title: 'Supplier updated',
      message: 'AWAL EAMR was updated in tender suppliers.',
      subject: 'AWAL EAMR',
      summary: 'Supplier updated',
      timestamp: Date.now(),
      read: false,
      createdByUserName: 'Rahma Ali',
      createdByUserAvatarUrl: '/assets/users/rahma.png',
      entityType: 'Supplier',
      sourceModule: 'Tendering',
      actionUrl: '/tender/suppliers?supplierId=17&panel=supplier',
      actionLabel: 'Open'
    };

    const view = buildNotificationPreviewView(notification);

    expect(view.id).toBe('n-1');
    expect(view.read).toBe(false);
    expect(view.typeIcon).toBe('\u26A0');
    expect(view.avatarUrl).toBe('/assets/users/rahma.png');
    expect(view.avatarInitials).toBe('RA');
    expect(view.avatarLabel).toBe('Rahma Ali');
    expect(view.contextLabel).toBe('Supplier');
    expect(view.sourceLabel).toBe('Tendering');
    expect(view.showPriority).toBe(true);
    expect(view.priorityLabel).toBe('High');
    expect(view.title).toBe('AWAL EAMR');
    expect(view.summary).toBe('Supplier updated');
    expect(view.message).toBe('Updated in tender suppliers.');
    expect(view.actorLabel).toBe('Rahma Ali');
    expect(view.targetLabel).toBe('Supplier details');
    expect(view.referenceLabel).toBe('Supplier #17');
    expect(view.absoluteTimeLabel).toBeTruthy();
    expect(view.dateTime).toBeTruthy();
    expect(view.actionLabel).toBe('Open supplier details');
  });

  it('uses explicit structured subject and summary for messaging previews', () => {
    const notification: Notification = {
      id: 'n-message',
      type: 'info',
      priority: 'medium',
      title: 'New message from Rahma Ali',
      message: 'Can you review the supplier update today?',
      subject: 'Rahma Ali',
      summary: 'New direct message',
      timestamp: Date.now(),
      read: false,
      createdByUserName: 'Rahma Ali',
      entityType: 'Message',
      sourceModule: 'Messaging',
      actionUrl: '/messages?conversationId=12',
      actionLabel: 'Open conversation'
    };

    const view = buildNotificationPreviewView(notification);

    expect(view.title).toBe('Rahma Ali');
    expect(view.summary).toBe('New direct message');
    expect(view.message).toBe('Can you review the supplier update today?');
  });
});
