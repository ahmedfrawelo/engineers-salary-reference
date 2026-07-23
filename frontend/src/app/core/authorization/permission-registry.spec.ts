import { describe, expect, it } from 'vitest';
import { PAGE_PERMISSION_GROUPS } from './permission-registry';

function findCodes(groupName: string, prefix: string): string[] {
  const group = PAGE_PERMISSION_GROUPS.find(item => item.group === groupName);
  return (group?.permissions ?? [])
    .filter(permission => permission.code.startsWith(prefix))
    .map(permission => permission.code)
    .sort();
}

describe('permission registry', () => {
  it('exposes CRUD page permissions for salary reports', () => {
    expect(findCodes('Salary Reference', 'salary.reports.')).toEqual([
      'salary.reports.create',
      'salary.reports.delete',
      'salary.reports.edit',
      'salary.reports.view'
    ]);

  });

  it('exposes account notifications page permissions', () => {
    expect(findCodes('Account', 'account.notifications.')).toEqual([
      'account.notifications.edit',
      'account.notifications.view'
    ]);
  });

});
