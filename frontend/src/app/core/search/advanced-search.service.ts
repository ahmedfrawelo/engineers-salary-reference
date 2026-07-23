import { Injectable, signal, computed } from '@angular/core';
import { Observable, Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Search Result
 */
export interface SearchResult<T = LooseValue> {
  item: T;
  score: number;
  matches: Array<{ field: string; indices: [number, number][] }>;
  highlights: Record<string, string>;
}

/**
 * Search Options
 */
export interface SearchOptions {
  fields?: string[]; // Fields to search in
  threshold?: number; // Minimum score threshold (0-1)
  limit?: number; // Maximum results
  fuzzy?: boolean; // Enable fuzzy matching
  caseSensitive?: boolean;
  wholeWord?: boolean;
  sortBy?: 'score' | 'date' | 'relevance';
}

/**
 * Search Index
 */
interface SearchIndex {
  id: string;
  content: string;
  fields: Record<string, LooseValue>;
  metadata?: Record<string, LooseValue>;
}

/**
 * Advanced Search Service
 *
 * Comprehensive search functionality with fuzzy matching
 *
 * Features:
 * - Full-text search
 * - Fuzzy matching
 * - Multi-field search
 * - Highlighting
 * - Search history
 * - Recent searches
 * - Search suggestions
 * - Debounced search
 *
 * @example
 * ```typescript
 * // Register searchable items
 * this.searchService.indexItems(suppliers, ['name', 'email', 'category']);
 *
 * // Search
 * const results = this.searchService.search('ABC', {
 *   fields: ['name'],
 *   fuzzy: true,
 *   limit: 10
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class AdvancedSearchService {
  private readonly STORAGE_KEY = 'search-history';
  private readonly MAX_HISTORY = 20;

  private searchIndex = new Map<string, SearchIndex>();
  private searchSubject = new Subject<string>();

  // Signals
  private _searchHistory = signal<string[]>(this.loadSearchHistory());
  readonly searchHistory = this._searchHistory.asReadonly();

  private _recentSearches = computed(() => this._searchHistory().slice(0, 5));
  readonly recentSearches = this._recentSearches;

  constructor() {
    this.setupDebouncedSearch();
  }

  /**
   * Index items for searching
   */
  indexItems<T>(items: T[], fields: string[], category: string = 'default'): void {
    items.forEach(item => {
      const id = `${category}-${this.getItemId(item)}`;
      const content = this.extractContent(item, fields);

      this.searchIndex.set(id, {
        id,
        content,
        fields: item as LooseValue,
        metadata: { category }
      });
    });

    if (environment.enableDebugLogs)
      console.log(`[Search] Indexed ${items.length} items in category: ${category}`);
  }

  /**
   * Search indexed items
   */
  search<T = LooseValue>(query: string, options: SearchOptions = {}): SearchResult<T>[] {
    if (!query.trim()) return [];

    const {
      fields,
      threshold = 0.3,
      limit = 50,
      fuzzy = true,
      caseSensitive = false,
      sortBy = 'score'
    } = options;

    const normalizedQuery = caseSensitive ? query : query.toLowerCase();
    const results: SearchResult<T>[] = [];

    this.searchIndex.forEach(index => {
      let content = caseSensitive ? index.content : index.content.toLowerCase();

      // Filter by fields if specified
      if (fields && fields.length > 0) {
        content = fields
          .map(field => String(index.fields[field] || ''))
          .join(' ')
          .toLowerCase();
      }

      // Calculate score
      let score = 0;
      const matches: Array<{ field: string; indices: [number, number][] }> = [];

      if (fuzzy) {
        score = this.fuzzyMatch(normalizedQuery, content);
      } else {
        score = content.includes(normalizedQuery) ? 1 : 0;
      }

      if (score >= threshold) {
        // Find match indices
        const fieldMatches = this.findMatches(normalizedQuery, index.fields, fields);

        results.push({
          item: index.fields as T,
          score,
          matches: fieldMatches,
          highlights: this.generateHighlights(index.fields, fieldMatches)
        });
      }
    });

    // Sort results
    results.sort((a, b) => {
      if (sortBy === 'score') {
        return b.score - a.score;
      }
      return 0;
    });

    // Limit results
    const limitedResults = limit ? results.slice(0, limit) : results;

    // Add to search history
    this.addToHistory(query);

    return limitedResults;
  }

  /**
   * Debounced search (returns Observable)
   */
  searchDebounced<T = LooseValue>(options: SearchOptions = {}): Observable<SearchResult<T>[]> {
    return this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      map(query => this.search<T>(query, options))
    );
  }

  /**
   * Trigger debounced search
   */
  triggerSearch(query: string): void {
    this.searchSubject.next(query);
  }

  /**
   * Get search suggestions
   */
  getSuggestions(query: string, limit: number = 5): string[] {
    if (!query.trim()) return this.recentSearches();

    const normalizedQuery = query.toLowerCase();
    const suggestions = new Set<string>();

    // Get from history
    this._searchHistory().forEach(term => {
      if (term.toLowerCase().includes(normalizedQuery)) {
        suggestions.add(term);
      }
    });

    // Get from indexed content
    this.searchIndex.forEach(index => {
      const words = index.content.split(/\s+/);
      words.forEach(word => {
        if (word.toLowerCase().startsWith(normalizedQuery)) {
          suggestions.add(word);
        }
      });
    });

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Clear search index
   */
  clearIndex(category?: string): void {
    if (category) {
      Array.from(this.searchIndex.entries()).forEach(([id, index]) => {
        if (index.metadata?.category === category) {
          this.searchIndex.delete(id);
        }
      });
    } else {
      this.searchIndex.clear();
    }

    if (environment.enableDebugLogs)
      console.log(`[Search] Cleared index${category ? ` for category: ${category}` : ''}`);
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this._searchHistory.set([]);
    this.saveSearchHistory();
  }

  /**
   * Remove from history
   */
  removeFromHistory(query: string): void {
    this._searchHistory.update(history => history.filter(q => q !== query));
    this.saveSearchHistory();
  }

  /**
   * Fuzzy match algorithm (Levenshtein-based)
   */
  private fuzzyMatch(query: string, content: string): number {
    // Simple substring match for performance
    if (content.includes(query)) return 1.0;

    // Check word boundaries
    const words = content.split(/\s+/);
    let bestScore = 0;

    words.forEach(word => {
      const similarity = this.stringSimilarity(query, word);
      bestScore = Math.max(bestScore, similarity);
    });

    return bestScore;
  }

  /**
   * Calculate string similarity (0-1)
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Find matches in fields
   */
  private findMatches(
    query: string,
    fields: Record<string, LooseValue>,
    searchFields?: string[]
  ): Array<{ field: string; indices: [number, number][] }> {
    const matches: Array<{ field: string; indices: [number, number][] }> = [];

    const fieldsToSearch = searchFields || Object.keys(fields);

    fieldsToSearch.forEach(field => {
      const value = String(fields[field] || '').toLowerCase();
      const indices: [number, number][] = [];

      let index = value.indexOf(query.toLowerCase());
      while (index !== -1) {
        indices.push([index, index + query.length]);
        index = value.indexOf(query.toLowerCase(), index + 1);
      }

      if (indices.length > 0) {
        matches.push({ field, indices });
      }
    });

    return matches;
  }

  /**
   * Generate highlights
   */
  private generateHighlights(
    fields: Record<string, LooseValue>,
    matches: Array<{ field: string; indices: [number, number][] }>
  ): Record<string, string> {
    const highlights: Record<string, string> = {};

    matches.forEach(({ field, indices }) => {
      const value = String(fields[field] || '');
      let highlighted = value;

      // Sort indices in reverse to avoid offset issues
      const sortedIndices = [...indices].sort((a, b) => b[0] - a[0]);

      sortedIndices.forEach(([start, end]) => {
        const before = highlighted.substring(0, start);
        const match = highlighted.substring(start, end);
        const after = highlighted.substring(end);
        highlighted = `${before}<mark>${match}</mark>${after}`;
      });

      highlights[field] = highlighted;
    });

    return highlights;
  }

  /**
   * Extract content from item
   */
  private extractContent(item: LooseValue, fields: string[]): string {
    return fields.map(field => String(item[field] || '')).join(' ');
  }

  /**
   * Get item ID
   */
  private getItemId(item: LooseValue): string {
    return item.id || item._id || JSON.stringify(item);
  }

  /**
   * Add to search history
   */
  private addToHistory(query: string): void {
    if (!query.trim()) return;

    this._searchHistory.update(history => {
      const filtered = history.filter(q => q !== query);
      const updated = [query, ...filtered];
      return updated.slice(0, this.MAX_HISTORY);
    });

    this.saveSearchHistory();
  }

  /**
   * Load search history
   */
  private loadSearchHistory(): string[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save search history
   */
  private saveSearchHistory(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._searchHistory()));
    } catch (error) {
      console.error('[Search] Error saving history:', error);
    }
  }

  /**
   * Setup debounced search
   */
  private setupDebouncedSearch(): void {
    // Observable is set up in searchDebounced()
  }
}
