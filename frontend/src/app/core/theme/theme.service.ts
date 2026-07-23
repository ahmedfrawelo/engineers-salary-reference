import { Injectable, signal, computed, effect } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Theme Configuration
 */
export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    danger: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  isDark: boolean;
}

/**
 * Built-in Themes
 */
const THEMES: Record<string, Theme> = {
  light: {
    id: 'light',
    name: 'Light',
    isDark: false,
    colors: {
      primary: '#84c718',
      secondary: '#6c757d',
      success: '#28a745',
      warning: '#ffc107',
      danger: '#dc3545',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#212529',
      textSecondary: '#6c757d',
      border: '#dee2e6'
    }
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    isDark: true,
    colors: {
      primary: '#84c718',
      secondary: '#adb5bd',
      success: '#28a745',
      warning: '#ffc107',
      danger: '#dc3545',
      background: '#1a1a1a',
      surface: '#2d2d2d',
      text: '#f8f9fa',
      textSecondary: '#adb5bd',
      border: '#495057'
    }
  },
  blue: {
    id: 'blue',
    name: 'Blue Ocean',
    isDark: false,
    colors: {
      primary: '#0d6efd',
      secondary: '#6c757d',
      success: '#28a745',
      warning: '#ffc107',
      danger: '#dc3545',
      background: '#f0f8ff',
      surface: '#e6f2ff',
      text: '#212529',
      textSecondary: '#6c757d',
      border: '#b3d9ff'
    }
  },
  purple: {
    id: 'purple',
    name: 'Purple Dream',
    isDark: true,
    colors: {
      primary: '#6f42c1',
      secondary: '#adb5bd',
      success: '#28a745',
      warning: '#ffc107',
      danger: '#dc3545',
      background: '#1a1625',
      surface: '#2d2640',
      text: '#f8f9fa',
      textSecondary: '#adb5bd',
      border: '#4a3f5c'
    }
  }
};

/**
 * Theme Service
 *
 * Manages application themes with dark/light modes
 *
 * @example
 * ```typescript
 * // Set theme
 * this.themeService.setTheme('dark');
 *
 * // Toggle dark mode
 * this.themeService.toggleDarkMode();
 *
 * // Get current theme
 * const theme = this.themeService.currentTheme();
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'app-theme';

  // Current theme signal
  private _currentThemeId = signal<string>(this.getStoredTheme() || 'light');

  // Available themes
  readonly availableThemes = signal(Object.values(THEMES));

  // Current theme (computed)
  readonly currentTheme = computed(() => THEMES[this._currentThemeId()]);

  // Is dark mode (computed)
  readonly isDarkMode = computed(() => this.currentTheme().isDark);

  constructor() {
    // Apply theme on init
    effect(() => {
      this.applyTheme(this.currentTheme());
    });
  }

  /**
   * Set theme by ID
   */
  setTheme(themeId: string): void {
    if (!THEMES[themeId]) {
      console.error(`[Theme] Unknown theme: ${themeId}`);
      return;
    }

    this._currentThemeId.set(themeId);
    this.saveTheme(themeId);
  }

  /**
   * Toggle between light and dark themes
   */
  toggleDarkMode(): void {
    const currentTheme = this.currentTheme();
    const newThemeId = currentTheme.isDark ? 'light' : 'dark';
    this.setTheme(newThemeId);
  }

  /**
   * Create custom theme
   */
  createCustomTheme(theme: Theme): void {
    THEMES[theme.id] = theme;
    this.availableThemes.set(Object.values(THEMES));
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: Theme): void {
    const root = document.documentElement;

    // Apply CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Add/remove dark mode class
    if (theme.isDark) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }

    // Set theme attribute
    root.setAttribute('data-theme', theme.id);

    if (environment.enableDebugLogs) console.log(`[Theme] Applied: ${theme.name}`);
  }

  /**
   * Save theme to localStorage
   */
  private saveTheme(themeId: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, themeId);
    } catch (error) {
      console.error('[Theme] Error saving theme:', error);
    }
  }

  /**
   * Get stored theme from localStorage
   */
  private getStoredTheme(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Detect system preference
   */
  detectSystemPreference(): 'light' | 'dark' {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Use system preference
   */
  useSystemPreference(): void {
    const preference = this.detectSystemPreference();
    this.setTheme(preference);

    // Listen for changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const newPreference = e.matches ? 'dark' : 'light';
      this.setTheme(newPreference);
    });
  }
}
