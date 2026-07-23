import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Keyboard Shortcut
 */
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  category?: string;
}

/**
 * Keyboard Shortcuts Service
 *
 * Global keyboard shortcuts for power users
 *
 * Features:
 * - Global shortcuts (Ctrl+K, Ctrl+S, etc.)
 * - Contextual shortcuts
 * - Shortcut helper (?)
 * - Customizable shortcuts
 *
 * @example
 * ```typescript
 * // Register shortcut
 * this.shortcuts.register({
 *   key: 'k',
 *   ctrl: true,
 *   description: 'Open search',
 *   action: () => this.openSearch()
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutsService {
  private shortcuts = new Map<string, KeyboardShortcut>();
  readonly helpVisible = signal(false);

  constructor(private router: Router) {
    this.registerDefaultShortcuts();
    this.initEventListener();
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
    if (environment.enableDebugLogs)
      console.log(`[Shortcuts] Registered: ${this.formatShortcut(shortcut)}`);
  }

  /**
   * Unregister a shortcut
   */
  unregister(shortcut: Partial<KeyboardShortcut>): void {
    const key = this.getShortcutKey(shortcut as KeyboardShortcut);
    this.shortcuts.delete(key);
  }

  /**
   * Get all shortcuts
   */
  getAll(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getByCategory(category: string): KeyboardShortcut[] {
    return this.getAll().filter(s => s.category === category);
  }

  /**
   * Toggle help dialog
   */
  toggleHelp(): void {
    this.helpVisible.update(v => !v);
  }

  /**
   * Register default shortcuts
   */
  private registerDefaultShortcuts(): void {
    // Navigation
    this.register({
      key: 'h',
      ctrl: true,
      description: 'Go to Home',
      category: 'Navigation',
      action: () => this.router.navigate(['/'])
    });

    this.register({
      key: 's',
      ctrl: true,
      shift: true,
      description: 'Go to Suppliers',
      category: 'Navigation',
      action: () => this.router.navigate(['/tender/suppliers'])
    });

    this.register({
      key: 'p',
      ctrl: true,
      shift: true,
      description: 'Go to Projects',
      category: 'Navigation',
      action: () => this.router.navigate(['/tender/projects'])
    });

    // Actions
    this.register({
      key: 'k',
      ctrl: true,
      description: 'Open Search',
      category: 'Actions',
      action: () => this.openSearch()
    });

    this.register({
      key: 'n',
      ctrl: true,
      description: 'Create New',
      category: 'Actions',
      action: () => this.createNew()
    });

    // Help
    this.register({
      key: '?',
      description: 'Show Keyboard Shortcuts',
      category: 'Help',
      action: () => this.toggleHelp()
    });

    // Refresh
    this.register({
      key: 'r',
      ctrl: true,
      shift: true,
      description: 'Refresh Data',
      category: 'Actions',
      action: () => window.location.reload()
    });
  }

  /**
   * Initialize keyboard event listener
   */
  private initEventListener(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey; // Support Mac Cmd key
      const shift = event.shiftKey;
      const alt = event.altKey;

      const shortcutKey = this.buildKey(key, ctrl, shift, alt);
      const shortcut = this.shortcuts.get(shortcutKey);

      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    });
  }

  /**
   * Get shortcut key for map
   */
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    return this.buildKey(shortcut.key.toLowerCase(), shortcut.ctrl, shortcut.shift, shortcut.alt);
  }

  /**
   * Build key string
   */
  private buildKey(key: string, ctrl?: boolean, shift?: boolean, alt?: boolean): string {
    const parts: string[] = [];
    if (ctrl) parts.push('ctrl');
    if (shift) parts.push('shift');
    if (alt) parts.push('alt');
    parts.push(key);
    return parts.join('+');
  }

  /**
   * Format shortcut for display
   */
  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  }

  /**
   * Open search (to be implemented)
   */
  private openSearch(): void {
    if (environment.enableDebugLogs) console.log('[Shortcuts] Open search');
    // Implement search dialog
  }

  /**
   * Create new (to be implemented)
   */
  private createNew(): void {
    if (environment.enableDebugLogs) console.log('[Shortcuts] Create new');
    // Implement create dialog
  }
}
