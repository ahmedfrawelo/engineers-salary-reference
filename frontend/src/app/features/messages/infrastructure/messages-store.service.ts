import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AUTH_USER_FACADE, type AuthUserFacade } from '@core/auth/auth-user.facade';
import { runtimeConfig } from '@core/runtime-config';
import { WebSocketService } from '@infrastructure/realtime/websocket.service';
import { environment } from '@env/environment';
import {
  ChatConversation,
  ChatMessage,
  ChatThreadSnapshot,
  ChatTypingState,
  ChatUser
} from '../domain/messages.models';
import { MessagesApiService } from './messages-api.service';

type LooseRecord = Record<string, unknown>;

interface ChatLocalPreferences {
  archivedConversationIds: string[];
  pinnedConversationIds: string[];
  starredMessageIds: string[];
  quickReplies: string[];
  drafts: Record<string, string>;
}

const TYPING_TTL_MS = 6500;
const TYPING_SEND_INTERVAL_MS = 300;
const ACTIVE_SYNC_INTERVAL_MS = 750;
const CONVERSATION_SYNC_INTERVAL_MS = 1800;
const READ_RECEIPT_INTERVAL_MS = 400;
const MESSAGE_WS_ACK_TIMEOUT_MS = 2800;
const MESSAGE_FAILURE_RECONCILE_DELAY_MS = 1200;
const CONVERSATION_REFRESH_DEBOUNCE_MS = 120;
const MESSAGE_REFRESH_DEBOUNCE_MS = 90;
const MESSAGES_LOAD_COOLDOWN_MS = 15000;
const USER_DIRECTORY_SEARCH_COOLDOWN_MS = 15000;
const CHAT_PREFERENCES_KEY = 'engineers-salary-reference.messages.preferences.v1';
const DEFAULT_CHAT_QUICK_REPLIES = [
  'Done, I will review and update you.',
  'I need more details before I confirm.',
  'Implemented.',
  'I will follow up with the team.'
];

@Injectable({ providedIn: 'root' })
export class MessagesStoreService implements OnDestroy {
  private readonly api = inject(MessagesApiService);
  private readonly auth = inject<AuthUserFacade>(AUTH_USER_FACADE);
  private readonly ws = inject(WebSocketService);
  private readonly wsSubscription: Subscription;
  private typingTimer?: ReturnType<typeof setInterval>;
  private activeSyncTimer?: ReturnType<typeof setInterval>;
  private conversationSyncTimer?: ReturnType<typeof setInterval>;
  private realtimeFallbackTimer?: ReturnType<typeof setInterval>;
  private subscribedUserChannel = '';
  private subscribedConversationChannel = '';
  private readonly deliveredMessageIds = new Set<string>();
  private readonly lastReadAtByConversation = new Map<string, number>();
  private readonly readReceiptTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly messageAckTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly messageFailureTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly messageRefreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly queuedMessageRefreshes = new Map<string, boolean>();
  private readonly activeMessageRefreshes = new Set<string>();
  private lastTypingSentAt = 0;
  private conversationRefreshTimer?: ReturnType<typeof setTimeout>;
  private conversationRefreshInFlight = false;
  private conversationRefreshQueued = false;
  private initialLoadInFlight = false;
  private queuedPreferredConversationId: string | null | undefined;
  private lastLoadedAt = 0;
  private userSearchInFlight = false;
  private queuedUserSearchQuery: string | null = null;
  private lastUserSearchQuery = '';
  private lastUserSearchAt = 0;

