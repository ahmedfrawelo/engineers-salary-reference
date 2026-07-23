import { describe, expect, it } from 'vitest';

import { resolveNotificationActionUrl } from './notification-action-url.util';

describe('notification-action-url.util', () => {
  it('uses the derived deep-link when the backend action is missing', () => {
    expect(
      resolveNotificationActionUrl({
        rawActionUrl: null,
        derivedActionUrl: '/tender/suppliers?supplierId=17&panel=supplier',
        genericActionUrl: '/tender/suppliers'
      })
    ).toBe('/tender/suppliers?supplierId=17&panel=supplier');
  });

  it('upgrades a generic supplier workspace link to the exact supplier record', () => {
    expect(
      resolveNotificationActionUrl({
        rawActionUrl: '/tender/suppliers',
        derivedActionUrl: '/tender/suppliers?supplierId=17&panel=supplier',
        genericActionUrl: '/tender/suppliers'
      })
    ).toBe('/tender/suppliers?supplierId=17&panel=supplier');
  });

  it('merges generic workspace query params with the derived record target', () => {
    expect(
      resolveNotificationActionUrl({
        rawActionUrl: '/tender/suppliers?search=awal',
        derivedActionUrl: '/tender/suppliers?officialId=42&panel=official',
        genericActionUrl: '/tender/suppliers'
      })
    ).toBe('/tender/suppliers?search=awal&officialId=42&panel=official');
  });

  it('keeps an explicit external url untouched', () => {
    expect(
      resolveNotificationActionUrl({
        rawActionUrl: 'https://example.com/notifications/42',
        derivedActionUrl: '/tender/suppliers?officialId=42&panel=official',
        genericActionUrl: '/tender/suppliers'
      })
    ).toBe('https://example.com/notifications/42');
  });

  it('keeps unrelated custom in-app paths untouched', () => {
    expect(
      resolveNotificationActionUrl({
        rawActionUrl: '/account/notifications',
        derivedActionUrl: '/tender/suppliers?officialId=42&panel=official',
        genericActionUrl: '/tender/suppliers'
      })
    ).toBe('/account/notifications');
  });

  it('keeps a rich task comment link when the derived fallback points to another workspace', () => {
    expect(
      resolveNotificationActionUrl({
        rawActionUrl: '/tasks?taskId=77&commentId=5',
        derivedActionUrl: '/tender/projects?commentId=5&section=activity',
        genericActionUrl: '/tender/projects'
      })
    ).toBe('/tasks?taskId=77&commentId=5');
  });

  it('adds child target params without replacing the backend parent task id', () => {
    expect(
      resolveNotificationActionUrl({
        rawActionUrl: '/tasks?taskId=77',
        derivedActionUrl: '/tasks?taskItemId=8',
        genericActionUrl: '/tasks'
      })
    ).toBe('/tasks?taskId=77&taskItemId=8');
  });
});
