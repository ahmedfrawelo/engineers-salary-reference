type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * TrackBy Helper Functions
 *
 * Reusable trackBy functions for *ngFor loops to improve performance.
 * TrackBy prevents unnecessary DOM re-renders by identifying items by their unique keys.
 *
 * @example
 * ```typescript
 * import { trackById, trackByIndex } from '@shared/utils/trackby.helpers';
 *
 * export class MyComponent {
 *   trackById = trackById;
 *   items = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
 * }
 * ```
 *
 * ```html
 * <div *ngFor="let item of items; trackBy: trackById">
 *   {{ item.name }}
 * </div>
 * ```
 */

/**
 * Track by `id` property
 */
export function trackById<T extends { id: string | number }>(
  index: number,
  item: T
): string | number {
  return item.id;
}

/**
 * Track by index (least performant, use only when items don't have unique IDs)
 */
export function trackByIndex(index: number): number {
  return index;
}

/**
 * Track by `_id` property (MongoDB)
 */
export function trackBy_Id<T extends { _id: string }>(index: number, item: T): string {
  return item._id;
}

/**
 * Track by `uuid` property
 */
export function trackByUuid<T extends { uuid: string }>(index: number, item: T): string {
  return item.uuid;
}

/**
 * Track by `code` property
 */
export function trackByCode<T extends { code: string | number }>(
  index: number,
  item: T
): string | number {
  return item.code;
}

/**
 * Track by `name` property (use only for truly unique names)
 */
export function trackByName<T extends { name: string }>(index: number, item: T): string {
  return item.name;
}

/**
 * Create custom trackBy function for any property
 *
 * @example
 * ```typescript
 * const trackByEmail = createTrackByFn('email');
 * ```
 */
export function createTrackByFn<T>(property: keyof T) {
  return (index: number, item: T): LooseValue => item[property];
}

/**
 * Track by composite key (multiple properties)
 *
 * @example
 * ```typescript
 * const trackByComposite = createCompositeTrackBy(['projectId', 'supplierId']);
 * ```
 */
export function createCompositeTrackBy<T>(properties: (keyof T)[]) {
  return (index: number, item: T): string => {
    return properties.map(prop => item[prop]).join('_');
  };
}

/**
 * Track by object identity (for immutable data)
 * Uses object reference, most performant when using immutable patterns
 */
export function trackByIdentity<T>(index: number, item: T): T {
  return item;
}

/**
 * Track by array position + ID (for sortable lists)
 * Combines index and ID to track both position and identity
 */
export function trackByPositionAndId<T extends { id: string | number }>(
  index: number,
  item: T
): string {
  return `${index}_${item.id}`;
}

/**
 * Generic trackBy factory for common patterns
 */
export class TrackByFactory {
  /**
   * Create trackBy for items with `id` property
   */
  static byId<T extends { id: LooseValue }>(): (index: number, item: T) => LooseValue {
    return trackById;
  }

  /**
   * Create trackBy for items with custom property
   */
  static byProperty<T>(prop: keyof T): (index: number, item: T) => LooseValue {
    return (index: number, item: T) => item[prop];
  }

  /**
   * Create trackBy for items with composite key
   */
  static byComposite<T>(...props: (keyof T)[]): (index: number, item: T) => string {
    return (index: number, item: T) => {
      return props.map(p => item[p]).join('_');
    };
  }
}
