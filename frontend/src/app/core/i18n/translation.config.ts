import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

/**
 * i18n configuration providers
 * Add to app.config.ts providers array
 */
export const provideTranslation = (defaultLanguage: string = 'ar') => {
  return [
    ...provideTranslateService({
      lang: defaultLanguage,
      fallbackLang: defaultLanguage
    }),
    ...provideTranslateHttpLoader({
      prefix: './assets/i18n/',
      suffix: '.json'
    })
  ];
};
