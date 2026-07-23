import { inject } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeUrl, SafeResourceUrl } from '@angular/platform-browser';

/**
 * Utility class for content sanitization and XSS prevention.
 *
 * @description
 * Provides static methods to sanitize HTML, URLs, and resource URLs
 * using Angular's DomSanitizer. Also includes helper methods for
 * escaping and stripping HTML.
 */
export class SanitizationUtil {
  private static sanitizer: DomSanitizer;

  /**
   * Initializes the static sanitizer instance.
   * Must be called during application initialization (e.g., in AppModule constructor).
   * @param sanitizer - Angular DomSanitizer instance.
   */
  static initialize(sanitizer: DomSanitizer): void {
    this.sanitizer = sanitizer;
  }

  /**
   * Sanitize HTML content to prevent XSS.
   * @param html - Raw HTML string.
   * @returns Sanitized HTML safe for [innerHTML] binding.
   */
  static sanitizeHtml(html: string): SafeHtml {
    if (!this.sanitizer) {
      throw new Error('SanitizationUtil not initialized. Call initialize() first.');
    }
    return this.sanitizer.sanitize(1, html) || ''; // SecurityContext.HTML = 1
  }

  /**
   * Sanitize URL to prevent javascript: protocol attacks.
   * @param url - Raw URL string.
   * @returns Sanitized URL safe for [href] or [src] binding.
   */
  static sanitizeUrl(url: string): SafeUrl {
    if (!this.sanitizer) {
      throw new Error('SanitizationUtil not initialized. Call initialize() first.');
    }
    return this.sanitizer.sanitize(4, url) || ''; // SecurityContext.URL = 4
  }

  /**
   * Sanitize resource URL (for iframes, bypassSecurityTrustResourceUrl).
   * @param url - Raw resource URL.
   * @returns Sanitized resource URL.
   */
  static sanitizeResourceUrl(url: string): SafeResourceUrl {
    if (!this.sanitizer) {
      throw new Error('SanitizationUtil not initialized. Call initialize() first.');
    }
    return this.sanitizer.sanitize(5, url) || ''; // SecurityContext.RESOURCE_URL = 5
  }

  /**
   * Strip all HTML tags from a string efficiently.
   * @param html - HTML string to process.
   * @returns Plain text content.
   */
  static stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /**
   * Escape HTML special characters for safe literal display.
   * @param text - Text to escape.
   * @returns Escaped text.
   */
  static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
