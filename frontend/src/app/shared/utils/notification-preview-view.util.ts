import type { Notification } from '../../core/notifications/notification-center.service';
import {
  formatNotificationActionLabel,
  formatNotificationActorLabel,
  formatNotificationContextLabel,
  formatNotificationDisplaySubject,
  formatNotificationDisplayTitle,
  formatNotificationMessage,
  formatNotificationPriorityLabel,
  formatNotificationReferenceLabel,
  formatNotificationSourceLabel,
  formatNotificationTargetLabel,
  notificationTypeSymbol,
  shouldEmphasizeNotificationPriority
} from '../../core/notifications/utils/notification-presentation.util';
import {
  formatAbsoluteNotificationTime,
  formatNotificationDateTimeAttribute,
  formatRelativeNotificationTime
} from './notification-time.util';

export interface NotificationPreviewView {
  notification: Notification;
  id: string;
  read: boolean;
  type: string;
  typeIcon: string;
  avatarUrl: string | null;
  avatarInitials: string;
  avatarLabel: string;
  contextLabel: string | null;
  sourceLabel: string;
  timeLabel: string | null;
  absoluteTimeLabel: string | null;
  dateTime: string | null;
  showPriority: boolean;
  priority: string | undefined;
  priorityLabel: string;
  title: string;
  summary: string | null;
  message: string | null;
  actorLabel: string | null;
  targetLabel: string | null;
  referenceLabel: string | null;
  actionUrl: string | undefined;
  actionLabel: string;
}

function isMessagingNotification(notification: Notification): boolean {
  const entityType = (notification.entityType ?? '').replace(/[\s_-]+/g, '').toLowerCase();
  const sourceModule = (notification.sourceModule ?? '').replace(/[\s_-]+/g, '').toLowerCase();
  return entityType === 'message' || sourceModule === 'messaging';
}

function normalizePreviewText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAvatarUrl(value: string | null | undefined): string | null {
  const normalized = normalizePreviewText(value);
  return normalized || null;
}

function buildAvatarInitials(label: string): string {
  const tokens = normalizePreviewText(label)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length >= 2) {
    return `${tokens[0].charAt(0)}${tokens[1].charAt(0)}`.toUpperCase();
  }

  const singleToken = tokens[0] ?? 'N';
  return singleToken.slice(0, 2).toUpperCase();
}

export function buildNotificationPreviewView(notification: Notification): NotificationPreviewView {
  const isMessage = isMessagingNotification(notification);
  const contextLabel = formatNotificationContextLabel(
    notification.sourceModule,
    notification.entityType
  );
  const sourceLabel = formatNotificationSourceLabel(
    notification.sourceModule,
    notification.entityType
  );
  const normalizedActorLabel = formatNotificationActorLabel(notification.createdByUserName);
  const avatarUrl = normalizeAvatarUrl(notification.createdByUserAvatarUrl);
  const avatarDisplayLabel = normalizedActorLabel ?? contextLabel ?? sourceLabel ?? 'Notification';
  return {
    notification,
    id: notification.id,
    read: notification.read,
    type: notification.type,
    typeIcon: notificationTypeSymbol(notification.type),
    avatarUrl,
    avatarInitials: buildAvatarInitials(avatarDisplayLabel),
    avatarLabel: avatarDisplayLabel,
    contextLabel,
    sourceLabel,
    timeLabel: notification.timestamp
      ? formatRelativeNotificationTime(notification.timestamp)
      : null,
    absoluteTimeLabel: notification.timestamp
      ? formatAbsoluteNotificationTime(notification.timestamp)
      : null,
    dateTime: notification.timestamp
      ? formatNotificationDateTimeAttribute(notification.timestamp)
      : null,
    showPriority: shouldEmphasizeNotificationPriority(notification.priority),
    priority: notification.priority,
    priorityLabel: formatNotificationPriorityLabel(notification.priority),
    title: formatNotificationDisplayTitle(notification),
    summary: formatNotificationDisplaySubject(notification),
    message: formatNotificationMessage(notification),
    actorLabel: isMessage ? null : normalizedActorLabel,
    targetLabel: formatNotificationTargetLabel(notification),
    referenceLabel: formatNotificationReferenceLabel(notification),
    actionUrl: notification.actionUrl,
    actionLabel: formatNotificationActionLabel(notification.actionLabel, notification)
  };
}
