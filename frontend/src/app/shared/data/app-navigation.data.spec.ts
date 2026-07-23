import { AREA_MENUS } from './app-navigation.data';

describe('salary reference navigation', () => {
  it('keeps the public salary pages outside authenticated section permissions', () => {
    const publicSalaryKeys = new Set(['salary-reports', 'submit-salary-report']);

    const publicSalaryItems = AREA_MENUS.Tender.filter(item => publicSalaryKeys.has(item.key));
    expect(publicSalaryItems).toHaveLength(2);

    publicSalaryItems.forEach(item => {
      expect(item.sectionKey).toBeUndefined();
    });
  });
});
