import { describe, expect, it } from 'vitest';

import {
  isExternalNotificationTarget,
  normalizeNotificationTarget,
  shouldOpenNotificationInNewContext
} from './notification-target.util';

describe('notificationTargetUtil', () => {
  it('normalizes internal notification targets', () => {
    expect(normalizeNotificationTarget('tender/projects?projectId=12')).toBe(
      '/tender/projects?projectId=12'
    );
    expect(normalizeNotificationTarget('/tasks?taskId=9')).toBe('/tasks?taskId=9');
    expect(normalizeNotificationTarget('')).toBe('/account/notifications');
  });

  it('keeps external notification targets intact', () => {
    expect(normalizeNotificationTarget('https://example.com/path')).toBe(
      'https://example.com/path'
    );
    expect(isExternalNotificationTarget('http://example.com/path')).toBe(true);
    expect(isExternalNotificationTarget('/account/notifications')).toBe(false);
  });

  it('detects middle and modified clicks for new-tab behavior', () => {
    expect(shouldOpenNotificationInNewContext(new MouseEvent('auxclick', { button: 1 }))).toBe(
      true
    );
    expect(shouldOpenNotificationInNewContext(new MouseEvent('click', { ctrlKey: true }))).toBe(
      true
    );
    expect(shouldOpenNotificationInNewContext(new MouseEvent('click'), false)).toBe(false);
  });
});
