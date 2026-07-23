import { describe, expect, it } from 'vitest';

import {
  extractTenderProjectsRealtimeProjectIdFromCandidate,
  isTenderProjectsRealtimeCandidate
} from './tender-projects.realtime.util';

describe('tender-projects realtime utilities', () => {
  it('matches direct project events', () => {
    const event = {
      module: 'tendering',
      entityName: 'Project',
      action: 'updated',
      entityId: '42',
      channels: ['authenticated', 'module:tendering', 'project:42']
    };

    expect(isTenderProjectsRealtimeCandidate(event)).toBe(true);
    expect(extractTenderProjectsRealtimeProjectIdFromCandidate(event)).toBe(42);
  });

  it('extracts the project id from checklist scoped channels', () => {
    const event = {
      module: 'tendering',
      entityName: 'CheckList',
      action: 'updated',
      entityId: '9',
      channels: ['authenticated', 'module:tendering', 'project:88']
    };

    expect(isTenderProjectsRealtimeCandidate(event)).toBe(true);
    expect(extractTenderProjectsRealtimeProjectIdFromCandidate(event)).toBe(88);
  });

  it('ignores unrelated events', () => {
    const event = {
      module: 'suppliers',
      entityName: 'Supplier',
      action: 'updated',
      entityId: '15',
      channels: ['authenticated', 'module:suppliers']
    };

    expect(isTenderProjectsRealtimeCandidate(event)).toBe(false);
    expect(extractTenderProjectsRealtimeProjectIdFromCandidate(event)).toBeNull();
  });
});
