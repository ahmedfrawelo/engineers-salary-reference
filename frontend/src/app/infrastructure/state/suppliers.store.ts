import { Injectable, signal, computed, inject } from '@angular/core';
import { QueryCacheService } from '@core/cache/query-cache.service';
import { ApiClient } from '@infrastructure/http/api-client.service';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Supplier Interface
 */
export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: 'Active' | 'Inactive';
  rating?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Suppliers Store State
 */
interface SuppliersState {
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  filters: {
    search: string;
    status: 'Active' | 'Inactive' | 'All';
  };
}

/**
 * Suppliers Store
 *
 * Signal-based state management for suppliers feature
 *
 * Benefits:
 * - Centralized state
 * - Automatic UI updates
 * - Better performance with OnPush
 * - Type-safe
 * - Easy testing
 *
 * @example
 * ```typescript
 * constructor(private suppliersStore: SuppliersStore) {}
 *
 * ngOnInit() {
 *   this.suppliersStore.load();
 *
 *   // Use in template
 *   this.suppliers = this.suppliersStore.suppliers;
 *   this.loading = this.suppliersStore.loading;
 * }
 *
 * addSupplier() {
 *   this.suppliersStore.add(newSupplier);
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class SuppliersStore {
  private api = inject(ApiClient);
  private cache = inject(QueryCacheService);

  // Private state
  private state = signal<SuppliersState>({
    suppliers: [],
    loading: false,
    error: null,
    selectedId: null,
    filters: {
      search: '',
      status: 'All'
    }
  });

  // Public computed selectors
  readonly suppliers = computed(() => this.state().suppliers);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly selectedId = computed(() => this.state().selectedId);
  readonly filters = computed(() => this.state().filters);

  // Filtered suppliers
  readonly filteredSuppliers = computed(() => {
    const { suppliers, filters } = this.state();
    let result = suppliers;

    // Filter by search
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        s =>
          s.name.toLowerCase().includes(search) ||
          s.email?.toLowerCase().includes(search) ||
          s.phone?.includes(search)
      );
    }

    // Filter by status
    if (filters.status !== 'All') {
      result = result.filter(s => s.status === filters.status);
    }

    return result;
  });

  // Selected supplier
  readonly selectedSupplier = computed(() => {
    const id = this.state().selectedId;
    if (!id) return null;
    return this.state().suppliers.find(s => s.id === id) || null;
  });

  // Statistics
  readonly stats = computed(() => {
    const suppliers = this.state().suppliers;
    return {
      total: suppliers.length,
      active: suppliers.filter(s => s.status === 'Active').length,
      inactive: suppliers.filter(s => s.status === 'Inactive').length,
      avgRating: suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length || 0
    };
  });

  // ==================== Actions ====================

  /**
   * Load all suppliers from API
   */
  async load(useCache = true): Promise<void> {
    this.state.update(s => ({ ...s, loading: true, error: null }));

    try {
      const suppliers$ = useCache
        ? this.cache.query<Supplier[]>('suppliers', () => this.api.get<Supplier[]>('Suppliers'), {
            ttl: 5 * 60 * 1000, // 5 minutes
            staleWhileRevalidate: true
          })
        : this.api.get<Supplier[]>('Suppliers');

      suppliers$.subscribe({
        next: suppliers => {
          this.state.update(s => ({
            ...s,
            suppliers,
            loading: false
          }));
        },
        error: error => {
          this.state.update(s => ({
            ...s,
            error: error.message || 'Failed to load suppliers',
            loading: false
          }));
        }
      });
    } catch (error: LooseValue) {
      this.state.update(s => ({
        ...s,
        error: error.message || 'Failed to load suppliers',
        loading: false
      }));
    }
  }

  /**
   * Add new supplier
   */
  async add(supplier: Omit<Supplier, 'id'>): Promise<void> {
    this.state.update(s => ({ ...s, loading: true, error: null }));

    try {
      this.api.post<Supplier>('Suppliers', supplier).subscribe({
        next: newSupplier => {
          this.state.update(s => ({
            ...s,
            suppliers: [...s.suppliers, newSupplier],
            loading: false
          }));

          // Invalidate cache
          this.cache.invalidate('suppliers');
        },
        error: error => {
          this.state.update(s => ({
            ...s,
            error: error.message || 'Failed to add supplier',
            loading: false
          }));
        }
      });
    } catch (error: LooseValue) {
      this.state.update(s => ({
        ...s,
        error: error.message || 'Failed to add supplier',
        loading: false
      }));
    }
  }

  /**
   * Update supplier
   */
  async update(id: string, updates: Partial<Supplier>): Promise<void> {
    this.state.update(s => ({ ...s, loading: true, error: null }));

    try {
      this.api.put<Supplier>(`Suppliers/${id}`, updates).subscribe({
        next: updated => {
          this.state.update(s => ({
            ...s,
            suppliers: s.suppliers.map(supplier =>
              supplier.id === id ? { ...supplier, ...updated } : supplier
            ),
            loading: false
          }));

          // Invalidate cache
          this.cache.invalidate('suppliers');
        },
        error: error => {
          this.state.update(s => ({
            ...s,
            error: error.message || 'Failed to update supplier',
            loading: false
          }));
        }
      });
    } catch (error: LooseValue) {
      this.state.update(s => ({
        ...s,
        error: error.message || 'Failed to update supplier',
        loading: false
      }));
    }
  }

  /**
   * Delete supplier
   */
  async delete(id: string): Promise<void> {
    this.state.update(s => ({ ...s, loading: true, error: null }));

    try {
      this.api.delete(`Suppliers/${id}`).subscribe({
        next: () => {
          this.state.update(s => ({
            ...s,
            suppliers: s.suppliers.filter(supplier => supplier.id !== id),
            loading: false
          }));

          // Invalidate cache
          this.cache.invalidate('suppliers');
        },
        error: error => {
          this.state.update(s => ({
            ...s,
            error: error.message || 'Failed to delete supplier',
            loading: false
          }));
        }
      });
    } catch (error: LooseValue) {
      this.state.update(s => ({
        ...s,
        error: error.message || 'Failed to delete supplier',
        loading: false
      }));
    }
  }

  /**
   * Select supplier
   */
  select(id: string | null): void {
    this.state.update(s => ({ ...s, selectedId: id }));
  }

  /**
   * Update filters
   */
  setFilter(key: keyof SuppliersState['filters'], value: LooseValue): void {
    this.state.update(s => ({
      ...s,
      filters: { ...s.filters, [key]: value }
    }));
  }

  /**
   * Clear filters
   */
  clearFilters(): void {
    this.state.update(s => ({
      ...s,
      filters: {
        search: '',
        status: 'All'
      }
    }));
  }

  /**
   * Reset state
   */
  reset(): void {
    this.state.set({
      suppliers: [],
      loading: false,
      error: null,
      selectedId: null,
      filters: {
        search: '',
        status: 'All'
      }
    });
  }
}
