import { ABOUT_DEVELOPER_ITEM, AREA_MENUS, INFORMATION_SOURCE_ITEM } from './app-navigation.data';

describe('salary reference navigation', () => {
  it('keeps the public salary pages outside authenticated section permissions', () => {
    const publicSalaryKeys = new Set(['salary-reports', 'submit-salary-report']);

    const publicSalaryItems = AREA_MENUS.Tender.filter(item => publicSalaryKeys.has(item.key));
    expect(publicSalaryItems).toHaveLength(2);

    publicSalaryItems.forEach(item => {
      expect(item.sectionKey).toBeUndefined();
    });
  });

  it('keeps the developer about link as an external sidebar footer destination', () => {
    const aboutItem = ABOUT_DEVELOPER_ITEM;

    expect(aboutItem).toMatchObject({
      key: 'about-developer',
      label: 'About Developer',
      externalUrl: 'https://ahmed-frawelo.pages.dev/en'
    });
    expect(AREA_MENUS.Tender.some(item => item.key === aboutItem.key)).toBe(false);
  });

  it('keeps the LinkedIn information source as an external sidebar footer destination', () => {
    const sourceItem = INFORMATION_SOURCE_ITEM;

    expect(sourceItem).toMatchObject({
      key: 'information-source',
      label: 'Information Source',
      ico: 'link-dots',
      externalUrl: 'https://www.linkedin.com/in/mechahmedradwan/'
    });
    expect(AREA_MENUS.Tender.some(item => item.key === sourceItem.key)).toBe(false);
  });
});
