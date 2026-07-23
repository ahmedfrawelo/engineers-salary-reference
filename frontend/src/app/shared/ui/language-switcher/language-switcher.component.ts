import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';

/**
 * Language Switcher Component
 *
 * Dropdown component to switch between Arabic and English
 *
 * @example
 * ```html
 * <!-- In app header or navbar -->
 * <app-language-switcher></app-language-switcher>
 * ```
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="language-switcher">
      <button class="btn" [class.active]="currentLang === 'ar'" (click)="switchLanguage('ar')">
        <span class="flag">🇸🇦</span>
        <span class="text">عربي</span>
      </button>

      <button class="btn" [class.active]="currentLang === 'en'" (click)="switchLanguage('en')">
        <span class="flag">🇬🇧</span>
        <span class="text">EN</span>
      </button>
    </div>
  `,
  styles: [
    `
      .language-switcher {
        display: flex;
        gap: 4px;
        background: rgb(var(--bg1));
        border: 1px solid rgb(var(--border) / 0.4);
        border-radius: 8px;
        padding: 2px;
      }

      .btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: rgb(var(--fg) / 0.7);
        cursor: pointer;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .btn:hover {
        background: rgb(var(--bg2));
        color: rgb(var(--fg));
      }

      .btn.active {
        background: rgb(var(--primary));
        color: white;
      }

      .btn.active .flag {
        transform: scale(1.1);
      }

      .flag {
        font-size: 1.1rem;
        transition: transform 0.2s ease;
      }

      .text {
        font-weight: 600;
      }

      @media (max-width: 640px) {
        .text {
          display: none;
        }

        .btn {
          padding: 6px 10px;
        }
      }
    `
  ]
})
export class LanguageSwitcherComponent {
  private translate = inject(TranslateService);

  currentLang = this.translate.currentLang || this.translate.defaultLang || 'ar';

  switchLanguage(lang: 'ar' | 'en'): void {
    this.translate.use(lang);
    this.currentLang = lang;

    // Update document direction
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);

    // Save preference
    localStorage.setItem('language', lang);

    if (environment.enableDebugLogs) console.log(`[i18n] Language switched to: ${lang}`);
  }
}
