import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Activity Type
 */
export type ActivityType =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject'
  | 'comment'
  | 'upload'
  | 'download'
  | 'share'
  | 'system';

/**
 * Activity Entity
 */
export type ActivityEntity =
  | 'supplier'
  | 'project'
  | 'material'
  | 'tender'
  | 'user'
  | 'document'
  | 'report'
  | 'system';

/**
 * Activity Item
 */
export interface Activity {
  id: string;
  type: ActivityType;
  entity: ActivityEntity;
  entityId?: string;
  entityName?: string;
  action: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: number;
  metadata?: Record<string, LooseValue>;
  icon?: string;
  color?: string;
}

/**
 * Activity Filter
 */
export interface ActivityFilter {
  type?: ActivityType;
  entity?: ActivityEntity;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
}

/**
 * Activity Timeline Service
 *
 * Track and display user activities and system events
 *
 * Features:
 * - Comprehensive activity logging
 * - Timeline visualization
 * - Filtering and search
 * - User-specific activities
 * - Audit trail
 * - Export capabilities
 *
 * @example
 * ```typescript
 * // Log activity
 * this.activityTimeline.log({
 *   type: 'create',
 *   entity: 'supplier',
 *   action: 'إضافة مورد جديد',
 *   description: 'تم إضافة المورد: شركة ABC'
 * });
 *
 * // Get recent activities
 * const recent = this.activityTimeline.getRecent(10);
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ActivityTimelineService {
  private readonly STORAGE_KEY = 'app-activities';
  private readonly MAX_ACTIVITIES = 1000;

  // Signals
  private _activities = signal<Activity[]>(this.loadFromStorage());
  readonly activities = this._activities.asReadonly();

  // Computed signals
  readonly todayActivities = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return this._activities().filter(a => a.timestamp >= todayTimestamp);
  });

  readonly recentActivities = computed(() => this._activities().slice(0, 20));

  constructor() {
    this.setupAutoSave();
  }

  /**
   * Log activity
   */
  log(activity: Omit<Activity, 'id' | 'timestamp' | 'userId' | 'userName'>): void {
    // Get current user (in real app, from AuthService)
    const currentUser = this.getCurrentUser();

    const newActivity: Activity = {
      id: this.generateId(),
      timestamp: Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      icon: this.getDefaultIcon(activity.type),
      color: this.getDefaultColor(activity.type),
      ...activity
    };

    this._activities.update(activities => {
      const updated = [newActivity, ...activities];
      return updated.slice(0, this.MAX_ACTIVITIES);
    });

    if (environment.enableDebugLogs) console.log(`[ActivityTimeline] Logged: ${activity.action}`);
  }

  /**
   * Get activities by filter
   */
  filter(filter: ActivityFilter): Activity[] {
    let filtered = this._activities();

    if (filter.type) {
      filtered = filtered.filter(a => a.type === filter.type);
    }

    if (filter.entity) {
      filtered = filtered.filter(a => a.entity === filter.entity);
    }

    if (filter.userId) {
      filtered = filtered.filter(a => a.userId === filter.userId);
    }

    if (filter.startDate) {
      filtered = filtered.filter(a => a.timestamp >= filter.startDate!.getTime());
    }

    if (filter.endDate) {
      filtered = filtered.filter(a => a.timestamp <= filter.endDate!.getTime());
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(
        a =>
          a.action.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.userName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  /**
   * Get recent activities
   */
  getRecent(count: number = 10): Activity[] {
    return this._activities().slice(0, count);
  }

  /**
   * Get activities by user
   */
  getByUser(userId: string, limit?: number): Activity[] {
    const userActivities = this._activities().filter(a => a.userId === userId);
    return limit ? userActivities.slice(0, limit) : userActivities;
  }

  /**
   * Get activities by entity
   */
  getByEntity(entity: ActivityEntity, entityId?: string): Activity[] {
    return this._activities().filter(
      a => a.entity === entity && (!entityId || a.entityId === entityId)
    );
  }

  /**
   * Get activities by type
   */
  getByType(type: ActivityType): Activity[] {
    return this._activities().filter(a => a.type === type);
  }

  /**
   * Get activities grouped by date
   */
  getGroupedByDate(): Map<string, Activity[]> {
    const grouped = new Map<string, Activity[]>();

    this._activities().forEach(activity => {
      const date = new Date(activity.timestamp);
      const dateKey = date.toISOString().split('T')[0];

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(activity);
    });

    return grouped;
  }

  /**
   * Get activity statistics
   */
  getStats(): {
    total: number;
    today: number;
    thisWeek: number;
    byType: Record<ActivityType, number>;
    byEntity: Record<ActivityEntity, number>;
    topUsers: Array<{ userId: string; userName: string; count: number }>;
  } {
    const activities = this._activities();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const weekTimestamp = weekAgo.getTime();

    const byType: Record<ActivityType, number> = {} as LooseValue;
    const byEntity: Record<ActivityEntity, number> = {} as LooseValue;
    const userCounts = new Map<string, { name: string; count: number }>();

    activities.forEach(a => {
      // Count by type
      byType[a.type] = (byType[a.type] || 0) + 1;

      // Count by entity
      byEntity[a.entity] = (byEntity[a.entity] || 0) + 1;

      // Count by user
      const userCount = userCounts.get(a.userId) || { name: a.userName, count: 0 };
      userCount.count++;
      userCounts.set(a.userId, userCount);
    });

    // Get top 5 users
    const topUsers = Array.from(userCounts.entries())
      .map(([userId, data]) => ({ userId, userName: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total: activities.length,
      today: activities.filter(a => a.timestamp >= todayTimestamp).length,
      thisWeek: activities.filter(a => a.timestamp >= weekTimestamp).length,
      byType,
      byEntity,
      topUsers
    };
  }

  /**
   * Clear activities
   */
  clear(): void {
    this._activities.set([]);
  }

  /**
   * Clear old activities
   */
  clearOld(daysToKeep: number = 90): void {
    const cutoffDate = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    this._activities.update(activities => activities.filter(a => a.timestamp > cutoffDate));

    if (environment.enableDebugLogs)
      console.log(`[ActivityTimeline] Cleared activities older than ${daysToKeep} days`);
  }

  /**
   * Export activities to JSON
   */
  exportToJSON(filter?: ActivityFilter): string {
    const activities = filter ? this.filter(filter) : this._activities();
    return JSON.stringify(activities, null, 2);
  }

  /**
   * Get default icon for activity type
   */
  private getDefaultIcon(type: ActivityType): string {
    const icons: Record<ActivityType, string> = {
      create: '➕',
      update: '✏️',
      delete: '🗑️',
      login: '🔐',
      logout: '🚪',
      export: '📤',
      import: '📥',
      approve: '✅',
      reject: '❌',
      comment: '💬',
      upload: '⬆️',
      download: '⬇️',
      share: '🔗',
      system: '⚙️'
    };

    return icons[type] || '📝';
  }

  /**
   * Get default color for activity type
   */
  private getDefaultColor(type: ActivityType): string {
    const colors: Record<ActivityType, string> = {
      create: '#84c718',
      update: '#0d6efd',
      delete: '#dc3545',
      login: '#6c757d',
      logout: '#6c757d',
      export: '#0dcaf0',
      import: '#0dcaf0',
      approve: '#28a745',
      reject: '#dc3545',
      comment: '#6f42c1',
      upload: '#fd7e14',
      download: '#fd7e14',
      share: '#20c997',
      system: '#6c757d'
    };

    return colors[type] || '#6c757d';
  }

  /**
   * Get current user (mock implementation)
   */
  private getCurrentUser(): { id: string; name: string } {
    // In real app, get from AuthService
    return {
      id: 'user-1',
      name: 'مستخدم النظام'
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): Activity[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[ActivityTimeline] Error loading from storage:', error);
      return [];
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._activities()));
    } catch (error) {
      console.error('[ActivityTimeline] Error saving to storage:', error);
    }
  }

  /**
   * Setup auto-save
   */
  private setupAutoSave(): void {
    setInterval(() => {
      this.saveToStorage();
    }, 10000); // Save every 10 seconds
  }
}
