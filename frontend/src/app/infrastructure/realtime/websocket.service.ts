export {
  WebSocketService,
  type WebSocketConfig,
  type WebSocketMessage
} from '@platform/angular/realtime/websocket.service';
export {
  extractRealtimeConnectedPayload,
  extractRealtimeEvent,
  hasRealtimeChannelPrefix,
  isIdentityRealtimeEvent,
  isMaterialsRealtimeEvent,
  isNotificationRealtimeEvent,
  isSuppliersRealtimeEvent,
  isTasksRealtimeEvent,
  isTenderProjectsRealtimeEvent,
  matchesRealtimeModule,
  type RealtimeConnectedPayload,
  type RealtimeEventPayload
} from '@platform/angular/realtime/realtime-events';
