import { Injectable, signal } from '@angular/core';

/**
 * Service for managing global loading state
 *
 * @description
 * Provides a centralized way to track loading states across the application.
 * Uses Angular signals for reactive state management.
 * Supports multiple concurrent loading operations through a counter mechanism.
 *
 * @example
 * ```typescript
 * constructor(private loadingService: LoadingService) {}
 *
 * // Start loading
 * this.loadingService.show();
 *
 * // Stop loading
 * this.loadingService.hide();
 *
 * // Check if loading
 * if (this.loadingService.isLoading() > 0) {
 *   // Show spinner
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingCount = signal(0);

  /**
   * Get current loading count
   * @returns Signal with loading count (0 = not loading, >0 = loading)
   */
  isLoading = this.loadingCount.asReadonly();

  /**
   * Increment loading counter
   * Call this when starting a loading operation
   */
  show(): void {
    this.loadingCount.update(count => count + 1);
  }

  /**
   * Decrement loading counter
   * Call this when finishing a loading operation
   */
  hide(): void {
    this.loadingCount.update(count => Math.max(0, count - 1));
  }

  /**
   * Reset loading counter to 0
   * Use this to force clear all loading states
   */
  reset(): void {
    this.loadingCount.set(0);
  }
}
