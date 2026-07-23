import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import type { ChatConversation, ChatMessage, ChatUser } from '../application';
import { MessagesStoreService } from '../infrastructure/messages-store.service';
import { ToastService } from '../../../shared/toast/toast.service';

type ConversationFilter = 'all' | 'unread' | 'direct' | 'pinned' | 'archived';
type MessageView = 'all' | 'starred';
type ChatContextMenu =
  | { type: 'conversation'; x: number; y: number; conversation: ChatConversation }
  | { type: 'message'; x: number; y: number; message: ChatMessage };
const MESSAGE_MAX_LENGTH = 4000;

@Component({
  selector: 'feature-messages-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, AppIconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages-page.component.html',
  styleUrl: './messages-page.component.scss'
})
export class MessagesPageComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('messageScroller') private messageScroller?: ElementRef<HTMLDivElement>;
  readonly store = inject(MessagesStoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly composer = signal('');
  readonly conversationSearch = signal('');
  readonly conversationFilter = signal<ConversationFilter>('all');
  readonly messageSearch = signal('');
  readonly messageView = signal<MessageView>('all');
  readonly editingMessage = signal<ChatMessage | null>(null);
  readonly contextMenu = signal<ChatContextMenu | null>(null);
  readonly selectedMessageIds = signal<Set<string>>(new Set());
  readonly detailsOpen = signal(false);
  readonly quickReplyEditorOpen = signal(false);
  readonly quickReplyDraft = signal('');
  readonly userSearch = signal('');
  readonly startPanelOpen = signal(false);
  readonly showJumpToLatest = signal(false);
  readonly maxMessageLength = MESSAGE_MAX_LENGTH;
  private shouldStickToBottom = true;
  private typingHeartbeat?: ReturnType<typeof setInterval>;
  private routeSubscription?: Subscription;

  readonly filteredConversations = computed(() => {
    const query = this.conversationSearch().trim().toLowerCase();
    const filter = this.conversationFilter();
    return this.store.conversations().filter(conversation => {
      const archived = this.store.isConversationArchived(conversation.id);
      if (filter === 'archived') {
        if (!archived) {
          return false;
        }
      } else if (archived) {
        return false;
      }
      if (filter === 'unread' && conversation.unreadCount <= 0) {
        return false;
      }
      if (filter === 'direct' && conversation.kind !== 'direct') {
        return false;
      }
      if (filter === 'pinned' && !this.store.isConversationPinned(conversation.id)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const participants = conversation.participants
        .map(user => `${user.name} ${user.email ?? ''} ${user.role ?? ''}`)
        .join(' ');
      const haystack = [
        this.conversationTitle(conversation),
        this.conversationSubtitle(conversation),
        conversation.lastMessage?.body ?? '',
        participants
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly visibleMessages = computed(() => {
    const query = this.messageSearch().trim().toLowerCase();
    const view = this.messageView();
    return this.store.activeMessages().filter(message => {
      if (view === 'starred' && !this.store.isMessageStarred(message.id)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [message.body, this.messageSender(message).name, message.createdAt]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  readonly composerRemaining = computed(() => MESSAGE_MAX_LENGTH - this.composer().length);
  readonly quickReplies = computed(() => this.store.quickReplies());
  readonly canSend = computed(() => {
    const body = this.composer().trim();
    return !!body && this.composer().length <= MESSAGE_MAX_LENGTH && !this.store.sending();
  });
  readonly totalConversationCount = computed(() => this.store.conversations().length);
  readonly unreadConversationCount = computed(
    () => this.store.conversations().filter(conversation => conversation.unreadCount > 0).length
  );
  readonly pinnedConversationCount = computed(
    () =>
      this.store.conversations().filter(conversation => this.store.isConversationPinned(conversation.id)).length
  );
  readonly draftConversationCount = computed(
    () => this.store.conversations().filter(conversation => !!this.store.draftFor(conversation.id)).length
  );
  readonly liveConversationCount = computed(
    () =>
      this.store.conversations().filter(conversation =>
        this.otherParticipants(conversation).some(user => user.online)
      ).length
  );

  readonly selectedMessages = computed(() => {
    const selectedIds = this.selectedMessageIds();
    return this.visibleMessages().filter(message => selectedIds.has(message.id));
  });

  readonly activeStarredCount = computed(
    () =>
      this.store.activeMessages().filter(message => this.store.isMessageStarred(message.id)).length
  );

  readonly activeDraft = computed(() => this.store.draftFor(this.store.activeConversationId()));

  readonly filteredUsers = computed(() => {
    const query = this.userSearch().trim().toLowerCase();
    return this.store
      .directory()
      .filter(user => !this.store.isCurrentUser(user))
      .filter(user => {
        if (!query) {
          return true;
        }
        return [user.name, user.email, user.role].some(value =>
          (value ?? '').toLowerCase().includes(query)
        );
      })
      .slice(0, 12);
  });

  ngOnInit(): void {
    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      this.store.load(params.get('conversationId'));
    });
  }

  ngAfterViewChecked(): void {
    if (!this.shouldStickToBottom) {
      return;
    }
    this.scrollToBottom();
  }

  selectConversation(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.editingMessage.set(null);
    this.clearSelection();
    this.store.selectConversation(conversation.id);
    this.composer.set(this.store.draftFor(conversation.id));
  }

  openDirect(user: ChatUser): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.editingMessage.set(null);
    this.clearSelection();
    this.store.openDirect(user);
    this.startPanelOpen.set(false);
    this.userSearch.set('');
    this.composer.set('');
  }

  refresh(): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.store.refreshActive();
  }

  setConversationFilter(filter: ConversationFilter): void {
    this.conversationFilter.set(filter);
  }

  setMessageView(view: MessageView): void {
    this.clearSelection();
    this.messageView.set(view);
  }

  updateConversationSearch(value: string): void {
    this.conversationSearch.set(value);
  }

  updateMessageSearch(value: string): void {
    this.messageSearch.set(value);
  }

  updateSearch(value: string): void {
    this.userSearch.set(value);
    this.store.searchUsers(value);
  }

  onComposerInput(value: string): void {
    this.composer.set(value);
    if (!this.editingMessage()) {
      this.store.saveDraft(this.store.activeConversationId(), value);
    }
    this.store.emitTyping(true);
    this.syncTypingHeartbeat();
  }

  send(): void {
    this.closeContextMenu();
    const body = this.composer().trim();
    if (!this.canSend()) {
      return;
    }
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    const editing = this.editingMessage();
    if (editing) {
      this.store.editMessage(editing, body);
      this.editingMessage.set(null);
    } else {
      this.store.send(body);
    }
    this.store.clearDraft(this.store.activeConversationId());
    this.composer.set('');
    this.syncTypingHeartbeat();
  }

  startEdit(message: ChatMessage): void {
    this.closeContextMenu();
    if (!this.isOwnMessage(message) || message.deliveryState === 'sending') {
      return;
    }
    this.editingMessage.set(message);
    this.composer.set(message.body);
  }

  cancelEdit(): void {
    this.closeContextMenu();
    this.editingMessage.set(null);
    this.composer.set(this.store.draftFor(this.store.activeConversationId()));
  }

  deleteMessage(message: ChatMessage): void {
    this.closeContextMenu();
    if (!this.isOwnMessage(message)) {
      return;
    }
    if (typeof window === 'undefined') {
      this.deleteOwnMessageNow(message);
      return;
    }

    this.toast.action(
      'danger',
      'This removes the message from the current conversation.',
      'Delete',
      () => {
        this.deleteOwnMessageNow(message);
      },
      8000,
      undefined,
      {
        title: 'Delete message?',
        coalesce: false
      }
    );
  }

  retry(message: ChatMessage): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.store.retryMessage(message);
  }

  copy(message: ChatMessage): void {
    this.closeContextMenu();
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(message.body).catch(() => undefined);
  }

  toggleStar(message: ChatMessage): void {
    this.closeContextMenu();
    this.store.toggleMessageStarred(message.id);
  }

  useQuickReply(reply: string): void {
    this.closeContextMenu();
    const next = this.composer().trim() ? `${this.composer()}\n${reply}` : reply;
    this.onComposerInput(next);
  }

  addQuickReply(): void {
    this.store.addQuickReply(this.quickReplyDraft());
    this.quickReplyDraft.set('');
  }

  removeQuickReply(reply: string): void {
    this.store.removeQuickReply(reply);
  }

  resetQuickReplies(): void {
    this.store.resetQuickReplies();
  }

  togglePinned(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.store.toggleConversationPinned(conversation.id);
  }

  toggleMuted(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.store.setConversationMuted(conversation.id, !conversation.muted);
  }

  archive(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.store.archiveConversation(conversation.id);
  }

  restore(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.store.restoreConversation(conversation.id);
  }

  toggleDetails(): void {
    this.closeContextMenu();
    this.detailsOpen.update(value => !value);
  }

  openConversationMenu(event: MouseEvent, conversation: ChatConversation): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({
      type: 'conversation',
      conversation,
      ...this.contextMenuPosition(event, 250, 380)
    });
  }

  openMessageMenu(event: MouseEvent, message: ChatMessage): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({
      type: 'message',
      message,
      ...this.contextMenuPosition(event, 240, 360)
    });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  copyConversationLink(conversation: ChatConversation): void {
    this.closeContextMenu();
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    const url = `${window.location.origin}/messages?conversationId=${encodeURIComponent(conversation.id)}`;
    void navigator.clipboard.writeText(url).catch(() => undefined);
  }

  markConversationRead(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.store.markConversationRead(conversation.id);
  }

  clearConversationDraft(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.store.clearDraft(conversation.id);
    if (this.store.activeConversationId() === conversation.id && !this.editingMessage()) {
      this.composer.set('');
    }
  }

  toggleMessageSelected(message: ChatMessage): void {
    this.closeContextMenu();
    this.selectedMessageIds.update(ids => {
      const next = new Set(ids);
      if (next.has(message.id)) {
        next.delete(message.id);
      } else {
        next.add(message.id);
      }
      return next;
    });
  }

  selectVisibleMessages(): void {
    this.selectedMessageIds.set(new Set(this.visibleMessages().map(message => message.id)));
  }

  clearSelection(): void {
    this.selectedMessageIds.set(new Set());
  }

  copySelectedMessages(): void {
    const text = this.formatMessagesForExport(this.selectedMessages());
    if (typeof navigator === 'undefined' || !navigator.clipboard || !text) {
      return;
    }
    void navigator.clipboard.writeText(text).catch(() => undefined);
  }

  starSelectedMessages(): void {
    this.selectedMessages()
      .filter(message => !this.store.isMessageStarred(message.id))
      .forEach(message => this.store.toggleMessageStarred(message.id));
  }

  deleteSelectedOwnMessages(): void {
    const ownMessages = this.selectedMessages().filter(message => this.isOwnMessage(message));
    if (!ownMessages.length) {
      return;
    }
    if (typeof window === 'undefined') {
      this.deleteSelectedOwnMessagesNow(ownMessages);
      return;
    }

    const count = ownMessages.length;
    const noun = count === 1 ? 'message' : 'messages';
    this.toast.action(
      'danger',
      `This removes ${count} selected ${noun} from the current conversation.`,
      'Delete',
      () => this.deleteSelectedOwnMessagesNow(ownMessages),
      8000,
      undefined,
      {
        title: 'Delete selected messages?',
        coalesce: false
      }
    );
  }

  exportSelectedMessages(): void {
    this.exportMessages(this.selectedMessages(), 'selected-messages');
  }

  quoteMessage(message: ChatMessage): void {
    this.closeContextMenu();
    const sender = this.isOwnMessage(message) ? 'You' : this.messageSender(message).name;
    const quotedBody = message.body
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    const quote = `Replying to ${sender}\n${quotedBody}\n\n`;
    this.onComposerInput(this.composer().trim() ? `${this.composer()}\n${quote}` : quote);
  }

  filterMessagesBySender(message: ChatMessage): void {
    this.closeContextMenu();
    this.messageView.set('all');
    this.messageSearch.set(this.messageSender(message).name);
  }

  exportTranscript(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.exportMessages(
      this.store.messagesByConversation()[conversation.id] ?? [],
      this.conversationTitle(conversation)
    );
  }

  private exportMessages(messages: ChatMessage[], name: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const title = name || 'chat';
    const lines = [
      `Conversation: ${this.store.activeConversation() ? this.conversationTitle(this.store.activeConversation()!) : title}`,
      `Exported: ${new Date().toISOString()}`,
      '',
      this.formatMessagesForExport(messages)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'chat'}-transcript.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private deleteOwnMessageNow(message: ChatMessage): void {
    this.store.deleteMessage(message);
    this.selectedMessageIds.update(ids => {
      const next = new Set(ids);
      next.delete(message.id);
      return next;
    });
  }

  private deleteSelectedOwnMessagesNow(messages: ChatMessage[]): void {
    messages.forEach(message => this.store.deleteMessage(message));
    this.clearSelection();
  }

  private formatMessagesForExport(messages: ChatMessage[]): string {
    return messages
      .map(message => {
        const sender = this.isOwnMessage(message) ? 'You' : this.messageSender(message).name;
        return `[${new Date(message.createdAt).toLocaleString()}] ${sender}: ${message.body}`;
      })
      .join('\n');
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.send();
  }

  onMessageScroll(): void {
    const element = this.messageScroller?.nativeElement;
    if (!element) {
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    this.shouldStickToBottom = distanceFromBottom < 80;
    this.showJumpToLatest.set(!this.shouldStickToBottom);
  }

  scrollToLatest(): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.scrollToBottom();
  }

  otherParticipants(conversation: ChatConversation): ChatUser[] {
    return conversation.participants.filter(user => !this.store.isCurrentUser(user));
  }

  conversationTitle(conversation: ChatConversation): string {
    if (conversation.kind === 'group') {
      return conversation.title;
    }
    return this.otherParticipants(conversation)[0]?.name || conversation.title;
  }

  conversationSubtitle(conversation: ChatConversation): string {
    const others = this.otherParticipants(conversation);
    if (conversation.kind === 'group') {
      return `${conversation.participants.length} members`;
    }
    const user = others[0];
    if (!user) {
      return 'Direct message';
    }
    if (user.online) {
      return 'Online';
    }
    return user.role || user.email || 'Direct message';
  }

  messageSender(message: ChatMessage): ChatUser {
    const conversation = this.store.activeConversation();
    const users = conversation?.participants ?? this.store.directory();
    return (
      users.find(user => this.store.hasUserId([user.id], message.senderId)) ?? {
        id: message.senderId,
        name: this.isOwnMessage(message) ? 'You' : 'User'
      }
    );
  }

  isOwnMessage(message: ChatMessage): boolean {
    return this.store.isCurrentUserId(message.senderId);
  }

  messageDeliveryLabel(message: ChatMessage): string {
    if (!this.isOwnMessage(message)) {
      return '';
    }
    if (message.deliveryState === 'sending') {
      return 'sending';
    }
    if (message.deliveryState === 'failed') {
      return 'failed';
    }
    const activeConversation = this.store.activeConversation();
    const otherUserIds = activeConversation
      ? this.otherParticipants(activeConversation).map(user => user.id)
      : [];
    if (
      otherUserIds.length > 0 &&
      otherUserIds.every(userId => this.store.hasUserId(message.readBy, userId))
    ) {
      return 'read';
    }
    return otherUserIds.some(userId => this.store.hasUserId(message.deliveredBy, userId))
      ? 'delivered'
      : 'sent';
  }

  messageReceiptLabel(message: ChatMessage): string {
    const state = this.messageDeliveryLabel(message);
    if (!state) {
      return '';
    }
    if (state === 'sending') {
      return 'Sending';
    }
    if (state === 'failed') {
      return 'Failed';
    }
    if (state === 'sent') {
      return 'Sent';
    }
    if (state === 'delivered') {
      return 'Delivered';
    }
    const readers = this.readersForMessage(message);
    if (!readers.length) {
      return 'Read';
    }
    const visibleNames = readers.slice(0, 2).map(user => user.name);
    const remaining = readers.length - visibleNames.length;
    return remaining > 0
      ? `Read by ${visibleNames.join(', ')} +${remaining}`
      : `Read by ${visibleNames.join(', ')}`;
  }

  shouldShowDateSeparator(index: number): boolean {
    const messages = this.visibleMessages();
    const message = messages[index];
    if (!message) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    return this.dateKey(message.createdAt) !== this.dateKey(messages[index - 1]?.createdAt);
  }

  messageDateLabel(message: ChatMessage): string {
    const date = new Date(message.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (this.dateKey(message.createdAt) === this.dateKey(today.toISOString())) {
      return 'Today';
    }
    if (this.dateKey(message.createdAt) === this.dateKey(yesterday.toISOString())) {
      return 'Yesterday';
    }
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric'
    }).format(date);
  }

  trackConversation(_: number, conversation: ChatConversation): string {
    return conversation.id;
  }

  trackMessage(_: number, message: ChatMessage): string {
    return message.id;
  }

  trackUser(_: number, user: ChatUser): string {
    return user.id;
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeContextMenu();
  }

  private scrollToBottom(): void {
    const element = this.messageScroller?.nativeElement;
    if (!element) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }

  private contextMenuPosition(
    event: MouseEvent,
    estimatedWidth: number,
    estimatedHeight: number
  ): { x: number; y: number } {
    if (typeof window === 'undefined') {
      return { x: event.clientX, y: event.clientY };
    }
    return {
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - estimatedWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - estimatedHeight - 8))
    };
  }

  private dateKey(value: string | undefined): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  private readersForMessage(message: ChatMessage): ChatUser[] {
    const conversation = this.store.activeConversation();
    if (!conversation) {
      return [];
    }
    return this.otherParticipants(conversation).filter(user =>
      this.store.hasUserId(message.readBy, user.id)
    );
  }

  private syncTypingHeartbeat(): void {
    if (!this.composer().trim()) {
      if (this.typingHeartbeat) {
        clearInterval(this.typingHeartbeat);
        this.typingHeartbeat = undefined;
      }
      return;
    }

    if (this.typingHeartbeat) {
      return;
    }

    this.typingHeartbeat = setInterval(() => {
      if (!this.composer().trim()) {
        this.syncTypingHeartbeat();
        return;
      }
      this.store.emitTyping(true);
    }, 1200);
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    if (this.typingHeartbeat) {
      clearInterval(this.typingHeartbeat);
    }
  }
}
