import { describe, expect, it } from 'vitest';

import { extractRealtimeEvent, isTenderProjectsRealtimeEvent } from './tender-projects.realtime-events';

describe('salary report realtime events', () => {
  it('recognizes the salary reference SSE envelope', () => {
    const event = extractRealtimeEvent({
      type: 'event',
      payload: {
        module: 'salary-reference',
        entityName: 'salaryReport',
        action: 'synchronized',
        changedFields: [],
        channels: ['salary-reports']
      }
    });

    expect(isTenderProjectsRealtimeEvent(event)).toBe(true);
  });

  it('ignores unrelated realtime events', () => {
    const event = extractRealtimeEvent({
      module: 'suppliers',
      entityName: 'supplier',
      action: 'updated',
      changedFields: [],
      channels: ['module:suppliers']
    });

    expect(isTenderProjectsRealtimeEvent(event)).toBe(false);
  });
});
