import { Injectable, signal, effect } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

/**
 * Supported languages
 * اللغات المدعومة
 */
export type Language = 'ar' | 'en';

/**
 * Language configuration
 * إعداد اللغة
 */
export interface LanguageConfig {
  code: Language;
  name: string;
  nativeName: string;
  direction: 'rtl' | 'ltr';
  flag: string;
}

/**
 * Internationalization Service
 * خدمة التدويل والترجمة
 *
 * Manages multi-language support with RTL/LTR handling
 */
@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly STORAGE_KEY = 'app-language';
  private readonly DEFAULT_LANGUAGE: Language = 'ar';

  /**
   * Available languages
   * اللغات المتاحة
   */
  readonly languages: LanguageConfig[] = [
    {
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      direction: 'rtl',
      flag: '🇸🇦'
    },
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      direction: 'ltr',
      flag: '🇬🇧'
    }
  ];

  /**
   * Current language signal
   * إشارة اللغة الحالية
   */
  private _currentLanguage = signal<Language>(this.DEFAULT_LANGUAGE);
  readonly currentLanguage = this._currentLanguage.asReadonly();

  /**
   * Current language config
   * إعدادات اللغة الحالية
   */
  get currentConfig(): LanguageConfig {
    return this.languages.find(l => l.code === this._currentLanguage()) || this.languages[0];
  }

  /**
   * Is RTL (Right-to-Left)
   * هل اللغة من اليمين لليسار
   */
  get isRtl(): boolean {
    return this.currentConfig.direction === 'rtl';
  }

  /**
   * Is LTR (Left-to-Right)
   * هل اللغة من اليسار لليمين
   */
  get isLtr(): boolean {
    return this.currentConfig.direction === 'ltr';
  }

  constructor(private translate: TranslateService) {
    // Set available languages
    this.translate.addLangs(this.languages.map(l => l.code));

    // Set default language
    this.translate.setDefaultLang(this.DEFAULT_LANGUAGE);

    // Load saved language or use default
    const savedLang = this.loadLanguageFromStorage();
    this.setLanguage(savedLang);

    // Update HTML attributes on language change
    effect(() => {
      this.updateHtmlAttributes(this._currentLanguage());
    });
  }

  /**
   * Set current language
   * تعيين اللغة الحالية
   *
   * @param lang Language code
   */
  setLanguage(lang: Language): void {
    if (!this.isLanguageSupported(lang)) {
      if (environment.enableDebugLogs) {
        console.warn(`Language ${lang} not supported, using default`);
      }
      lang = this.DEFAULT_LANGUAGE;
    }

    this.translate.use(lang);
    this._currentLanguage.set(lang);
    this.saveLanguageToStorage(lang);
  }

  /**
   * Toggle between languages
   * التبديل بين اللغات
   */
  toggleLanguage(): void {
    const currentLang = this._currentLanguage();
    const nextLang: Language = currentLang === 'ar' ? 'en' : 'ar';
    this.setLanguage(nextLang);
  }

  /**
   * Get translation for a key
   * الحصول على ترجمة لمفتاح
   *
   * @param key Translation key
   * @param params Interpolation parameters
   * @returns Translated string
   */
  translate$(key: string, params?: object): string {
    return this.translate.instant(key, params);
  }

  /**
   * Get translation observable
   * الحصول على observable للترجمة
   *
   * @param key Translation key
   * @param params Interpolation parameters
   */
  translateAsync(key: string, params?: object) {
    return this.translate.get(key, params);
  }

  /**
   * Get translations for multiple keys
   * الحصول على ترجمات لعدة مفاتيح
   *
   * @param keys Array of translation keys
   */
  translateMultiple(keys: string[]) {
    return this.translate.get(keys);
  }

  /**
   * Check if language is supported
   * التحقق من دعم اللغة
   *
   * @param lang Language code
   */
  isLanguageSupported(lang: string): lang is Language {
    return this.languages.some(l => l.code === lang);
  }

  /**
   * Get language by code
   * الحصول على اللغة بواسطة الكود
   *
   * @param code Language code
   */
  getLanguageByCode(code: string): LanguageConfig | undefined {
    return this.languages.find(l => l.code === code);
  }

  /**
   * Update HTML attributes for language and direction
   * تحديث خصائص HTML للغة والاتجاه
   *
   * @param lang Language code
   */
  private updateHtmlAttributes(lang: Language): void {
    const html = document.documentElement;
    const config = this.getLanguageByCode(lang);

    if (config) {
      // Set lang attribute
      html.setAttribute('lang', lang);

      // Set dir attribute
      html.setAttribute('dir', config.direction);

      // Add/remove RTL class
      if (config.direction === 'rtl') {
        html.classList.add('rtl');
        html.classList.remove('ltr');
      } else {
        html.classList.add('ltr');
        html.classList.remove('rtl');
      }
    }
  }

  /**
   * Load language from storage
   * تحميل اللغة من التخزين
   */
  private loadLanguageFromStorage(): Language {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved && this.isLanguageSupported(saved)) {
        return saved as Language;
      }
    } catch (error) {
      console.error('Error loading language from storage:', error);
    }
    return this.DEFAULT_LANGUAGE;
  }

  /**
   * Save language to storage
   * حفظ اللغة في التخزين
   *
   * @param lang Language code
   */
  private saveLanguageToStorage(lang: Language): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, lang);
    } catch (error) {
      console.error('Error saving language to storage:', error);
    }
  }

  /**
   * Format number based on current language
   * تنسيق الأرقام حسب اللغة الحالية
   *
   * @param value Number to format
   * @param options Intl.NumberFormat options
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    const locale = this._currentLanguage() === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(value);
  }

  /**
   * Format date based on current language
   * تنسيق التاريخ حسب اللغة الحالية
   *
   * @param value Date to format
   * @param options Intl.DateTimeFormat options
   */
  formatDate(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    const locale = this._currentLanguage() === 'ar' ? 'ar-SA' : 'en-US';
    const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;

    return new Intl.DateTimeFormat(locale, options).format(date);
  }

  /**
   * Format currency based on current language
   * تنسيق العملة حسب اللغة الحالية
   *
   * @param value Amount to format
   * @param currency Currency code (default: SAR)
   */
  formatCurrency(value: number, currency: string = 'SAR'): string {
    return this.formatNumber(value, {
      style: 'currency',
      currency: currency
    });
  }

  /**
   * Get browser language
   * الحصول على لغة المتصفح
   */
  getBrowserLanguage(): Language {
    const browserLang = navigator.language.split('-')[0];
    return this.isLanguageSupported(browserLang)
      ? (browserLang as Language)
      : this.DEFAULT_LANGUAGE;
  }

  /**
   * Reset to default language
   * إعادة تعيين اللغة الافتراضية
   */
  resetToDefault(): void {
    this.setLanguage(this.DEFAULT_LANGUAGE);
  }
}