  readonly conversations = signal<ChatConversation[]>([]);
  readonly activeConversationId = signal<string | null>(null);
  readonly messagesByConversation = signal<Record<string, ChatMessage[]>>({});
  readonly directory = signal<ChatUser[]>([]);
  readonly typingStates = signal<ChatTypingState[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly localPreferences = signal<ChatLocalPreferences>(this.loadLocalPreferences());

  readonly currentUser = computed<ChatUser>(() => {
    const user = this.auth.user();
    const email = user?.email?.trim() || 'me@engineers-salary-reference.local';
    const serverUser = this.findServerCurrentUser(email);
    if (serverUser) {
      return {
        ...serverUser,
        name: serverUser.name?.trim() || user?.name?.trim() || email.split('@')[0] || 'Me',
        email: serverUser.email || email,
        online: true
      };
    }

    return {
      id: String(user?.id ?? email),
      name: user?.name?.trim() || email.split('@')[0] || 'Me',
      email,
      online: true
    };
  });

  readonly activeConversation = computed(() => {
    const activeId = this.activeConversationId();
    return this.conversations().find(item => item.id === activeId) ?? null;
  });

  readonly activeMessages = computed(() => {
    const activeId = this.activeConversationId();
    return activeId ? (this.messagesByConversation()[activeId] ?? []) : [];
  });

  readonly totalUnread = computed(() =>
    this.conversations().reduce((count, conversation) => count + conversation.unreadCount, 0)
  );
  readonly realtimeConnected = computed(() => this.ws.connected());
  readonly quickReplies = computed(() => {
    const savedReplies = this.localPreferences().quickReplies;
    return savedReplies.length ? savedReplies : DEFAULT_CHAT_QUICK_REPLIES;
  });

  readonly activeTypingLabel = computed(() => {
    const conversationId = this.activeConversationId();
    const names = this.typingStates()
      .filter(
        state => state.conversationId === conversationId && !this.isCurrentUserId(state.userId)
      )
      .map(state => state.userName);
    if (names.length === 0) {
      return '';
    }
    return names.length === 1 ? `${names[0]} is typing` : `${names.length} people are typing`;
  });

  readonly snapshot = computed<ChatThreadSnapshot>(() => ({
    conversations: this.conversations(),
    activeConversationId: this.activeConversationId(),
    messages: this.messagesByConversation(),
    directory: this.directory(),
    loading: this.loading(),
    sending: this.sending(),
    error: this.error()
  }));

  constructor() {
    this.ensureRealtimeConnection();
    this.ws.subscribeChannels(['module:messaging']);
    this.wsSubscription = this.ws.onAll().subscribe(message => this.applyRealtimeMessage(message));

    effect(() => {
      const userId = this.hasAuthenticatedSession() ? this.currentUser().id : '';
      this.syncUserRealtimeChannel(userId);
    });

    effect(() => {
      this.syncConversationRealtimeChannel(this.activeConversationId());
    });

    effect(() => {
      if (!this.hasAuthenticatedSession()) {
        this.stopRealtimeFallback();
        return;
      }

      if (this.ws.connected()) {
        this.error.set(null);
        this.stopRealtimeFallback();
      } else {
        this.startRealtimeFallback();
      }
    });

    effect(() => {
      if (this.hasAuthenticatedSession()) {
        return;
      }

      this.clearSessionState();
    });

    effect(() => {
      this.emitDeliveryReceipts(this.activeMessages());
    });

    this.typingTimer = setInterval(() => this.pruneTypingStates(), 1000);
    this.activeSyncTimer = setInterval(() => this.syncActiveThread(), ACTIVE_SYNC_INTERVAL_MS);
    this.conversationSyncTimer = setInterval(() => {
      if (this.ws.connected()) {
        return;
      }
      this.refreshConversationsSilently();
    }, CONVERSATION_SYNC_INTERVAL_MS);
  }

  load(preferredConversationId?: string | null): void {
    if (!this.hasAuthenticatedSession()) {
      this.clearSessionState();
      this.loading.set(false);
      this.error.set(null);
      return;
    }

    const preferredId = preferredConversationId?.trim() ?? '';
    if (this.initialLoadInFlight) {
      if (preferredId) {
        this.queuedPreferredConversationId = preferredId;
      }
      return;
    }

    const canReuseCurrentLoad =
      !preferredId &&
      this.conversations().length > 0 &&
      Date.now() - this.lastLoadedAt < MESSAGES_LOAD_COOLDOWN_MS;
    if (canReuseCurrentLoad) {
      return;
    }

    this.initialLoadInFlight = true;
    this.loading.set(true);
    this.error.set(null);

    this.api.listConversations().subscribe(conversations => {
      if (conversations) {
        const sortedConversations = this.sortConversations(
          this.mergeConversationCollection(conversations)
        );
        const currentActiveId = this.activeConversationId();
        const nextActiveId =
          preferredId && sortedConversations.some(item => item.id === preferredId)
            ? preferredId
            : sortedConversations.some(item => item.id === currentActiveId)
              ? currentActiveId
              : (sortedConversations[0]?.id ?? null);
        this.conversations.set(sortedConversations);
        this.activeConversationId.set(nextActiveId);
        this.error.set(null);
        this.loadActiveMessages(!!preferredId);
        if (nextActiveId) {
          this.markActiveRead();
        }
        this.lastLoadedAt = Date.now();
      } else {
        this.error.set(this.api.lastError() ?? 'Messages are unavailable right now.');
      }
      this.initialLoadInFlight = false;
      this.loading.set(false);
      if (this.queuedPreferredConversationId) {
        const queuedPreferredId = this.queuedPreferredConversationId;
        this.queuedPreferredConversationId = null;
        this.load(queuedPreferredId);
      }
    });

    this.searchUsers('');
  }

  refresh(): void {
    this.load(this.activeConversationId());
  }

  refreshActive(): void {
    const conversationId = this.activeConversationId();
    this.refreshConversationsSilently();
    if (conversationId && !conversationId.startsWith('pending-')) {
      this.refreshMessagesSilently(conversationId, true);
    }
  }

  selectConversation(conversationId: string): void {
    if (this.activeConversationId() === conversationId) {
      this.loadActiveMessages(true);
      this.markActiveRead();
      return;
    }
    this.activeConversationId.set(conversationId);
    this.loadActiveMessages(true);
    this.markActiveRead();
  }

  toggleConversationPinned(conversationId: string): void {
    const preferences = this.localPreferences();
    const isPinned = preferences.pinnedConversationIds.includes(conversationId);
    this.updateLocalPreferences({
      ...preferences,
      pinnedConversationIds: isPinned
        ? preferences.pinnedConversationIds.filter(id => id !== conversationId)
        : [...preferences.pinnedConversationIds, conversationId]
    });
    this.conversations.update(items => this.sortConversations(items));
  }

  archiveConversation(conversationId: string): void {
    const preferences = this.localPreferences();
    if (preferences.archivedConversationIds.includes(conversationId)) {
      return;
    }

    this.updateLocalPreferences({
      ...preferences,
      archivedConversationIds: [...preferences.archivedConversationIds, conversationId]
    });

    if (this.activeConversationId() === conversationId) {
      const nextConversation = this.conversations().find(
        conversation =>
          conversation.id !== conversationId && !this.isConversationArchived(conversation.id)
      );
      this.activeConversationId.set(nextConversation?.id ?? null);
      this.loadActiveMessages(true);
    }
  }

  restoreConversation(conversationId: string): void {
    const preferences = this.localPreferences();
    this.updateLocalPreferences({
      ...preferences,
      archivedConversationIds: preferences.archivedConversationIds.filter(
        id => id !== conversationId
      )
    });
  }

  isConversationPinned(conversationId: string): boolean {
    return this.localPreferences().pinnedConversationIds.includes(conversationId);
  }

  isConversationArchived(conversationId: string): boolean {
    return this.localPreferences().archivedConversationIds.includes(conversationId);
  }

  setConversationMuted(conversationId: string, muted: boolean): void {
    const current = this.conversations();
    this.conversations.update(items =>
      items.map(item => (item.id === conversationId ? { ...item, muted } : item))
    );

    this.api.setMuted(conversationId, muted).subscribe(remote => {
      if (remote) {
        this.upsertConversation(remote);
        return;
      }
      this.conversations.set(current);
      this.error.set(this.api.lastError() ?? 'Could not update conversation settings.');
    });
  }

  searchUsers(query: string): void {
    if (!this.hasAuthenticatedSession()) {
      this.directory.set([]);
      return;
    }

    const normalizedQuery = query.trim();
    if (this.userSearchInFlight) {
      this.queuedUserSearchQuery = normalizedQuery;
      return;
    }

    const canReuseDirectory =
      normalizedQuery === this.lastUserSearchQuery &&
      this.directory().length > 0 &&
      Date.now() - this.lastUserSearchAt < USER_DIRECTORY_SEARCH_COOLDOWN_MS;
    if (canReuseDirectory) {
      return;
    }

    this.userSearchInFlight = true;
    this.api.searchUsers(normalizedQuery).subscribe(users => {
      if (users) {
        this.directory.set(this.mergeUsers(users));
        this.lastUserSearchQuery = normalizedQuery;
        this.lastUserSearchAt = Date.now();
      } else {
        this.error.set(this.api.lastError() ?? 'User search is unavailable right now.');
      }
      this.userSearchInFlight = false;
      if (this.queuedUserSearchQuery != null && this.queuedUserSearchQuery !== normalizedQuery) {
        const queuedQuery = this.queuedUserSearchQuery;
        this.queuedUserSearchQuery = null;
        this.searchUsers(queuedQuery);
        return;
      }
      this.queuedUserSearchQuery = null;
    });
  }

  openDirect(user: ChatUser): void {
    const existing = this.conversations().find(
      conversation =>
        conversation.kind === 'direct' &&
        conversation.participants.some(item => item.id === user.id)
    );
    if (existing) {
      this.selectConversation(existing.id);
      return;
    }

    const pendingConversation = this.createPendingDirectConversation(user);
    this.upsertConversation(pendingConversation);
    this.activeConversationId.set(pendingConversation.id);
    this.messagesByConversation.update(current => ({
      ...current,
      [pendingConversation.id]: current[pendingConversation.id] ?? []
    }));
    this.error.set(null);

    this.api.openDirectConversation(user.id).subscribe(remote => {
      if (!remote) {
        this.error.set(this.api.lastError() ?? 'Could not sync this conversation with the server.');
        return;
      }
      this.error.set(null);
      this.replacePendingConversation(pendingConversation.id, remote);
    });
  }

  send(body: string): void {
    const trimmed = body.trim();
    const conversation = this.activeConversation();
    if (!trimmed || !conversation) {
      return;
    }

    this.error.set(null);

    const currentUser = this.currentUser();
    const optimistic: ChatMessage = {
      id: this.createId('local-message'),
      clientId: '',
      conversationId: conversation.id,
      senderId: currentUser.id,
      body: trimmed,
      createdAt: new Date().toISOString(),
      readBy: [currentUser.id],
      deliveredBy: [currentUser.id],
      deliveryState: 'sending'
    };
    optimistic.clientId = optimistic.id;

    this.sending.set(true);
    this.appendMessage(optimistic);
    if (conversation.pending && conversation.pendingUserId) {
      this.api.openDirectConversation(conversation.pendingUserId).subscribe(remote => {
        if (!remote) {
          this.replaceMessage(optimistic.id, { ...optimistic, deliveryState: 'failed' });
          this.sending.set(false);
          this.error.set(this.api.lastError() ?? 'Could not open this conversation on the server.');
          return;
        }

        const syncedMessage = { ...optimistic, conversationId: remote.id };
        this.replacePendingConversation(conversation.id, remote);
        this.appendMessage(syncedMessage);
        this.sendMessageToServer(remote.id, trimmed, syncedMessage);
      });
      return;
    }

    this.sendMessageToServer(conversation.id, trimmed, optimistic);
  }

  retryMessage(message: ChatMessage): void {
    if (message.deliveryState !== 'failed') {
      return;
    }

    const body = message.body.trim();
    if (!body) {
      return;
    }

    const retry: ChatMessage = {
      ...message,
      clientId: message.clientId || message.id,
      deliveryState: 'sending'
    };

    this.error.set(null);
    this.sending.set(true);
    this.replaceMessage(message.id, retry);
    this.sendMessageToServer(retry.conversationId, body, retry);
  }

  editMessage(message: ChatMessage, body: string): void {
    const trimmed = body.trim();
    if (!trimmed || message.id.startsWith('local-')) {
      return;
    }

    const previous = { ...message };
    const optimistic: ChatMessage = {
      ...message,
      body: trimmed,
      editedAt: new Date().toISOString()
    };
    this.error.set(null);
    this.replaceMessage(message.id, optimistic);

    this.api.editMessage(message.id, trimmed).subscribe(remote => {
      if (remote) {
        this.replaceMessage(optimistic.id, { ...remote, deliveryState: 'sent' });
        this.error.set(null);
        return;
      }
      this.replaceMessage(optimistic.id, previous);
      this.error.set(this.api.lastError() ?? 'Could not edit this message.');
    });
  }

  deleteMessage(message: ChatMessage): void {
    if (message.id.startsWith('local-')) {
      this.removeMessage(message);
      return;
    }

    this.error.set(null);
    this.removeMessage(message);
    this.api.deleteMessage(message.id).subscribe(success => {
      if (success) {
        this.error.set(null);
        return;
      }
      this.appendMessage(message);
      this.error.set(this.api.lastError() ?? 'Could not delete this message.');
    });
  }

  toggleMessageStarred(messageId: string): void {
    const preferences = this.localPreferences();
    const isStarred = preferences.starredMessageIds.includes(messageId);
    this.updateLocalPreferences({
      ...preferences,
      starredMessageIds: isStarred
        ? preferences.starredMessageIds.filter(id => id !== messageId)
        : [...preferences.starredMessageIds, messageId]
    });
  }

  isMessageStarred(messageId: string): boolean {
    return this.localPreferences().starredMessageIds.includes(messageId);
  }

  draftFor(conversationId: string | null | undefined): string {
    return conversationId ? (this.localPreferences().drafts[conversationId] ?? '') : '';
  }

  saveDraft(conversationId: string | null | undefined, value: string): void {
    if (!conversationId) {
      return;
    }
    const preferences = this.localPreferences();
    const drafts = { ...preferences.drafts };
    const trimmedValue = value.trim();
    if (trimmedValue) {
      drafts[conversationId] = value;
    } else {
      delete drafts[conversationId];
    }
    this.updateLocalPreferences({ ...preferences, drafts });
  }

  clearDraft(conversationId: string | null | undefined): void {
    if (!conversationId) {
      return;
    }
    const preferences = this.localPreferences();
    const drafts = { ...preferences.drafts };
    delete drafts[conversationId];
    this.updateLocalPreferences({ ...preferences, drafts });
  }

  addQuickReply(value: string): void {
    const reply = value.trim();
    if (!reply) {
      return;
    }

    const preferences = this.localPreferences();
    const quickReplies = [reply, ...preferences.quickReplies.filter(item => item !== reply)].slice(
      0,
      12
    );
    this.updateLocalPreferences({ ...preferences, quickReplies });
  }

  removeQuickReply(value: string): void {
    const preferences = this.localPreferences();
    const quickReplies = preferences.quickReplies.filter(item => item !== value);
    this.updateLocalPreferences({ ...preferences, quickReplies });
  }

  resetQuickReplies(): void {
    const preferences = this.localPreferences();
    this.updateLocalPreferences({ ...preferences, quickReplies: DEFAULT_CHAT_QUICK_REPLIES });
  }

  private sendMessageToServer(conversationId: string, body: string, optimistic: ChatMessage): void {
    if (this.ws.connected() && !conversationId.startsWith('pending-')) {
      this.sendMessageViaWebSocket(conversationId, body, optimistic);
      return;
    }

    this.sendMessageViaRest(conversationId, body, optimistic);
  }

  private sendMessageViaWebSocket(
    conversationId: string,
    body: string,
    optimistic: ChatMessage
  ): void {
    const clientId = optimistic.clientId ?? optimistic.id;
    this.clearMessageAckTimeout(clientId);
    this.ws.send('message:send', {
      conversationId,
      body,
      clientId
    });
    this.messageAckTimeouts.set(
      clientId,
      setTimeout(() => {
        this.messageAckTimeouts.delete(clientId);
        const pendingMessage = this.findMessageByClientId(clientId);
        if (!pendingMessage || pendingMessage.deliveryState !== 'sending') {
          return;
        }
        this.sendMessageViaRest(conversationId, body, pendingMessage);
      }, MESSAGE_WS_ACK_TIMEOUT_MS)
    );
  }

  private sendMessageViaRest(conversationId: string, body: string, optimistic: ChatMessage): void {
    const clientId = optimistic.clientId ?? optimistic.id;
    this.api.sendMessage(conversationId, body, clientId).subscribe(remote => {
      this.clearMessageAckTimeout(clientId);
      this.clearMessageFailureTimer(clientId);
      const current =
        this.findMessageByClientId(clientId) ?? this.findMessageById(remote?.id ?? optimistic.id);
      const currentDeliveryState = current?.deliveryState ?? optimistic.deliveryState;
      const wsAlreadyAcknowledged = !!current && currentDeliveryState !== 'sending';

      if (remote) {
        if (!wsAlreadyAcknowledged) {
          this.replaceMessage(optimistic.id, { ...remote, deliveryState: 'sent' });
        }
        this.error.set(null);
      } else {
        if (!wsAlreadyAcknowledged) {
          this.deferMessageFailure(
            conversationId,
            optimistic,
            this.api.lastError() ?? 'Message was not accepted by the server.'
          );
          return;
        }
        this.error.set(null);
      }
      this.sending.set(false);
    });
  }

  emitTyping(force = false): void {
    const conversationId = this.activeConversationId();
    if (!conversationId || conversationId.startsWith('pending-')) {
      return;
    }

    const now = Date.now();
    if (!force && now - this.lastTypingSentAt < TYPING_SEND_INTERVAL_MS) {
      return;
    }

    this.lastTypingSentAt = now;
    const typingPayload = {
      conversationId,
      userId: this.currentUser().id,
      userName: this.currentUser().name
    };

    if (this.ws.connected()) {
      this.ws.send('message:typing', typingPayload);
      return;
    }

    this.api.sendTyping(conversationId).subscribe();
  }

  markActiveRead(): void {
    if (!this.hasAuthenticatedSession()) {
      return;
    }

    const conversationId = this.activeConversationId();
    if (!conversationId) {
      return;
    }
    const currentUserId = this.currentUser().id;
    const activeThread = this.messagesByConversation()[conversationId] ?? [];
    const hasUnreadRemoteMessages = activeThread.some(
      message =>
        !this.isCurrentUserId(message.senderId) && !this.includesCurrentUser(message.readBy)
    );
    const hasUnreadConversation = this.conversations().some(
      item => item.id === conversationId && item.unreadCount > 0
    );
    if (!hasUnreadRemoteMessages && !hasUnreadConversation) {
      return;
    }
    this.applyLocalReadState(conversationId, currentUserId);
    this.requestReadReceipt(conversationId);
  }

  markConversationRead(conversationId: string): void {
    if (!this.hasAuthenticatedSession()) {
      return;
    }

    if (!conversationId) {
      return;
    }

    this.applyLocalReadState(conversationId, this.currentUser().id);
    this.requestReadReceipt(conversationId, true);
  }

  private loadActiveMessages(force = false): void {
    const conversationId = this.activeConversationId();
    if (!conversationId || (!force && this.messagesByConversation()[conversationId]?.length)) {
      return;
    }
    this.api.listMessages(conversationId).subscribe(result => {
      if (result) {
        this.setConversationMessages(conversationId, result.items);
        this.error.set(null);
        this.markReadIfActive(conversationId);
      }
    });
  }

  private applyRealtimeMessage(message: { type: string; payload: unknown }): void {
    const type = message.type.toLowerCase();
    const payload = this.asRecord(message.payload);
    if (!payload) {
      return;
    }

    if (type === 'event' && this.isMessagingMessageSentEvent(payload)) {
      const conversationId = this.resolveRealtimeConversationId(payload);
      const incoming = this.normalizeRealtimeMessageSentEvent(payload, conversationId);
      if (incoming) {
        if (this.isCurrentUserId(incoming.senderId)) {
          this.ackOwnMessage(incoming);
          return;
        }

        this.appendIncomingMessage(incoming);
        return;
      }
      this.reloadAfterRealtimeMessage(conversationId);
      return;
    }

    if (type === 'event' && this.isMessagingConversationReadEvent(payload)) {
      this.applyReadReceipt(payload);
      return;
    }

    if (type === 'event' && this.isMessagingMessageMutationEvent(payload, 'edited')) {
      this.applyMessageMutation(payload, 'edited');
      return;
    }

    if (type === 'event' && this.isMessagingMessageMutationEvent(payload, 'deleted')) {
      this.applyMessageMutation(payload, 'deleted');
      return;
    }

    if (type === 'message:delivered' || type === 'messaging.delivered') {
      this.applyDeliveryReceipt(payload);
      return;
    }

    if (
      type === 'message:new' ||
      type === 'message:sent' ||
      type === 'message:ack' ||
      type === 'messaging.message.created' ||
      type === 'messaging.message.sent'
    ) {
      const conversationId = this.asString(payload['conversationId']);
      const incoming = this.normalizeRealtimeMessage(payload, conversationId);
      if (!incoming.conversationId) {
        return;
      }
      if (
        this.isCurrentUserId(incoming.senderId) ||
        (incoming.clientId && this.findMessageByClientId(incoming.clientId))
      ) {
        this.ackOwnMessage(incoming);
        return;
      }
      this.appendIncomingMessage(incoming);
      return;
    }

    if (type === 'message:typing' || type === 'messaging.typing') {
      const conversationId = this.asString(payload['conversationId']);
      const userId = this.asString(payload['userId']);
      if (!conversationId || !userId || userId === this.currentUser().id) {
        return;
      }
      this.typingStates.update(states => [
        ...states.filter(
          state => !(state.conversationId === conversationId && state.userId === userId)
        ),
        {
          conversationId,
          userId,
          userName: this.asString(payload['userName']) || 'Someone',
          expiresAt: Date.now() + TYPING_TTL_MS
        }
      ]);
    }
  }

  private appendIncomingMessage(message: ChatMessage): void {
    this.clearTypingState(message.conversationId, message.senderId);
    const hasConversation = this.appendMessage(message);
    this.emitDeliveryReceipt(message);
    this.markReadIfActive(message.conversationId);
    if (!hasConversation) {
      this.scheduleConversationRefresh();
    }
  }

  private appendMessage(message: ChatMessage): boolean {
    const hasConversation = this.hasConversation(message.conversationId);
    this.messagesByConversation.update(current => {
      const thread = current[message.conversationId] ?? [];
      if (thread.some(item => item.id === message.id)) {
        return current;
      }
      return {
        ...current,
        [message.conversationId]: [...thread, message].sort(this.sortMessages)
      };
    });

    this.conversations.update(items =>
      this.sortConversations(
        items.map(item => {
          if (item.id !== message.conversationId) {
            return item;
          }
          const isActive = this.activeConversationId() === item.id;
          const isOwn = this.isCurrentUserId(message.senderId);
          return {
            ...item,
            lastMessage: message,
            unreadCount: isActive || isOwn ? 0 : item.unreadCount + 1,
            updatedAt: message.createdAt
          };
        })
      )
    );

    return hasConversation;
  }

  private replaceMessage(localId: string, next: ChatMessage): void {
    this.messagesByConversation.update(current => {
      const thread = current[next.conversationId] ?? [];
      return {
        ...current,
        [next.conversationId]: thread.map(item => (item.id === localId ? next : item))
      };
    });
    this.conversations.update(items =>
      this.sortConversations(
        items.map(item =>
          item.lastMessage?.id === localId
            ? { ...item, lastMessage: next, updatedAt: next.createdAt }
            : item
        )
      )
    );
  }

  private removeMessage(message: ChatMessage): void {
    this.messagesByConversation.update(current => {
      const thread = current[message.conversationId] ?? [];
      return {
        ...current,
        [message.conversationId]: thread.filter(item => item.id !== message.id)
      };
    });

    this.conversations.update(items =>
      this.sortConversations(
        items.map(item => {
          if (item.lastMessage?.id !== message.id) {
            return item;
          }
          const thread = (this.messagesByConversation()[message.conversationId] ?? []).filter(
            nextMessage => nextMessage.id !== message.id
          );
          const lastMessage = thread[thread.length - 1] ?? null;
          return {
            ...item,
            lastMessage,
            updatedAt: lastMessage?.createdAt ?? item.updatedAt
          };
        })
      )
    );
  }

  private ackOwnMessage(message: ChatMessage): void {
    const clientId = message.clientId || message.id;
    this.clearMessageAckTimeout(clientId);
    this.clearMessageFailureTimer(clientId);
    const local = this.findMessageByClientId(clientId) ?? this.findMessageById(message.id);
    const acknowledged = {
      ...message,
      readBy: this.mergeUserId(message.readBy, this.currentUser().id),
      deliveredBy: this.mergeUserId(message.deliveredBy, this.currentUser().id),
      deliveryState: 'sent' as const
    };

    if (local) {
      this.replaceMessage(local.id, acknowledged);
    } else {
      const hasConversation = this.appendMessage(acknowledged);
      if (!hasConversation) {
        this.scheduleConversationRefresh();
      }
    }
    this.error.set(null);
    this.sending.set(false);
  }

  private findMessageByClientId(clientId: string): ChatMessage | null {
    for (const messages of Object.values(this.messagesByConversation())) {
      const match = messages.find(
        message => message.id === clientId || message.clientId === clientId
      );
      if (match) {
        return match;
      }
    }
    return null;
  }

  private findMessageById(messageId: string): ChatMessage | null {
    if (!messageId) {
      return null;
    }

    for (const messages of Object.values(this.messagesByConversation())) {
      const match = messages.find(message => message.id === messageId);
      if (match) {
        return match;
      }
    }
    return null;
  }

  private markReadIfActive(conversationId: string): void {
    if (this.activeConversationId() === conversationId) {
      this.markActiveRead();
    }
  }

  private createPendingDirectConversation(user: ChatUser): ChatConversation {
    const now = new Date().toISOString();
    return {
      id: `pending-${user.id}`,
      kind: 'direct',
      title: user.name,
      participants: [this.currentUser(), user],
      lastMessage: null,
      unreadCount: 0,
      updatedAt: now,
      pending: true,
      pendingUserId: user.id
    };
  }

  private replacePendingConversation(pendingId: string, remote: ChatConversation): void {
    const pendingMessages = this.messagesByConversation()[pendingId] ?? [];
    this.messagesByConversation.update(current => {
      const next = { ...current };
      delete next[pendingId];
      next[remote.id] = [
        ...(current[remote.id] ?? []),
        ...pendingMessages.map(message => ({ ...message, conversationId: remote.id }))
      ].sort(this.sortMessages);
      return next;
    });

    this.conversations.update(items =>
      this.sortConversations(
        items.map(item =>
          item.id === pendingId
            ? {
                ...remote,
                lastMessage:
                  pendingMessages[pendingMessages.length - 1] ?? remote.lastMessage ?? null,
                pending: false
              }
            : item
        )
      )
    );

    if (this.activeConversationId() === pendingId) {
      this.activeConversationId.set(remote.id);
    }
  }

  private reloadAfterRealtimeMessage(conversationId: string): void {
    this.scheduleConversationRefresh();

    const activeId = this.activeConversationId();
    if (!activeId || (conversationId && activeId !== conversationId)) {
      return;
    }

    this.scheduleMessageRefresh(activeId, true);
  }

  private refreshConversationsSilently(): void {
    if (!this.hasAuthenticatedSession()) {
      return;
    }

    if (this.conversationRefreshInFlight) {
      this.conversationRefreshQueued = true;
      return;
    }

    this.conversationRefreshInFlight = true;
    this.api.listConversations().subscribe(conversations => {
      if (conversations) {
        this.conversations.set(
          this.sortConversations(this.mergeConversationCollection(conversations))
        );
        this.error.set(null);
      }
      this.conversationRefreshInFlight = false;
      if (this.conversationRefreshQueued) {
        this.conversationRefreshQueued = false;
        this.scheduleConversationRefresh(0);
      }
    });
  }

  private refreshMessagesSilently(conversationId: string, markRead = false): void {
    if (!this.hasAuthenticatedSession()) {
      return;
    }

    if (this.activeMessageRefreshes.has(conversationId)) {
      this.queuedMessageRefreshes.set(
        conversationId,
        markRead || this.queuedMessageRefreshes.get(conversationId) === true
      );
      return;
    }

    this.activeMessageRefreshes.add(conversationId);
    this.api.listMessages(conversationId).subscribe(result => {
      this.activeMessageRefreshes.delete(conversationId);
      if (!result) {
        this.flushQueuedMessageRefresh(conversationId);
        return;
      }
      this.setConversationMessages(conversationId, result.items);
      this.error.set(null);
      if (markRead) {
        this.markActiveRead();
      }
      this.flushQueuedMessageRefresh(conversationId);
    });
  }

  private syncActiveThread(): void {
    if (!this.hasAuthenticatedSession()) {
      return;
    }

    if (this.loading()) {
      return;
    }

    const activeId = this.activeConversationId();
    if (!activeId || activeId.startsWith('pending-')) {
      return;
    }

    if (this.ws.connected()) {
      this.markActiveRead();
      return;
    }

    this.refreshMessagesSilently(activeId, true);
    this.api.listTyping(activeId).subscribe(states => {
      if (!states) {
        return;
      }
      const now = Date.now();
      this.typingStates.update(current => [
        ...current.filter(state => state.conversationId !== activeId),
        ...states.filter(state => state.expiresAt > now)
      ]);
    });
  }

  private startRealtimeFallback(): void {
    if (!this.hasAuthenticatedSession()) {
      return;
    }

    if (this.realtimeFallbackTimer) {
      return;
    }

    this.realtimeFallbackTimer = setInterval(() => {
      if (this.loading() || this.sending()) {
        return;
      }

      this.scheduleConversationRefresh(0);
      const activeId = this.activeConversationId();
      if (activeId) {
        this.scheduleMessageRefresh(activeId, false, 0);
      }
    }, CONVERSATION_SYNC_INTERVAL_MS);
  }

  private stopRealtimeFallback(): void {
    if (!this.realtimeFallbackTimer) {
      return;
    }

    clearInterval(this.realtimeFallbackTimer);
    this.realtimeFallbackTimer = undefined;
  }

  private isMessagingMessageSentEvent(payload: LooseRecord): boolean {
    return (
      this.asString(payload['module']).toLowerCase() === 'messaging' &&
      this.asString(payload['entityName']).toLowerCase() === 'message' &&
      ['created', 'sent'].includes(this.asString(payload['action']).toLowerCase())
    );
  }

  private isMessagingConversationReadEvent(payload: LooseRecord): boolean {
    return (
      this.asString(payload['module']).toLowerCase() === 'messaging' &&
      this.asString(payload['entityName']).toLowerCase() === 'conversation' &&
      this.asString(payload['action']).toLowerCase() === 'read'
    );
  }

  private isMessagingMessageMutationEvent(
    payload: LooseRecord,
    action: 'edited' | 'deleted'
  ): boolean {
    return (
      this.asString(payload['module']).toLowerCase() === 'messaging' &&
      this.asString(payload['entityName']).toLowerCase() === 'message' &&
      this.asString(payload['action']).toLowerCase() === action
    );
  }

  private applyMessageMutation(payload: LooseRecord, action: 'edited' | 'deleted'): void {
    const changedFields = Array.isArray(payload['changedFields']) ? payload['changedFields'] : [];
    const eventData = this.eventDataRecord(payload);
    const conversationId =
      this.valueAfterField(changedFields, 'conversation') ||
      this.asString(payload['conversationId']) ||
      this.asString(eventData?.['conversationId']);
    const messageId =
      this.valueAfterField(changedFields, 'message') ||
      this.asString(payload['entityId']) ||
      this.asString(eventData?.['id']);
    if (!conversationId || !messageId) {
      return;
    }

    if (action === 'deleted') {
      const existing = (this.messagesByConversation()[conversationId] ?? []).find(
        message => message.id === messageId
      );
      if (existing) {
        this.removeMessage(existing);
        return;
      }
      this.scheduleConversationRefresh();
      this.scheduleMessageRefresh(conversationId);
      return;
    }

    const body =
      this.valueAfterField(changedFields, 'body') ||
      this.asString(eventData?.['body'] ?? eventData?.['message']);
    const editedAt =
      this.valueAfterField(changedFields, 'editedAt') ||
      this.asString(eventData?.['editedAt']) ||
      new Date().toISOString();
    if (!body) {
      this.scheduleMessageRefresh(conversationId);
      return;
    }

    let updated = false;
    this.messagesByConversation.update(current => {
      const thread = current[conversationId] ?? [];
      updated = thread.some(message => message.id === messageId);
      return {
        ...current,
        [conversationId]: thread.map(message =>
          message.id === messageId ? { ...message, body, editedAt } : message
        )
      };
    });
    this.conversations.update(items =>
      items.map(item =>
        item.id === conversationId && item.lastMessage?.id === messageId
          ? {
              ...item,
              lastMessage: { ...item.lastMessage, body, editedAt }
            }
          : item
      )
    );
    if (!updated) {
      this.scheduleMessageRefresh(conversationId);
    }
  }

  private applyLocalReadState(conversationId: string, userId: string): void {
    let threadUpdated = false;
    this.messagesByConversation.update(current => {
      const thread = current[conversationId] ?? [];
      const nextThread = thread.map(message => {
        if (this.sameUserId(message.senderId, userId) || this.hasUserId(message.readBy, userId)) {
          return message;
        }

        threadUpdated = true;
        return {
          ...message,
          readBy: this.mergeUserId(message.readBy, userId),
          deliveredBy: this.mergeUserId(message.deliveredBy, userId)
        };
      });

      if (!threadUpdated) {
        return current;
      }

      return {
        ...current,
        [conversationId]: nextThread
      };
    });

    this.conversations.update(items =>
      items.map(item => {
        if (item.id !== conversationId) {
          return item;
        }

        if (!item.lastMessage) {
          return item.unreadCount === 0 ? item : { ...item, unreadCount: 0 };
        }

        if (
          this.sameUserId(item.lastMessage.senderId, userId) ||
          this.hasUserId(item.lastMessage.readBy, userId)
        ) {
          return item.unreadCount === 0 ? item : { ...item, unreadCount: 0 };
        }

        return {
          ...item,
          unreadCount: 0,
          lastMessage: {
            ...item.lastMessage,
            readBy: this.mergeUserId(item.lastMessage.readBy, userId),
            deliveredBy: this.mergeUserId(item.lastMessage.deliveredBy, userId)
          }
        };
      })
    );
  }

  private applyReadReceipt(payload: LooseRecord): void {
    const changedFields = Array.isArray(payload['changedFields']) ? payload['changedFields'] : [];
    const conversationId =
      this.valueAfterField(changedFields, 'conversation') || this.asString(payload['entityId']);
    const userId =
      this.valueAfterField(changedFields, 'user') || this.asString(payload['initiatedByUserId']);
    if (!conversationId || !userId) {
      return;
    }

    this.applyLocalReadState(conversationId, userId);
  }

  private applyDeliveryReceipt(payload: LooseRecord): void {
    const messageId = this.asString(payload['messageId']);
    const conversationId = this.asString(payload['conversationId']);
    const userId = this.asString(payload['userId']);
    if (!messageId || !conversationId || !userId || this.isCurrentUserId(userId)) {
      return;
    }

    this.messagesByConversation.update(current => {
      const thread = current[conversationId] ?? [];
      return {
        ...current,
        [conversationId]: thread.map(message =>
          message.id === messageId
            ? { ...message, deliveredBy: this.mergeUserId(message.deliveredBy, userId) }
            : message
        )
      };
    });
    this.conversations.update(items =>
      items.map(item =>
        item.id === conversationId && item.lastMessage?.id === messageId
          ? {
              ...item,
              lastMessage: {
                ...item.lastMessage,
                deliveredBy: this.mergeUserId(item.lastMessage.deliveredBy, userId)
              }
            }
          : item
      )
    );
  }

  private emitDeliveryReceipts(messages: ChatMessage[]): void {
    if (!this.ws.connected()) {
      return;
    }

    messages.forEach(message => this.emitDeliveryReceipt(message));
  }

  private emitDeliveryReceipt(message: ChatMessage): void {
    if (
      !this.ws.connected() ||
      !message.id ||
      message.id.startsWith('local-') ||
      this.isCurrentUserId(message.senderId) ||
      this.hasUserId(message.deliveredBy, this.currentUser().id) ||
      this.deliveredMessageIds.has(message.id)
    ) {
      return;
    }

    this.deliveredMessageIds.add(message.id);
    this.ws.send('message:delivered', {
      messageId: message.id,
      conversationId: message.conversationId
    });
  }

  private mergeUserId(values: string[] | undefined, userId: string): string[] {
    const normalizedUserId = this.normalizeIdentityValue(userId);
    if (!normalizedUserId) {
      return [...(values ?? [])];
    }

    const next = [...(values ?? [])];
    if (next.some(value => this.normalizeIdentityValue(value) === normalizedUserId)) {
      return next;
    }

    return [...next, userId];
  }

  private clearTypingState(conversationId: string, userId: string): void {
    if (!conversationId || !userId) {
      return;
    }

    this.typingStates.update(states =>
      states.filter(state => !(state.conversationId === conversationId && state.userId === userId))
    );
  }

  private scheduleConversationRefresh(delay = CONVERSATION_REFRESH_DEBOUNCE_MS): void {
    if (!this.hasAuthenticatedSession()) {
      return;
    }

    if (this.conversationRefreshTimer) {
      clearTimeout(this.conversationRefreshTimer);
    }

    this.conversationRefreshTimer = setTimeout(
      () => {
        this.conversationRefreshTimer = undefined;
        this.refreshConversationsSilently();
      },
      Math.max(0, delay)
    );
  }

  private scheduleMessageRefresh(
    conversationId: string,
    markRead = false,
    delay = MESSAGE_REFRESH_DEBOUNCE_MS
  ): void {
    if (!this.hasAuthenticatedSession() || !conversationId) {
      return;
    }

    const pendingMarkRead = markRead || this.queuedMessageRefreshes.get(conversationId) === true;
    this.queuedMessageRefreshes.set(conversationId, pendingMarkRead);

    const existingTimer = this.messageRefreshTimers.get(conversationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(
      () => {
        this.messageRefreshTimers.delete(conversationId);
        const nextMarkRead = this.queuedMessageRefreshes.get(conversationId) === true;
        this.queuedMessageRefreshes.delete(conversationId);
        this.refreshMessagesSilently(conversationId, nextMarkRead);
      },
      Math.max(0, delay)
    );

    this.messageRefreshTimers.set(conversationId, timer);
  }

  private flushQueuedMessageRefresh(conversationId: string): void {
    const nextMarkRead = this.queuedMessageRefreshes.get(conversationId) === true;
    if (!this.queuedMessageRefreshes.has(conversationId)) {
      return;
    }

    this.scheduleMessageRefresh(conversationId, nextMarkRead, 0);
  }

  private clearMessageAckTimeout(clientId: string | null | undefined): void {
    if (!clientId) {
      return;
    }

    const timer = this.messageAckTimeouts.get(clientId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.messageAckTimeouts.delete(clientId);
  }

  private clearMessageAckTimeouts(): void {
    this.messageAckTimeouts.forEach(timer => clearTimeout(timer));
    this.messageAckTimeouts.clear();
  }

  private clearMessageFailureTimer(clientId: string | null | undefined): void {
    if (!clientId) {
      return;
    }

    const timer = this.messageFailureTimers.get(clientId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.messageFailureTimers.delete(clientId);
  }

  private clearMessageFailureTimers(): void {
    this.messageFailureTimers.forEach(timer => clearTimeout(timer));
    this.messageFailureTimers.clear();
  }

  private deferMessageFailure(
    conversationId: string,
    optimistic: ChatMessage,
    reason: string
  ): void {
    const clientId = optimistic.clientId ?? optimistic.id;
    this.clearMessageFailureTimer(clientId);
    this.scheduleConversationRefresh(0);
    this.scheduleMessageRefresh(conversationId, false, 0);
    this.messageFailureTimers.set(
      clientId,
      setTimeout(() => {
        this.messageFailureTimers.delete(clientId);
        const pending =
          this.findMessageByClientId(clientId) ?? this.findMessageById(optimistic.id);
        if (!pending || pending.deliveryState !== 'sending') {
          this.error.set(null);
          this.sending.set(false);
          return;
        }

        this.replaceMessage(pending.id, { ...pending, deliveryState: 'failed' });
        this.error.set(reason);
        this.sending.set(false);
      }, MESSAGE_FAILURE_RECONCILE_DELAY_MS)
    );
  }

  private requestReadReceipt(conversationId: string, force = false): void {
    if (!conversationId || conversationId.startsWith('pending-')) {
      return;
    }

    const now = Date.now();
    const lastReadAt = this.lastReadAtByConversation.get(conversationId) ?? 0;
    const remaining = READ_RECEIPT_INTERVAL_MS - (now - lastReadAt);
    if (!force && remaining > 0) {
      this.scheduleReadReceipt(conversationId, remaining);
      return;
    }

    this.clearReadReceiptTimer(conversationId);
    this.lastReadAtByConversation.set(conversationId, now);
    this.api.markRead(conversationId).subscribe(success => {
      if (!success) {
        this.refreshConversationsSilently();
        this.scheduleMessageRefresh(conversationId, false, 0);
        return;
      }

      this.error.set(null);
      this.markReadIfActive(conversationId);
    });
  }

  private scheduleReadReceipt(conversationId: string, delayMs: number): void {
    if (this.readReceiptTimers.has(conversationId)) {
      return;
    }

    this.readReceiptTimers.set(
      conversationId,
      setTimeout(() => {
        this.readReceiptTimers.delete(conversationId);
        this.requestReadReceipt(conversationId);
      }, Math.max(40, delayMs))
    );
  }

  private clearReadReceiptTimer(conversationId: string): void {
    const timer = this.readReceiptTimers.get(conversationId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.readReceiptTimers.delete(conversationId);
  }

  private clearReadReceiptTimers(): void {
    this.readReceiptTimers.forEach(timer => clearTimeout(timer));
    this.readReceiptTimers.clear();
  }

  private hasConversation(conversationId: string): boolean {
    return this.conversations().some(item => item.id === conversationId);
  }

  private resolveRealtimeConversationId(payload: LooseRecord): string {
    const changedFields = Array.isArray(payload['changedFields']) ? payload['changedFields'] : [];
    return this.valueAfterField(changedFields, 'conversation');
  }

  private valueAfterField(fields: unknown[], fieldName: string): string {
    const index = fields.findIndex(field => this.asString(field).toLowerCase() === fieldName);
    return index >= 0 ? this.asString(fields[index + 1]) : '';
  }

  private syncUserRealtimeChannel(userId: string): void {
    const nextChannel = userId ? `user:${userId}` : '';
    if (nextChannel === this.subscribedUserChannel) {
      return;
    }

    if (this.subscribedUserChannel) {
      this.ws.unsubscribeChannels([this.subscribedUserChannel]);
    }

    this.subscribedUserChannel = nextChannel;
    if (nextChannel) {
      this.ws.subscribeChannels([nextChannel]);
    }
  }

  private syncConversationRealtimeChannel(conversationId: string | null): void {
    const nextChannel =
      conversationId && !conversationId.startsWith('pending-')
        ? `entity:conversation:${conversationId}`
        : '';
    if (nextChannel === this.subscribedConversationChannel) {
      return;
    }

    if (this.subscribedConversationChannel) {
      this.ws.unsubscribeChannels([this.subscribedConversationChannel]);
    }

    this.subscribedConversationChannel = nextChannel;
    if (nextChannel) {
      this.ws.subscribeChannels([nextChannel]);
    }
  }

  private upsertConversation(conversation: ChatConversation): void {
    this.conversations.update(items => {
      const exists = items.some(item => item.id === conversation.id);
      return this.sortConversations(
        exists
          ? items.map(item =>
              item.id === conversation.id ? this.hydrateConversation(conversation, item) : item
            )
          : [this.hydrateConversation(conversation, null), ...items]
      );
    });
  }

  private setConversationMessages(conversationId: string, remoteMessages: ChatMessage[]): void {
    const nextThread = this.mergeMessageCollection(conversationId, remoteMessages);
    this.messagesByConversation.update(current => ({
      ...current,
      [conversationId]: nextThread
    }));

    const lastMessage = nextThread[nextThread.length - 1] ?? null;
    this.conversations.update(items =>
      this.sortConversations(
        items.map(item =>
          item.id === conversationId
            ? {
                ...item,
                lastMessage,
                updatedAt: lastMessage?.createdAt ?? item.updatedAt
              }
            : item
        )
      )
    );
  }

  private mergeConversationCollection(remoteConversations: ChatConversation[]): ChatConversation[] {
    const currentConversations = this.conversations();
    const currentById = new Map(
      currentConversations.map(conversation => [conversation.id, conversation])
    );
    const merged = remoteConversations.map(conversation =>
      this.hydrateConversation(conversation, currentById.get(conversation.id) ?? null)
    );
    const mergedIds = new Set(merged.map(conversation => conversation.id));
    const pendingLocal = currentConversations.filter(
      conversation => conversation.pending && !mergedIds.has(conversation.id)
    );
    return [...merged, ...pendingLocal];
  }

  private hydrateConversation(
    remote: ChatConversation,
    local: ChatConversation | null | undefined
  ): ChatConversation {
    const thread = this.messagesByConversation()[remote.id] ?? [];
    const threadLastMessage = thread[thread.length - 1] ?? null;
    const lastMessageSource = remote.lastMessage ?? threadLastMessage ?? local?.lastMessage ?? null;

    return {
      ...local,
      ...remote,
      participants: this.mergeParticipants(remote.participants, local?.participants ?? []),
      lastMessage: lastMessageSource
        ? this.hydrateMessage(lastMessageSource, local?.lastMessage ?? threadLastMessage)
        : null,
      muted: remote.muted ?? local?.muted ?? false,
      pending: remote.pending ?? false,
      pendingUserId: remote.pendingUserId ?? local?.pendingUserId
    };
  }

  private mergeParticipants(remoteParticipants: ChatUser[], localParticipants: ChatUser[]): ChatUser[] {
    const localById = new Map(localParticipants.map(participant => [participant.id, participant]));
    return remoteParticipants.map(participant => {
      const local = localById.get(participant.id);
      return local
        ? {
            ...local,
            ...participant,
            online: participant.online || local.online || false
          }
        : participant;
    });
  }

  private mergeMessageCollection(conversationId: string, remoteMessages: ChatMessage[]): ChatMessage[] {
    const localThread = this.messagesByConversation()[conversationId] ?? [];
    const localById = new Map(localThread.map(message => [message.id, message]));
    const localByClientId = new Map(
      localThread
        .filter(message => !!message.clientId)
        .map(message => [message.clientId as string, message])
    );
    const matchedLocalIds = new Set<string>();
    const matchedClientIds = new Set<string>();

    const merged = remoteMessages.map(remoteMessage => {
      const localMatch =
        localById.get(remoteMessage.id) ||
        (remoteMessage.clientId ? localByClientId.get(remoteMessage.clientId) : null);

      if (localMatch) {
        matchedLocalIds.add(localMatch.id);
        if (localMatch.clientId) {
          matchedClientIds.add(localMatch.clientId);
        }
      }

      if (remoteMessage.clientId) {
        matchedClientIds.add(remoteMessage.clientId);
      }

      return this.hydrateMessage(remoteMessage, localMatch);
    });

    localThread.forEach(localMessage => {
      const matchedById = matchedLocalIds.has(localMessage.id);
      const matchedByClientId =
        !!localMessage.clientId && matchedClientIds.has(localMessage.clientId);
      if (matchedById || matchedByClientId) {
        return;
      }

      if (localMessage.deliveryState === 'sending' || localMessage.deliveryState === 'failed') {
        merged.push(localMessage);
      }
    });

    return merged.sort(this.sortMessages);
  }

  private hydrateMessage(
    remote: ChatMessage,
    local: ChatMessage | null | undefined
  ): ChatMessage {
    const readBy = this.mergeUserIds(remote.readBy, local?.readBy);
    const deliveredBy = this.mergeUserIds(remote.deliveredBy, local?.deliveredBy, readBy);
    const hydrated: ChatMessage = {
      ...local,
      ...remote,
      clientId: remote.clientId ?? local?.clientId ?? null,
      readBy,
      deliveredBy
    };

    if (!this.isCurrentUserId(hydrated.senderId)) {
      delete hydrated.deliveryState;
      return hydrated;
    }

    return {
      ...hydrated,
      deliveryState: this.resolveDeliveryState(hydrated, local?.deliveryState)
    };
  }

  private resolveDeliveryState(
    message: ChatMessage,
    fallbackState?: ChatMessage['deliveryState']
  ): ChatMessage['deliveryState'] {
    if (fallbackState === 'failed' && message.id.startsWith('local-')) {
      return 'failed';
    }

    const otherUserIds = this.otherParticipantIds(message.conversationId);
    if (
      otherUserIds.length > 0 &&
      otherUserIds.every(userId => this.hasUserId(message.readBy, userId))
    ) {
      return 'read';
    }

    if (otherUserIds.some(userId => this.hasUserId(message.deliveredBy, userId))) {
      return 'delivered';
    }

    if (fallbackState === 'sending' && message.id.startsWith('local-')) {
      return 'sending';
    }

    return 'sent';
  }

  private otherParticipantIds(conversationId: string): string[] {
    const conversation = this.conversations().find(item => item.id === conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.participants
      .filter(participant => !this.isCurrentUser(participant))
      .map(participant => participant.id);
  }

  private mergeUserIds(...collections: Array<string[] | undefined>): string[] {
    return collections.reduce<string[]>((merged, values) => {
      let next = [...merged];
      for (const value of values ?? []) {
        next = this.mergeUserId(next, value);
      }
      return next;
    }, []);
  }

  private mergeUsers(users: ChatUser[]): ChatUser[] {
    const map = new Map<string, ChatUser>();
    [...this.directory(), ...users].forEach(user => {
      map.set(user.id, { ...map.get(user.id), ...user });
    });
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  isCurrentUser(user: Pick<ChatUser, 'id' | 'email'> | null | undefined): boolean {
    if (!user) {
      return false;
    }

    return this.isCurrentUserId(user.id) || this.isCurrentUserEmail(user.email);
  }

  isCurrentUserId(userId: string | null | undefined): boolean {
    const normalizedUserId = this.normalizeIdentityValue(userId);
    if (!normalizedUserId) {
      return false;
    }

    return this.currentIdentityIds().includes(normalizedUserId);
  }

  hasUserId(values: string[] | undefined, userId: string | null | undefined): boolean {
    const normalizedUserId = this.normalizeIdentityValue(userId);
    if (!normalizedUserId) {
      return false;
    }

    return (values ?? []).some(value => this.normalizeIdentityValue(value) === normalizedUserId);
  }

  private findServerCurrentUser(email: string): ChatUser | null {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    for (const conversation of this.conversations()) {
      const participant = conversation.participants.find(
        user => (user.email ?? '').trim().toLowerCase() === normalizedEmail
      );
      if (participant) {
        return participant;
      }
    }

    const directoryMatch = this.directory().find(
      user => (user.email ?? '').trim().toLowerCase() === normalizedEmail
    );
    if (directoryMatch) {
      return directoryMatch;
    }

    return null;
  }

  private includesCurrentUser(values: string[] | undefined): boolean {
    return (values ?? []).some(value => this.isCurrentUserId(value));
  }

  private sameUserId(
    left: string | number | null | undefined,
    right: string | number | null | undefined
  ): boolean {
    const normalizedLeft = this.normalizeIdentityValue(left);
    const normalizedRight = this.normalizeIdentityValue(right);
    return !!normalizedLeft && normalizedLeft === normalizedRight;
  }

  private isCurrentUserEmail(email: string | null | undefined): boolean {
    const normalizedEmail = this.normalizeIdentityValue(email);
    if (!normalizedEmail) {
      return false;
    }

    return this.currentIdentityEmails().includes(normalizedEmail);
  }

  private currentIdentityIds(): string[] {
    return [
      ...new Set(
        [this.auth.user()?.id, this.currentUser().id]
          .map(value => this.normalizeIdentityValue(value))
          .filter(Boolean)
      )
    ];
  }

  private currentIdentityEmails(): string[] {
    return [
      ...new Set(
        [this.auth.user()?.email, this.currentUser().email]
          .map(value => this.normalizeIdentityValue(value))
          .filter(Boolean)
      )
    ];
  }

  private normalizeIdentityValue(value: string | number | null | undefined): string {
    return value == null ? '' : String(value).trim().toLowerCase();
  }

  private updateLocalPreferences(next: ChatLocalPreferences): void {
    const normalized = this.normalizeLocalPreferences(next);
    this.localPreferences.set(normalized);
    this.saveLocalPreferences(normalized);
  }

  private loadLocalPreferences(): ChatLocalPreferences {
    if (typeof window === 'undefined') {
      return this.emptyLocalPreferences();
    }

    try {
      const raw = window.localStorage.getItem(CHAT_PREFERENCES_KEY);
      return this.normalizeLocalPreferences(raw ? JSON.parse(raw) : null);
    } catch {
      return this.emptyLocalPreferences();
    }
  }

  private saveLocalPreferences(preferences: ChatLocalPreferences): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(CHAT_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Local preferences are convenience-only; chat should keep working if storage is blocked.
    }
  }

  private normalizeLocalPreferences(value: unknown): ChatLocalPreferences {
    const record = this.asRecord(value) ?? {};
    const archivedConversationIds = this.asStringArray(record['archivedConversationIds']);
    const pinnedConversationIds = this.asStringArray(record['pinnedConversationIds']);
    const starredMessageIds = this.asStringArray(record['starredMessageIds']);
    const quickReplies = this.asStringArray(record['quickReplies']).filter(
      reply => reply.length <= 240
    );
    const draftsRecord = this.asRecord(record['drafts']) ?? {};
    const drafts = Object.fromEntries(
      Object.entries(draftsRecord)
        .map(([key, draft]) => [key, this.asString(draft)] as const)
        .filter(([key, draft]) => !!key && !!draft.trim())
    );

    return {
      archivedConversationIds: [...new Set(archivedConversationIds)],
      pinnedConversationIds: [...new Set(pinnedConversationIds)],
      starredMessageIds: [...new Set(starredMessageIds)],
      quickReplies: [...new Set(quickReplies)],
      drafts
    };
  }

  private emptyLocalPreferences(): ChatLocalPreferences {
    return {
      archivedConversationIds: [],
      pinnedConversationIds: [],
      starredMessageIds: [],
      quickReplies: DEFAULT_CHAT_QUICK_REPLIES,
      drafts: {}
    };
  }

  private normalizeRealtimeMessage(
    payload: LooseRecord,
    fallbackConversationId: string
  ): ChatMessage {
    const eventData = this.eventDataRecord(payload);
    const clientId = this.asString(payload['clientId'] ?? eventData?.['clientId']);
    return {
      id: this.asString(payload['id'] ?? eventData?.['id']) || this.createId('ws-message'),
      clientId,
      conversationId:
        this.asString(payload['conversationId'] ?? eventData?.['conversationId']) ||
        fallbackConversationId,
      senderId: this.asString(
        payload['senderId'] ?? payload['userId'] ?? eventData?.['senderId']
      ),
      body: this.asString(
        payload['body'] ?? payload['message'] ?? payload['text'] ?? eventData?.['body']
      ),
      createdAt:
        this.asString(payload['createdAt'] ?? payload['sentAt'] ?? eventData?.['createdAt']) ||
        new Date().toISOString(),
      readBy: this.asStringArray(payload['readBy'] ?? eventData?.['readBy']),
      deliveredBy: this.asStringArray(payload['deliveredBy'] ?? eventData?.['deliveredBy'])
    };
  }

  private normalizeRealtimeMessageSentEvent(
    payload: LooseRecord,
    fallbackConversationId: string
  ): ChatMessage | null {
    const changedFields = Array.isArray(payload['changedFields']) ? payload['changedFields'] : [];
    const eventData = this.eventDataRecord(payload);
    const messageId =
      this.valueAfterField(changedFields, 'message') ||
      this.asString(payload['entityId']) ||
      this.asString(eventData?.['id']);
    const senderId =
      this.valueAfterField(changedFields, 'sender') ||
      this.asString(payload['initiatedByUserId']) ||
      this.asString(eventData?.['senderId']);
    const body =
      this.valueAfterField(changedFields, 'body') ||
      this.asString(eventData?.['body'] ?? eventData?.['message']);
    const createdAt =
      this.valueAfterField(changedFields, 'createdAt') ||
      this.asString(payload['occurredAt']) ||
      this.asString(eventData?.['createdAt']);
    const conversationId =
      fallbackConversationId ||
      this.valueAfterField(changedFields, 'conversation') ||
      this.asString(eventData?.['conversationId']);

    if (!messageId || !conversationId || !senderId || !body) {
      return null;
    }

    return {
      id: messageId,
      clientId:
        this.valueAfterField(changedFields, 'clientId') || this.asString(eventData?.['clientId']),
      conversationId,
      senderId,
      body,
      createdAt: createdAt || new Date().toISOString(),
      readBy: this.asStringArray(eventData?.['readBy']),
      deliveredBy: this.mergeUserIds(
        this.asStringArray(eventData?.['deliveredBy']),
        [this.currentUser().id]
      )
    };
  }

  private eventDataRecord(payload: LooseRecord): LooseRecord | null {
    const data = this.asRecord(payload['data']);
    if (!data) {
      return null;
    }

    return this.asRecord(data['message']) ?? data;
  }

  private pruneTypingStates(): void {
    const now = Date.now();
    this.typingStates.update(states => states.filter(state => state.expiresAt > now));
  }

  private sortConversations(items: ChatConversation[]): ChatConversation[] {
    const pinnedIds = new Set(this.localPreferences().pinnedConversationIds);
    return [...items]
      .map(item => ({ ...item, pinned: item.pinned === true || pinnedIds.has(item.id) }))
      .sort((left, right) => {
        const pinnedWeight = Number(right.pinned === true) - Number(left.pinned === true);
        if (pinnedWeight !== 0) {
          return pinnedWeight;
        }
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      });
  }

  private sortMessages(left: ChatMessage, right: ChatMessage): number {
    return Date.parse(left.createdAt) - Date.parse(right.createdAt);
  }

  private ensureRealtimeConnection(): void {
    const wsUrl = this.resolveWsUrl();
    this.ws.init({
      url: wsUrl ?? '',
      enabled: !!wsUrl,
      reconnect: true,
      reconnectAttempts: 12,
      reconnectInterval: 1200,
      heartbeatInterval: 30000
    });
  }

  private hasAuthenticatedSession(): boolean {
    return this.auth.isAuthenticated() && !!this.auth.user()?.id;
  }

  private clearSessionState(): void {
    this.stopRealtimeFallback();
    this.clearReadReceiptTimers();
    this.clearMessageAckTimeouts();
    this.clearMessageFailureTimers();
    this.lastReadAtByConversation.clear();
    this.deliveredMessageIds.clear();
    this.conversations.set([]);
    this.activeConversationId.set(null);
    this.messagesByConversation.set({});
    this.directory.set([]);
    this.typingStates.set([]);
    this.initialLoadInFlight = false;
    this.queuedPreferredConversationId = null;
    this.lastLoadedAt = 0;
    this.userSearchInFlight = false;
    this.queuedUserSearchQuery = null;
    this.lastUserSearchQuery = '';
    this.lastUserSearchAt = 0;
  }

  private resolveWsUrl(): string | null {
    const runtime = runtimeConfig();
    const explicit =
      runtime.notifications?.wsUrl?.trim() || environment.notifications?.wsUrl?.trim();
    if (explicit) {
      return explicit;
    }

    const wsPath = this.normalizeWsPath(
      runtime.notifications?.wsPath ?? environment.notifications?.wsPath ?? '/ws'
    );
    const apiBase = (
      runtime.notifications?.apiBaseUrl ??
      runtime.apiBaseUrl ??
      environment.API_BASE_URL ??
      ''
    ).trim();
    if (/^https?:\/\//i.test(apiBase)) {
      try {
        const url = new URL(apiBase);
        return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}${wsPath}`;
      } catch {
        return null;
      }
    }

    if (typeof window === 'undefined' || !window.location?.host) {
      return null;
    }

    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${wsPath}`;
  }

  private normalizeWsPath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
  }

  private asRecord(value: unknown): LooseRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as LooseRecord)
      : null;
  }

  private asString(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(item => this.asString(item)).filter(Boolean) : [];
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  ngOnDestroy(): void {
    this.wsSubscription.unsubscribe();
    this.ws.unsubscribeChannels(['module:messaging']);
    if (this.subscribedUserChannel) {
      this.ws.unsubscribeChannels([this.subscribedUserChannel]);
    }
    if (this.subscribedConversationChannel) {
      this.ws.unsubscribeChannels([this.subscribedConversationChannel]);
    }
    this.stopRealtimeFallback();
    if (this.activeSyncTimer) {
      clearInterval(this.activeSyncTimer);
    }
    if (this.conversationSyncTimer) {
      clearInterval(this.conversationSyncTimer);
    }
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
    }
    if (this.conversationRefreshTimer) {
      clearTimeout(this.conversationRefreshTimer);
    }
    this.messageRefreshTimers.forEach(timer => clearTimeout(timer));
    this.messageRefreshTimers.clear();
    this.queuedMessageRefreshes.clear();
    this.activeMessageRefreshes.clear();
    this.clearReadReceiptTimers();
    this.clearMessageAckTimeouts();
    this.clearMessageFailureTimers();
  }
}
