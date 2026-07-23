import { describe, expect, it } from 'vitest';

import { findTenderSettingsConflict } from './tender-settings.validation.util';

describe('findTenderSettingsConflict', () => {
  const items = [
    { id: 1, name: 'New', customLabel: 'Fresh' },
    { id: 2, name: 'Under Study', customLabel: 'Study' },
    { id: 3, name: 'Pricing' }
  ];

  it('allows editing the same item without flagging its current labels', () => {
    expect(
      findTenderSettingsConflict(items, {
        id: 1,
        name: 'New',
        customLabel: 'Fresh'
      })
    ).toBeNull();
  });

  it('rejects duplicate custom labels', () => {
    expect(
      findTenderSettingsConflict(items, {
        name: 'Submitted',
        customLabel: 'Study'
      })
    ).toEqual({
      field: 'customLabel',
      message: 'Custom label already exists'
    });
  });

  it('rejects custom labels that collide with another item name', () => {
    expect(
      findTenderSettingsConflict(items, {
        name: 'Submitted',
        customLabel: 'Pricing'
      })
    ).toEqual({
      field: 'customLabel',
      message: 'Custom label conflicts with an existing name'
    });
  });

  it('rejects names that collide with another custom label', () => {
    expect(
      findTenderSettingsConflict(items, {
        name: 'Fresh',
        customLabel: 'Ready'
      })
    ).toEqual({
      field: 'name',
      message: 'Name conflicts with an existing custom label'
    });
  });
});
