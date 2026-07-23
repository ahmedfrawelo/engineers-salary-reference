export type LooseValue = ReturnType<typeof JSON.parse>;

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  serverId?: number;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  isArchived?: boolean;
  receiverUserId?: string;
  createdByUserId?: string;
  createdByUserName?: string;
  createdByUserAvatarUrl?: string;
  subject?: string | null;
  summary?: string | null;
  entityType?: string;
  entityId?: number | null;
  readAt?: number | null;
  archivedAt?: number | null;
  actionUrl?: string;
  actionLabel?: string;
  icon?: string;
  sourceModule?: string;
  metadata?: Record<string, LooseValue>;
}

export interface NotificationFilter {
  type?: NotificationType;
  priority?: NotificationPriority;
  unreadOnly?: boolean;
  archivedOnly?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface NotificationStats {
  total: number;
  active: number;
  archived: number;
  read: number;
  unread: number;
}

export interface NotificationPageMeta {
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export const DEFAULT_NOTIFICATION_STATS: NotificationStats = {
  total: 0,
  active: 0,
  archived: 0,
  read: 0,
  unread: 0
};

export const DEFAULT_NOTIFICATION_PAGE_META: NotificationPageMeta = {
  totalCount: 0,
  pageNumber: 1,
  pageSize: 20,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false
};
