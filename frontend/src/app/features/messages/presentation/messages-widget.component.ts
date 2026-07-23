import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppIconDirective } from '@shared/icons/app-icon.directive';
import type { ChatConversation, ChatMessage, ChatUser } from '../application';
import { MessagesStoreService } from '../infrastructure/messages-store.service';
import { ToastService } from '../../../shared/toast/toast.service';

type ConversationFilter = 'all' | 'unread' | 'pinned' | 'archived';
type MessageView = 'all' | 'starred';
type WidgetContextMenu =
  | { type: 'conversation'; x: number; y: number; conversation: ChatConversation }
  | { type: 'message'; x: number; y: number; message: ChatMessage };

interface WidgetPoint {
  x: number;
  y: number;
}

interface WidgetViewport {
  width: number;
  height: number;
}

const MESSAGE_MAX_LENGTH = 4000;
const BUBBLE_SIZE = 56;
const BUBBLE_MARGIN = 12;
const PANEL_MARGIN = 12;
const WIDGET_POSITION_KEY = 'engineers-salary-reference.messages.widget.position.v1';

@Component({
  selector: 'app-messages-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, AppIconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="chat-overlay" (click)="close()"></div>
      <section
        class="chat-panel"
        [class.is-stacked]="stackedLayout()"
        aria-label="Team chat"
        [style.left.px]="panelLeft()"
        [style.top.px]="panelTop()"
        [style.width.px]="panelWidth()"
        [style.height.px]="panelHeight()"
        (click)="$event.stopPropagation()"
      >
        <header class="chat-panel__header">
          <div class="chat-title">
            <span class="chat-title__avatar">{{ activeTitle().slice(0, 1) }}</span>
            <span class="chat-title__copy">
              <span class="chat-title__label">Team chat</span>
              <strong>{{ activeTitle() }}</strong>
              <small>{{ activeSubtitle() }}</small>
              @if (store.activeConversation(); as activeConversation) {
                <span class="chat-title__meta">
                  <span>{{ visibleMessages().length }} messages</span>
                  <span>
                    {{
                      activeConversation.kind === 'group'
                        ? activeConversation.participants.length + ' members'
                        : 'Direct chat'
                    }}
                  </span>
                  @if (activeConversation.kind === 'direct' && otherParticipants(activeConversation)[0]?.online) {
                    <span class="is-live">Online</span>
                  }
                </span>
              }
            </span>
          </div>

          <div class="chat-panel__tools">
            <span class="chat-live" [class.is-live]="store.realtimeConnected()">
              {{ store.realtimeConnected() ? 'Live' : 'Sync' }}
            </span>
            <div class="chat-panel__actions">
              <button type="button" title="Refresh" aria-label="Refresh chats" (click)="refresh()">
                <i appIcon="arrow-clockwise"></i>
              </button>
              <button type="button" title="New chat" aria-label="New chat" (click)="toggleDirectory()">
                <i appIcon="plus-lg"></i>
              </button>
              @if (store.activeConversation(); as activeConversation) {
                <button
                  type="button"
                  [title]="
                    store.isConversationArchived(activeConversation.id) ? 'Restore chat' : 'Archive chat'
                  "
                  [attr.aria-label]="
                    store.isConversationArchived(activeConversation.id) ? 'Restore chat' : 'Archive chat'
                  "
                  (click)="toggleArchived(activeConversation)"
                >
                  <i appIcon="archive"></i>
                </button>
              }
            </div>
            <button type="button" class="chat-panel__close" title="Close chat" aria-label="Close chat" (click)="close()">
              <i appIcon="x-lg"></i>
            </button>
          </div>
        </header>

        <div class="chat-panel__body">
          <aside class="chat-list" [class.is-directory]="directoryOpen()">
            @if (store.error()) {
              <div class="chat-error">{{ store.error() }}</div>
            }

            @if (directoryOpen()) {
              <div class="chat-list__stack">
                <div class="chat-list__head">
                  <strong>Start chat</strong>
                  <button type="button" (click)="toggleDirectory()">Back</button>
                </div>
                <label class="chat-search">
                  <i appIcon="search"></i>
                  <input
                    type="search"
                    placeholder="Find user"
                    [ngModel]="search()"
                    (ngModelChange)="updateSearch($event)"
                  />
                </label>
              </div>

              <div class="chat-users chat-scroll">
                @for (user of filteredUsers(); track user.id) {
                  <button type="button" class="chat-row" (click)="openDirect(user)">
                    <span class="avatar" [class.is-online]="user.online">
                      {{ user.name.slice(0, 1) }}
                    </span>
                    <span class="chat-row__body">
                      <strong>{{ user.name }}</strong>
                      <small>{{ user.role || user.email || 'ENGINEERS_SALARY_REFERENCE user' }}</small>
                    </span>
                  </button>
                } @empty {
                  <div class="chat-empty">No users found</div>
                }
              </div>
            } @else {
              <div class="chat-list__stack">
                <div class="chat-section-head">
                  <span class="chat-section-label">Inbox</span>
                  <span class="chat-section-caption">{{ visibleConversations().length }} visible</span>
                </div>

                <div class="chat-summary-grid" aria-label="Inbox summary">
                  <span>
                    <strong>{{ store.conversations().length }}</strong>
                    <small>Chats</small>
                  </span>
                  <span>
                    <strong>{{ unreadConversationCount() }}</strong>
                    <small>Unread</small>
                  </span>
                  <span>
                    <strong>{{ liveConversationCount() }}</strong>
                    <small>Live</small>
                  </span>
                  <span>
                    <strong>{{ draftConversationCount() }}</strong>
                    <small>Drafts</small>
                  </span>
                </div>

                <label class="chat-search">
                  <i appIcon="search"></i>
                  <input
                    type="search"
                    placeholder="Search chats"
                    [ngModel]="conversationSearch()"
                    (ngModelChange)="conversationSearch.set($event)"
                  />
                </label>

                <div class="chat-filter">
                  <button
                    type="button"
                    [class.is-active]="conversationFilter() === 'all'"
                    (click)="conversationFilter.set('all')"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    [class.is-active]="conversationFilter() === 'unread'"
                    (click)="conversationFilter.set('unread')"
                  >
                    Unread
                    @if (unreadConversationCount() > 0) {
                      <span>{{ unreadConversationCount() }}</span>
                    }
                  </button>
                  <button
                    type="button"
                    [class.is-active]="conversationFilter() === 'pinned'"
                    (click)="conversationFilter.set('pinned')"
                  >
                    Pinned
                    @if (pinnedConversationCount() > 0) {
                      <span>{{ pinnedConversationCount() }}</span>
                    }
                  </button>
                  <button
                    type="button"
                    [class.is-active]="conversationFilter() === 'archived'"
                    (click)="conversationFilter.set('archived')"
                  >
                    Archived
                    @if (archivedConversationCount() > 0) {
                      <span>{{ archivedConversationCount() }}</span>
                    }
                  </button>
                </div>
              </div>

              <div class="chat-rows chat-scroll">
                @for (conversation of visibleConversations(); track conversation.id) {
                  <button
                    type="button"
                    class="chat-row"
                    [class.is-active]="store.activeConversationId() === conversation.id"
                    [class.is-unread]="conversation.unreadCount > 0"
                    (click)="select(conversation)"
                    (contextmenu)="openConversationMenu($event, conversation)"
                  >
                    <span
                      class="avatar"
                      [class.is-online]="otherParticipants(conversation)[0]?.online"
                    >
                      {{ title(conversation).slice(0, 1) }}
                    </span>
                    <span class="chat-row__body">
                      <strong>
                        @if (store.isConversationPinned(conversation.id)) {
                          <i appIcon="pin-angle"></i>
                        }
                        {{ title(conversation) }}
                      </strong>
                      <span class="chat-row__chips">
                        @if (store.draftFor(conversation.id)) {
                          <span class="row-chip is-draft">Draft</span>
                        }
                        @if (conversation.kind === 'group') {
                          <span class="row-chip">{{ conversation.participants.length }} members</span>
                        } @else {
                          <span class="row-chip">Direct</span>
                        }
                        @if (conversation.pending) {
                          <span class="row-chip is-pending">Pending</span>
                        }
                      </span>
                      @if (typingLabelForConversation(conversation); as typingLabel) {
                        <small class="is-typing">{{ typingLabel }}</small>
                      } @else {
                        <small>{{ messagePreview(conversation) }}</small>
                      }
                    </span>
                    <span class="chat-row__meta">
                      <small>{{ conversation.updatedAt | date: 'shortTime' }}</small>
                      @if (conversation.muted) {
                        <i appIcon="bell-slash" title="Muted"></i>
                      }
                      @if (store.isConversationArchived(conversation.id)) {
                        <i appIcon="archive" title="Archived"></i>
                      }
                      @if (conversation.unreadCount > 0) {
                        <b>{{ conversation.unreadCount }}</b>
                      }
                    </span>
                  </button>
                } @empty {
                  <div class="chat-empty chat-empty--list">
                    <strong>No chats yet</strong>
                    @if (archivedConversationCount() > 0 && conversationFilter() !== 'archived') {
                      <button type="button" (click)="conversationFilter.set('archived')">
                        View archived
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </aside>

          <main class="chat-thread">
            <div class="chat-thread__bar">
              <div class="chat-thread__stack">
                <label class="chat-search chat-search--thread">
                  <i appIcon="search"></i>
                  <input
                    type="search"
                    placeholder="Search in conversation"
                    [ngModel]="messageSearch()"
                    (ngModelChange)="messageSearch.set($event)"
                  />
                </label>

                @if (store.activeConversation(); as activeConversation) {
                  <div class="thread-flags thread-flags--rich">
                    <span>
                      {{
                        activeConversation.kind === 'group'
                          ? activeConversation.participants.length + ' members'
                          : 'Direct chat'
                      }}
                    </span>
                    <span>{{ activeStarredCount() }} starred</span>
                    <span>{{ store.realtimeConnected() ? 'Realtime active' : 'Sync fallback' }}</span>
                    @if (store.draftFor(activeConversation.id)) {
                      <span>Draft saved</span>
                    }
                    @if (activeConversation.muted) {
                      <span>Muted</span>
                    }
                    @if (store.isConversationArchived(activeConversation.id)) {
                      <span>Archived</span>
                    }
                  </div>
                }
              </div>
              <div class="message-view">
                <button
                  type="button"
                  [class.is-active]="messageView() === 'all'"
                  (click)="setMessageView('all')"
                >
                  All
                </button>
                <button
                  type="button"
                  [class.is-active]="messageView() === 'starred'"
                  (click)="setMessageView('starred')"
                >
                  Starred
                  @if (activeStarredCount() > 0) {
                    <span>{{ activeStarredCount() }}</span>
                  }
                </button>
              </div>
            </div>

            <div
              #messageScroller
              class="chat-thread__messages"
              [class.has-active-chat]="!!store.activeConversation()"
              (scroll)="onMessageScroll()"
            >
              @for (message of visibleMessages(); track message.id; let index = $index) {
                @if (shouldShowDateSeparator(index)) {
                  <div class="date-separator">{{ messageDateLabel(message) }}</div>
                }

                <article
                  class="chat-message"
                  [class.is-own]="isOwn(message)"
                  [class.is-starred]="store.isMessageStarred(message.id)"
                  (contextmenu)="openMessageMenu($event, message)"
                >
                  <div class="chat-bubble">
                    <header>
                      <span>{{ isOwn(message) ? 'You' : sender(message).name }}</span>
                      @if (message.editedAt) {
                        <small [attr.title]="message.editedAt | date: 'medium'">Edited</small>
                      }
                    </header>
                    <p>{{ message.body }}</p>
                    <footer>
                      <small class="bubble-time">{{ message.createdAt | date: 'shortTime' }}</small>
                      <span class="bubble-meta">
                        @if (messageReceiptLabel(message); as receiptLabel) {
                          <small class="delivery" [attr.data-state]="messageDeliveryLabel(message)">
                            {{ receiptLabel }}
                          </small>
                          @if (messageDeliveryLabel(message) === 'failed') {
                            <button
                              type="button"
                              class="retry-mini"
                              aria-label="Retry message"
                              (click)="retry(message)"
                            >
                              Retry
                            </button>
                          }
                        }
                      </span>
                    </footer>

                    <div class="message-actions" aria-label="Message actions">
                      <button type="button" title="Copy" aria-label="Copy" (click)="copyMessage(message)">
                        <i appIcon="clipboard-check"></i>
                      </button>
                      <button
                        type="button"
                        title="Star"
                        aria-label="Star"
                        [class.is-active]="store.isMessageStarred(message.id)"
                        (click)="toggleMessageStar(message)"
                      >
                        <i appIcon="star"></i>
                      </button>
                      <button type="button" title="Quote" aria-label="Quote" (click)="quoteMessage(message)">
                        <i appIcon="quote"></i>
                      </button>
                      @if (isOwn(message) && message.deliveryState !== 'sending') {
                        <button type="button" title="Edit" aria-label="Edit" (click)="startEdit(message)">
                          <i appIcon="pencil-square"></i>
                        </button>
                        <button
                          type="button"
                          class="is-danger"
                          title="Delete"
                          aria-label="Delete"
                          (click)="deleteMessage(message)"
                        >
                          <i appIcon="trash"></i>
                        </button>
                      }
                    </div>
                  </div>
                </article>
              } @empty {
                <div class="chat-empty chat-empty--thread">
                  <i appIcon="chat-dots"></i>
                  <strong>{{ store.activeConversation() ? 'No messages yet' : 'Select a chat' }}</strong>
                  <span>
                    {{
                      store.activeConversation()
                        ? 'Send the first message from here.'
                        : 'Choose a conversation or start a direct chat.'
                    }}
                  </span>
                </div>
              }

              @if (store.activeTypingLabel()) {
                <div class="typing-bubble" aria-live="polite">
                  <span class="typing-dots" aria-hidden="true">
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>
                  <strong>{{ store.activeTypingLabel() }}</strong>
                </div>
              }
            </div>

            @if (showJumpToLatest()) {
              <button type="button" class="jump-latest" (click)="scrollToLatest()">Latest</button>
            }

            <footer class="chat-composer">
              @if (store.activeTypingLabel()) {
                <div class="typing">{{ store.activeTypingLabel() }}...</div>
              }

              @if (editingMessage(); as editing) {
                <div class="edit-strip">
                  <span>Editing message</span>
                  <button type="button" (click)="cancelEdit()">Cancel</button>
                </div>
              }

              @if (quickReplies().length > 0 && !composer().trim() && !editingMessage()) {
                <div class="quick-replies-wrap">
                  <div class="quick-replies">
                    @for (reply of quickReplies(); track reply) {
                      <button type="button" (click)="useQuickReply(reply)">{{ reply }}</button>
                    }
                  </div>
                </div>
              }

              <div class="chat-input">
                <textarea
                  rows="1"
                  maxlength="4000"
                  placeholder="Write a message"
                  [ngModel]="composer()"
                  (ngModelChange)="onInput($event)"
                  (focus)="handleComposerFocus()"
                  (keydown)="onKeydown($event)"
                ></textarea>
                <button
                  type="button"
                  aria-label="Send message"
                  [disabled]="!canSend()"
                  (click)="send()"
                >
                  <i appIcon="send-fill"></i>
                </button>
              </div>

              <div class="composer-meta">
                <span class="composer-meta__pill" [class.is-live]="store.realtimeConnected()">
                  {{ store.realtimeConnected() ? 'Real-time connected' : 'Sync fallback active' }}
                </span>
                <span class="composer-meta__pill">Enter to send</span>
                <span class="composer-meta__pill" [class.is-warning]="composerRemaining() < 400">
                  {{ composerRemaining() }} characters left
                </span>
              </div>
            </footer>
          </main>
        </div>

        @if (contextMenu(); as menu) {
          <div class="chat-context-backdrop" (click)="closeContextMenu()"></div>
          <nav
            class="chat-context-menu"
            [style.left.px]="menu.x"
            [style.top.px]="menu.y"
            (click)="$event.stopPropagation()"
            (contextmenu)="$event.preventDefault()"
          >
            @if (menu.type === 'conversation') {
              <header>
                <span>Chat options</span>
                <strong>{{ title(menu.conversation) }}</strong>
              </header>
              <button type="button" (click)="select(menu.conversation)">
                <i appIcon="chat-dots"></i>
                Open chat
              </button>
              <button type="button" (click)="togglePinned(menu.conversation)">
                <i appIcon="pin-angle"></i>
                {{ store.isConversationPinned(menu.conversation.id) ? 'Unpin chat' : 'Pin chat' }}
              </button>
              <button type="button" (click)="toggleMuted(menu.conversation)">
                <i appIcon="bell-slash"></i>
                {{ menu.conversation.muted ? 'Unmute chat' : 'Mute chat' }}
              </button>
              <button type="button" (click)="markConversationRead(menu.conversation)">
                <i appIcon="check2-circle"></i>
                Mark as read
              </button>
              <button type="button" (click)="copyConversationLink(menu.conversation)">
                <i appIcon="link-45deg"></i>
                Copy chat link
              </button>
              <button type="button" (click)="clearConversationDraft(menu.conversation)">
                <i appIcon="eraser"></i>
                Clear draft
              </button>
              @if (store.isConversationArchived(menu.conversation.id)) {
                <button type="button" (click)="restore(menu.conversation)">
                  <i appIcon="archive"></i>
                  Restore chat
                </button>
              } @else {
                <button type="button" (click)="archive(menu.conversation)">
                  <i appIcon="archive"></i>
                  Archive chat
                </button>
              }
            } @else {
              <header>
                <span>Message options</span>
                <strong>{{ isOwn(menu.message) ? 'You' : sender(menu.message).name }}</strong>
              </header>
              <button type="button" (click)="copyMessage(menu.message)">
                <i appIcon="clipboard-check"></i>
                Copy text
              </button>
              <button type="button" (click)="quoteMessage(menu.message)">
                <i appIcon="quote"></i>
                Quote reply
              </button>
              <button type="button" (click)="toggleMessageStar(menu.message)">
                <i appIcon="star"></i>
                {{ store.isMessageStarred(menu.message.id) ? 'Unstar' : 'Star' }}
              </button>
              @if (isOwn(menu.message) && menu.message.deliveryState !== 'sending') {
                <button type="button" (click)="startEdit(menu.message)">
                  <i appIcon="pencil-square"></i>
                  Edit
                </button>
              }
              @if (messageDeliveryLabel(menu.message) === 'failed') {
                <button type="button" (click)="retry(menu.message)">
                  <i appIcon="arrow-clockwise"></i>
                  Retry
                </button>
              }
              @if (isOwn(menu.message) && menu.message.deliveryState !== 'sending') {
                <button type="button" class="is-danger" (click)="deleteMessage(menu.message)">
                  <i appIcon="trash"></i>
                  Delete
                </button>
              }
            }
          </nav>
        }
      </section>
    }

    <div
      class="chat-widget"
      [class.is-open]="open()"
      [class.is-dragging]="dragging()"
      [style.left.px]="bubblePosition().x"
      [style.top.px]="bubblePosition().y"
    >
      <button
        class="chat-launcher"
        type="button"
        aria-label="Open team chat"
        title="Drag to move. Click to open chat."
        (pointerdown)="startLauncherDrag($event)"
        (click)="toggleOpenFromLauncher($event)"
      >
        <i appIcon="chat-dots"></i>
        @if (store.totalUnread() > 0) {
          <span>{{ store.totalUnread() }}</span>
        }
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 80;
        pointer-events: none;
      }

      .chat-widget {
        position: fixed;
        width: ${BUBBLE_SIZE}px;
        height: ${BUBBLE_SIZE}px;
        pointer-events: auto;
        z-index: 90;
        will-change: left, top;
      }

      .chat-overlay {
        position: fixed;
        inset: 0;
        z-index: 82;
        background: rgb(var(--bg) / 0.48);
        backdrop-filter: blur(2px);
        pointer-events: auto;
      }

      .chat-launcher {
        position: relative;
        width: ${BUBBLE_SIZE}px;
        height: ${BUBBLE_SIZE}px;
        display: grid;
        place-items: center;
        border: 1px solid rgb(var(--primary) / 0.58);
        border-radius: 50%;
        color: white;
        background: rgb(var(--primary));
        cursor: grab;
        touch-action: none;
        transition:
          transform 120ms ease,
          background 120ms ease,
          border-color 120ms ease;
      }

      .chat-launcher:hover,
      .chat-widget.is-open .chat-launcher {
        border-color: rgb(var(--primary));
        background: rgb(var(--primary) / 0.92);
        transform: translateY(-1px);
      }

      .chat-widget.is-dragging .chat-launcher {
        cursor: grabbing;
        transform: scale(0.98);
      }

      .chat-launcher i {
        width: 24px;
        height: 24px;
      }

      .chat-launcher span {
        position: absolute;
        right: -3px;
        top: -4px;
        min-width: 21px;
        height: 21px;
        display: grid;
        place-items: center;
        border: 2px solid rgb(var(--surface));
        border-radius: 999px;
        color: white;
        background: #dc2626;
        font-size: 11px;
        font-weight: 800;
      }

      .chat-panel {
        position: fixed;
        z-index: 88;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid rgb(var(--border) / 0.68);
        border-radius: 12px;
        background: rgb(var(--surface));
        color: rgb(var(--fg));
        font-size: 13px;
        opacity: 1;
        pointer-events: auto;
      }

      .chat-panel::before {
        content: '';
        position: absolute;
        inset: 0 0 auto;
        height: 1px;
        background: linear-gradient(
          90deg,
          rgb(var(--primary) / 0) 0%,
          rgb(var(--primary) / 0.38) 24%,
          rgb(var(--primary) / 0.08) 100%
        );
        pointer-events: none;
      }

      .chat-panel__header {
        min-height: 84px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 16px;
        padding: 15px 17px;
        border-bottom: 1px solid rgb(var(--border) / 0.58);
        background: linear-gradient(180deg, rgb(var(--surface)) 0%, rgb(var(--bg1)) 100%);
      }

      .chat-title {
        min-width: 0;
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        align-items: start;
        gap: 12px;
      }

      .chat-row small,
      .chat-bubble small,
      .delivery,
      .chat-empty,
      .typing,
      .composer-meta,
      .date-separator,
      .edit-strip span {
        color: rgb(var(--fg) / 0.68);
      }

      .chat-title__avatar {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border: 1px solid rgb(var(--primary) / 0.25);
        border-radius: 50%;
        color: rgb(var(--primary));
        background: rgb(var(--primary) / 0.14);
        font-size: 15px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .chat-title__copy {
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .chat-title__label {
        color: rgb(var(--fg) / 0.58);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .chat-title__copy strong,
      .chat-title__copy small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chat-title__copy strong {
        color: rgb(var(--fg));
        font-size: 17px;
        line-height: 1.1;
      }

      .chat-title__copy small {
        color: rgb(var(--fg) / 0.66);
        font-size: 11px;
      }

      .chat-title__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        min-height: 22px;
      }

      .chat-title__meta span {
        min-height: 20px;
        display: inline-flex;
        align-items: center;
        padding: 0 7px;
        border: 1px solid rgb(var(--border) / 0.4);
        border-radius: 999px;
        color: rgb(var(--fg) / 0.62);
        background: rgb(var(--surface));
        font-size: 10px;
        font-weight: 700;
      }

      .chat-title__meta span.is-live {
        border-color: rgb(var(--primary) / 0.24);
        color: rgb(var(--primary));
      }

      .chat-panel__tools {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .chat-live {
        min-width: 56px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border: 1px solid rgb(var(--border) / 0.72);
        border-radius: 999px;
        background: rgb(var(--bg1));
        color: #d97706;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .chat-live::before {
        content: '';
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.8;
      }

      .chat-live.is-live {
        border-color: rgb(var(--primary) / 0.48);
        background: rgb(var(--primary) / 0.14);
        color: rgb(var(--primary));
      }

      .chat-panel__actions button,
      .message-actions button,
      .chat-input button,
      .jump-latest,
      .edit-strip button,
      .chat-panel__close {
        display: grid;
        place-items: center;
        border: 1px solid rgb(var(--border) / 0.56);
        border-radius: 8px;
        color: rgb(var(--fg) / 0.78);
        background: rgb(var(--bg1));
        cursor: pointer;
        font: inherit;
      }

      .chat-panel__actions {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px;
        border: 1px solid rgb(var(--border) / 0.48);
        border-radius: 10px;
        background: rgb(var(--surface));
      }

      .chat-panel__actions button,
      .chat-panel__close {
        width: 32px;
        height: 32px;
        background: transparent;
      }

      .chat-panel__actions button:hover,
      .chat-panel__close:hover,
      .message-actions button:hover,
      .message-actions button.is-active,
      .edit-strip button:hover {
        border-color: rgb(var(--primary) / 0.42);
        color: rgb(var(--primary));
        background: rgb(var(--primary) / 0.12);
      }

      .chat-panel__actions button i,
      .chat-panel__close i,
      .message-actions button i,
      .chat-input button i,
      .chat-row strong i,
      .chat-row__meta i,
      .chat-search i {
        width: 14px;
        height: 14px;
      }

      .chat-panel__body {
        min-height: 0;
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(252px, 292px) minmax(0, 1fr);
        overflow: hidden;
        background: rgb(var(--surface));
      }

      .chat-list {
        min-height: 0;
        min-width: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 10px;
        overflow: hidden;
        padding: 13px 12px 12px;
        border-inline-end: 1px solid rgb(var(--border) / 0.58);
        background: rgb(var(--surface));
      }

      .chat-list.is-directory {
        grid-template-rows: auto minmax(0, 1fr);
      }

      .chat-list__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 28px;
      }

      .chat-list__head strong {
        font-size: 12px;
      }

      .chat-list__stack {
        min-width: 0;
        width: 100%;
        max-width: 100%;
        display: grid;
        align-content: start;
        gap: 10px;
        padding-bottom: 2px;
      }

      .chat-scroll {
        min-height: 0;
        overflow: auto;
        padding-inline-end: 2px;
        scrollbar-width: thin;
      }

      .chat-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 22px;
      }

      .chat-section-label {
        color: rgb(var(--fg) / 0.58);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .chat-section-caption {
        color: rgb(var(--fg) / 0.52);
        font-size: 10px;
      }

      .chat-summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }

      .chat-summary-grid span {
        min-width: 0;
        min-height: 52px;
        display: grid;
        align-content: center;
        gap: 3px;
        padding: 0 10px;
        border: 1px solid rgb(var(--border) / 0.44);
        border-radius: 10px;
        background: rgb(var(--surface));
      }

      .chat-summary-grid strong {
        color: rgb(var(--fg));
        font-size: 14px;
        line-height: 1;
      }

      .chat-summary-grid small {
        color: rgb(var(--fg) / 0.58);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .chat-list__head button {
        height: 26px;
        padding: 0 9px;
        border: 1px solid rgb(var(--border) / 0.56);
        border-radius: 8px;
        color: rgb(var(--fg) / 0.76);
        background: rgb(var(--surface));
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 800;
      }

      .chat-search,
      .chat-input {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgb(var(--border) / 0.52);
        border-radius: 10px;
        background: rgb(var(--bg1));
      }

      .chat-search {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        height: 40px;
        padding: 0 12px;
      }

      .chat-search--thread {
        min-width: 0;
        height: 36px;
      }

      .chat-search input,
      .chat-input textarea {
        min-width: 0;
        width: 100%;
        border: 0;
        outline: 0;
        color: rgb(var(--fg));
        background: transparent;
        font: inherit;
      }

      .chat-filter,
      .message-view {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
        gap: 5px;
        padding: 3px;
        border: 1px solid rgb(var(--border) / 0.48);
        border-radius: 10px;
        background: rgb(var(--bg1));
      }

      .quick-replies::-webkit-scrollbar {
        display: none;
      }

      .chat-filter button,
      .message-view button,
      .quick-replies button,
      .retry-mini {
        min-height: 28px;
        border: 1px solid transparent;
        border-radius: 7px;
        color: rgb(var(--fg) / 0.76);
        background: transparent;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 800;
      }

      .chat-filter button {
        min-width: 0;
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 0 9px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .message-view button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 0 9px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .chat-filter button span,
      .message-view button span {
        min-width: 16px;
        height: 16px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: white;
        background: rgb(var(--primary));
        font-size: 9px;
      }

      .chat-filter button:hover,
      .chat-filter button.is-active,
      .message-view button:hover,
      .message-view button.is-active,
      .quick-replies button:hover {
        border-color: rgb(var(--primary) / 0.24);
        color: rgb(var(--primary));
        background: rgb(var(--surface));
      }

      .chat-rows,
      .chat-users {
        display: grid;
        align-content: start;
        gap: 6px;
        min-height: 0;
        overflow: auto;
        padding-inline-end: 2px;
      }

      .chat-row {
        min-width: 0;
        width: 100%;
        min-height: 66px;
        display: grid;
        grid-template-columns: 38px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 10px 11px;
        border: 1px solid rgb(var(--border) / 0.06);
        border-inline-start: 2px solid transparent;
        border-radius: 9px;
        color: inherit;
        background: rgb(var(--bg1) / 0.56);
        text-align: start;
        cursor: pointer;
        transition:
          background 120ms ease,
          border-color 120ms ease,
          transform 120ms ease;
      }

      .chat-row:hover,
      .chat-row.is-active {
        border-color: rgb(var(--primary) / 0.24);
        border-inline-start-color: rgb(var(--primary));
        background: rgb(var(--primary) / 0.09);
        transform: translateY(-1px);
      }

      .chat-row.is-unread:not(.is-active) {
        border-color: rgb(var(--border) / 0.18);
        background: rgb(var(--surface));
      }

      .chat-row__body {
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .chat-row__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .row-chip {
        min-height: 18px;
        display: inline-flex;
        align-items: center;
        padding: 0 6px;
        border: 1px solid rgb(var(--border) / 0.42);
        border-radius: 999px;
        color: rgb(var(--fg) / 0.62);
        background: rgb(var(--surface));
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .row-chip.is-draft {
        border-color: rgb(217 119 6 / 0.34);
        color: #d97706;
      }

      .row-chip.is-pending {
        border-color: rgb(var(--primary) / 0.32);
        color: rgb(var(--primary));
      }

      .chat-row strong,
      .chat-row small {
        overflow: hidden;
      }

      .chat-row strong {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .chat-row strong i,
      .chat-row__meta i {
        color: rgb(var(--primary));
      }

      .chat-row__body small {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
        white-space: normal;
        font-size: 11px;
        line-height: 1.3;
      }

      .chat-row small.is-typing,
      .typing {
        color: rgb(var(--primary));
        font-weight: 800;
      }

      .chat-row__meta {
        display: grid;
        justify-items: end;
        gap: 4px;
        min-width: 40px;
      }

      .chat-row__meta small {
        font-variant-numeric: tabular-nums;
      }

      .chat-row__meta b {
        min-width: 18px;
        height: 18px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        color: white;
        background: rgb(var(--primary));
        font-size: 9px;
      }

      .avatar {
        position: relative;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        color: rgb(var(--primary));
        background: rgb(var(--primary) / 0.14);
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .avatar.is-online::after {
        content: '';
        position: absolute;
        right: 1px;
        bottom: 1px;
        width: 8px;
        height: 8px;
        border: 2px solid rgb(var(--surface));
        border-radius: 50%;
        background: #16a34a;
      }

      .chat-thread {
        position: relative;
        min-width: 0;
        min-height: 0;
        width: 100%;
        overflow: hidden;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        background: rgb(var(--bg1));
      }

      .chat-thread__bar {
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid rgb(var(--border) / 0.5);
        background: rgb(var(--surface));
      }

      .chat-thread__stack {
        min-width: 0;
        display: grid;
        gap: 6px;
      }

      .chat-thread__messages {
        min-height: 0;
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        overflow: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        padding: 20px 18px 16px;
        scrollbar-gutter: stable;
        scrollbar-width: thin;
        background:
          linear-gradient(180deg, rgb(var(--surface)) 0%, rgb(var(--bg1)) 100%);
      }

      .chat-thread__messages.has-active-chat {
        justify-content: flex-start;
      }

      .chat-panel.is-stacked .chat-panel__body {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(228px, 40%) minmax(0, 1fr);
      }

      .chat-panel.is-stacked .chat-list {
        border-inline-end: 0;
        border-bottom: 1px solid rgb(var(--border) / 0.62);
      }

      .chat-panel.is-stacked .chat-thread__bar {
        grid-template-columns: 1fr;
      }

      .chat-panel.is-stacked .chat-filter {
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
      }

      .chat-panel.is-stacked .message-view {
        width: 100%;
      }

      .thread-flags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .thread-flags--rich span {
        min-height: 22px;
        padding-inline: 9px;
      }

      .thread-flags span {
        min-height: 21px;
        display: inline-flex;
        align-items: center;
        padding: 0 8px;
        border: 1px solid rgb(var(--border) / 0.42);
        border-radius: 999px;
        color: rgb(var(--fg) / 0.64);
        background: rgb(var(--bg1));
        font-size: 10px;
        font-weight: 700;
      }

      .date-separator {
        align-self: center;
        min-height: 22px;
        display: inline-flex;
        align-items: center;
        padding: 0 9px;
        border: 1px solid rgb(var(--border) / 0.4);
        border-radius: 999px;
        background: rgb(var(--surface));
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .chat-message {
        display: flex;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        justify-content: flex-start;
      }

      .chat-message.is-own {
        justify-content: flex-end;
      }

      .chat-message.is-starred .chat-bubble {
        border-color: rgb(217 119 6 / 0.55);
      }

      .chat-bubble {
        position: relative;
        display: grid;
        gap: 9px;
        min-width: 0;
        width: fit-content;
        max-width: min(620px, calc(100% - 42px));
        box-sizing: border-box;
        padding: 12px 13px;
        border: 1px solid rgb(var(--border) / 0.46);
        border-radius: 14px 14px 14px 7px;
        background: rgb(var(--surface));
        overflow: visible;
      }

      .chat-message.is-own .chat-bubble {
        border-color: rgb(var(--primary) / 0.52);
        background: rgb(var(--primary) / 0.1);
        border-radius: 14px 14px 7px 14px;
      }

      .chat-bubble header,
      .chat-bubble footer {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .chat-bubble header {
        justify-content: space-between;
      }

      .chat-bubble header span {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.01em;
      }

      .chat-bubble header small {
        min-height: 18px;
        display: inline-flex;
        align-items: center;
        padding: 0 6px;
        border: 1px solid rgb(var(--border) / 0.36);
        border-radius: 999px;
        background: rgb(var(--bg1));
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .chat-bubble p {
        margin: 0;
        color: rgb(var(--fg));
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .chat-bubble footer {
        justify-content: space-between;
        min-height: 16px;
        gap: 8px;
        flex-wrap: wrap;
      }

      .bubble-time {
        font-variant-numeric: tabular-nums;
      }

      .bubble-meta {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        margin-inline-start: auto;
        flex-wrap: wrap;
      }

      .delivery {
        min-height: 17px;
        display: inline-flex;
        align-items: center;
        padding: 0 6px;
        border: 1px solid rgb(var(--border) / 0.44);
        border-radius: 999px;
        background: rgb(var(--surface));
        font-size: 10px;
        font-weight: 800;
      }

      .delivery[data-state='read'] {
        border-color: rgb(var(--primary) / 0.42);
        background: rgb(var(--primary) / 0.12);
        color: rgb(var(--primary));
      }

      .delivery[data-state='delivered'] {
        color: rgb(var(--fg) / 0.76);
      }

      .delivery[data-state='failed'] {
        border-color: rgb(220 38 38 / 0.34);
        background: rgb(127 29 29 / 0.22);
        color: #dc2626;
      }

      .retry-mini {
        min-height: 22px;
        padding: 0 7px;
        border-color: rgb(220 38 38 / 0.34);
        color: #fecaca;
        background: rgb(127 29 29 / 0.22);
      }

      .message-actions {
        position: absolute;
        top: 8px;
        inset-inline-end: 8px;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 3px;
        border: 1px solid rgb(var(--border) / 0.64);
        border-radius: 999px;
        background: rgb(var(--bg1));
        opacity: 0;
        transform: translateY(-4px);
        pointer-events: none;
        transition:
          opacity 120ms ease,
          transform 120ms ease;
      }

      .chat-bubble:hover .message-actions,
      .chat-bubble:focus-within .message-actions {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .message-actions button {
        width: 26px;
        height: 26px;
        background: rgb(var(--surface));
        border-radius: 999px;
      }

      .message-actions button.is-danger {
        color: #fecaca;
      }

      .message-actions button.is-danger:hover {
        border-color: rgb(220 38 38 / 0.42);
        color: #fecaca;
        background: rgb(127 29 29 / 0.24);
      }

      .jump-latest {
        position: absolute;
        right: 18px;
        bottom: 112px;
        z-index: 2;
        min-height: 28px;
        padding: 0 10px;
        color: rgb(var(--primary));
        background: rgb(var(--surface));
        font-size: 11px;
        font-weight: 800;
      }

      .chat-composer {
        min-width: 0;
        display: grid;
        gap: 10px;
        padding: 13px 14px 14px;
        border-top: 1px solid rgb(var(--border) / 0.54);
        background: rgb(var(--surface));
      }

      .typing {
        min-height: 14px;
        font-size: 11px;
      }

      .typing-bubble {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        max-width: min(360px, 82%);
        min-height: 32px;
        padding: 7px 10px;
        border: 1px solid rgb(var(--primary) / 0.22);
        border-radius: 8px;
        color: rgb(var(--primary));
        background: rgb(var(--surface));
        font-size: 11px;
        font-weight: 800;
      }

      .typing-dots {
        display: inline-flex;
        gap: 2px;
      }

      .typing-dots i {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
        animation: chatTypingPulse 900ms ease-in-out infinite;
      }

      .typing-dots i:nth-child(2) {
        animation-delay: 120ms;
      }

      .typing-dots i:nth-child(3) {
        animation-delay: 240ms;
      }

      .edit-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 30px;
        padding: 0 9px;
        border: 1px solid rgb(var(--primary) / 0.32);
        border-radius: 8px;
        background: rgb(var(--primary) / 0.1);
        font-size: 11px;
        font-weight: 800;
      }

      .edit-strip button {
        min-height: 24px;
        padding: 0 8px;
        background: rgb(var(--surface));
        font-size: 11px;
        font-weight: 800;
      }

      .quick-replies-wrap {
        display: block;
      }

      .quick-replies {
        display: flex;
        gap: 5px;
        overflow-x: auto;
        padding-bottom: 2px;
        scrollbar-width: none;
      }

      .quick-replies button {
        flex: 0 0 auto;
        min-height: 28px;
        max-width: 190px;
        padding: 0 10px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-radius: 999px;
        color: rgb(var(--fg) / 0.72);
        background: rgb(var(--bg1));
      }

      .chat-input {
        min-width: 0;
        padding: 6px 6px 6px 12px;
      }

      .chat-input textarea {
        min-height: 36px;
        max-height: 92px;
        resize: none;
        padding: 7px 0;
      }

      .chat-input button {
        width: 38px;
        height: 38px;
        border-color: rgb(var(--primary) / 0.48);
        color: white;
        background: rgb(var(--primary));
        border-radius: 9px;
      }

      .chat-input button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .composer-meta {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 10px;
        line-height: 1.2;
      }

      .composer-meta__pill {
        min-height: 20px;
        display: inline-flex;
        align-items: center;
        padding: 0 7px;
        border: 1px solid rgb(var(--border) / 0.4);
        border-radius: 999px;
        background: rgb(var(--bg1));
      }

      .composer-meta__pill.is-live {
        border-color: rgb(var(--primary) / 0.24);
        color: rgb(var(--primary));
      }

      .composer-meta__pill.is-warning {
        border-color: rgb(217 119 6 / 0.32);
        color: #d97706;
      }

      .chat-empty {
        padding: 14px;
        text-align: center;
      }

      .chat-empty--list {
        display: grid;
        justify-items: center;
        gap: 8px;
      }

      .chat-empty--list strong {
        color: rgb(var(--fg));
        font-size: 12px;
      }

      .chat-empty--list button {
        min-height: 28px;
        padding: 0 10px;
        border: 1px solid rgb(var(--primary) / 0.34);
        border-radius: 8px;
        color: rgb(var(--primary));
        background: rgb(var(--primary) / 0.12);
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 800;
      }

      .chat-empty--thread {
        align-self: center;
        display: grid;
        justify-items: center;
        gap: 6px;
        max-width: 240px;
        margin-block: auto;
        border: 1px solid rgb(var(--border) / 0.42);
        border-radius: 8px;
        background: rgb(var(--bg1));
      }

      .chat-empty--thread i {
        width: 24px;
        height: 24px;
        color: rgb(var(--primary));
      }

      .chat-empty--thread strong {
        color: rgb(var(--fg));
      }

      .chat-empty--thread span {
        color: rgb(var(--fg) / 0.66);
        font-size: 11px;
        line-height: 1.4;
      }

      .chat-error {
        padding: 8px 10px;
        border: 1px solid rgb(220 38 38 / 0.28);
        border-radius: 8px;
        color: #fecaca;
        background: rgb(127 29 29 / 0.22);
        font-size: 12px;
      }

      .chat-context-backdrop {
        position: fixed;
        inset: 0;
        z-index: 95;
        background: transparent;
        pointer-events: auto;
      }

      .chat-context-menu {
        position: fixed;
        z-index: 96;
        width: 238px;
        display: grid;
        gap: 6px;
        padding: 10px;
        border: 1px solid rgb(var(--border) / 0.62);
        border-radius: 12px;
        background: linear-gradient(180deg, rgb(var(--surface)) 0%, rgb(var(--bg1)) 100%);
        pointer-events: auto;
      }

      .chat-context-menu header {
        display: grid;
        gap: 3px;
        padding: 8px 8px 9px;
        border-bottom: 1px solid rgb(var(--border) / 0.56);
      }

      .chat-context-menu header span {
        color: rgb(var(--fg) / 0.58);
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .chat-context-menu header strong {
        overflow: hidden;
        color: rgb(var(--fg));
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chat-context-menu button {
        min-height: 36px;
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        padding: 0 10px;
        border: 1px solid rgb(var(--border) / 0.5);
        border-radius: 10px;
        color: rgb(var(--fg) / 0.76);
        background: rgb(var(--surface));
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        text-align: start;
      }

      .chat-context-menu button:hover {
        border-color: rgb(var(--primary) / 0.42);
        color: rgb(var(--primary));
        background: rgb(var(--primary) / 0.12);
      }

      .chat-context-menu button i {
        width: 16px;
        height: 16px;
      }

      .chat-context-menu button.is-danger {
        color: #fecaca;
      }

      .chat-context-menu button.is-danger:hover {
        border-color: rgb(220 38 38 / 0.38);
        color: #fecaca;
        background: rgb(127 29 29 / 0.24);
      }

      @media (max-width: 820px) {
        .chat-panel__body {
          grid-template-columns: 1fr;
          grid-template-rows: minmax(220px, 40%) minmax(0, 1fr);
        }

        .chat-list {
          border-inline-end: 0;
          border-bottom: 1px solid rgb(var(--border) / 0.62);
        }
      }

      @media (max-width: 620px) {
        .chat-panel {
          border-radius: 0;
        }

        .chat-panel__header {
          grid-template-columns: 1fr;
          align-items: start;
        }

        .chat-panel__tools {
          width: 100%;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .chat-panel__actions {
          flex: 1 1 auto;
        }

        .chat-thread__bar {
          grid-template-columns: 1fr;
        }

        .message-view {
          width: 100%;
        }

        .message-view button {
          width: 100%;
        }

        .chat-filter {
          grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
        }

        .chat-summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .composer-meta {
          align-items: flex-start;
          gap: 3px;
        }

        .composer-meta__pill {
          min-height: 22px;
        }
      }

      @keyframes chatTypingPulse {
        0%,
        80%,
        100% {
          opacity: 0.36;
          transform: translateY(0);
        }

        40% {
          opacity: 1;
          transform: translateY(-2px);
        }
      }
    `
  ]
})
export class MessagesWidgetComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('messageScroller') private messageScroller?: ElementRef<HTMLDivElement>;

  readonly store = inject(MessagesStoreService);
  private readonly toast = inject(ToastService);
  readonly open = signal(false);
  readonly directoryOpen = signal(false);
  readonly composer = signal('');
  readonly search = signal('');
  readonly conversationSearch = signal('');
  readonly conversationFilter = signal<ConversationFilter>('all');
  readonly messageSearch = signal('');
  readonly messageView = signal<MessageView>('all');
  readonly editingMessage = signal<ChatMessage | null>(null);
  readonly contextMenu = signal<WidgetContextMenu | null>(null);
  readonly quickReplies = computed(() => this.store.quickReplies().slice(0, 6));
  readonly unreadConversationCount = computed(
    () => this.store.conversations().filter(conversation => conversation.unreadCount > 0).length
  );
  readonly pinnedConversationCount = computed(
    () => this.store.conversations().filter(conversation => this.store.isConversationPinned(conversation.id)).length
  );
  readonly archivedConversationCount = computed(
    () => this.store.conversations().filter(conversation => this.store.isConversationArchived(conversation.id)).length
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
  readonly dragging = signal(false);
  readonly viewport = signal<WidgetViewport>(this.readViewport());
  readonly bubblePosition = signal<WidgetPoint>(this.loadBubblePosition());
  readonly showJumpToLatest = signal(false);
  readonly compactMode = computed(() => {
    const viewport = this.viewport();
    return viewport.width <= 820 || viewport.height <= 760;
  });
  readonly stackedLayout = computed(() => this.compactMode() || this.panelWidth() <= 1040);
  readonly composerRemaining = computed(() => MESSAGE_MAX_LENGTH - this.composer().length);
  readonly canSend = computed(() => {
    const body = this.composer().trim();
    return !!body && this.composer().length <= MESSAGE_MAX_LENGTH && !this.store.sending();
  });

  readonly panelWidth = computed(() => {
    const width = this.viewport().width;
    if (this.compactMode()) {
      return Math.max(300, width - 12);
    }
    return Math.min(1080, Math.max(860, width - 32));
  });

  readonly panelHeight = computed(() => {
    const height = this.viewport().height;
    if (this.compactMode()) {
      return Math.max(460, height - 12);
    }
    return Math.min(740, Math.max(620, height - 40));
  });

  readonly panelLeft = computed(() => {
    if (this.compactMode()) {
      return 8;
    }
    const viewport = this.viewport();
    const position = this.bubblePosition();
    const width = this.panelWidth();
    const opensLeft = position.x + BUBBLE_SIZE / 2 > viewport.width / 2;
    const preferred = opensLeft ? position.x + BUBBLE_SIZE - width : position.x;
    return this.clamp(preferred, PANEL_MARGIN, viewport.width - width - PANEL_MARGIN);
  });

  readonly panelTop = computed(() => {
    if (this.compactMode()) {
      return 8;
    }
    const viewport = this.viewport();
    const position = this.bubblePosition();
    const height = this.panelHeight();
    const below = position.y + BUBBLE_SIZE + 12;
    const above = position.y - height - 12;
    const preferred = below + height <= viewport.height - PANEL_MARGIN ? below : above;
    return this.clamp(preferred, PANEL_MARGIN, viewport.height - height - PANEL_MARGIN);
  });

  readonly filteredUsers = computed(() => {
    const query = this.search().trim().toLowerCase();
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
      .slice(0, 14);
  });

  readonly visibleConversations = computed(() => {
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
      if (filter === 'pinned' && !this.store.isConversationPinned(conversation.id)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        this.title(conversation),
        this.subtitle(conversation),
        conversation.lastMessage?.body ?? '',
        ...conversation.participants.map(
          user => `${user.name} ${user.email ?? ''} ${user.role ?? ''}`
        )
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
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
      return [message.body, this.sender(message).name, message.createdAt]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  readonly activeStarredCount = computed(
    () =>
      this.store.activeMessages().filter(message => this.store.isMessageStarred(message.id)).length
  );

  readonly activeTitle = computed(() => {
    const conversation = this.store.activeConversation();
    return conversation ? this.title(conversation) : 'Messages';
  });

  readonly activeSubtitle = computed(() => {
    const conversation = this.store.activeConversation();
    if (!conversation) {
      return 'Drag the bubble anywhere. Chat stays here.';
    }
    const typingLabel = this.typingLabelForConversation(conversation);
    if (typingLabel) {
      return typingLabel;
    }
    if (this.store.isConversationArchived(conversation.id)) {
      return 'Archived chat';
    }
    return this.subtitle(conversation);
  });

  private typingHeartbeat?: ReturnType<typeof setInterval>;
  private shouldStickToBottom = true;
  private dragOffset: WidgetPoint = { x: 0, y: 0 };
  private dragStart: WidgetPoint = { x: 0, y: 0 };
  private dragMoved = false;
  private suppressNextLauncherClick = false;

  ngAfterViewChecked(): void {
    if (!this.open() || !this.shouldStickToBottom) {
      return;
    }
    this.scrollToBottom();
  }

  toggleOpenFromLauncher(event: MouseEvent): void {
    if (this.suppressNextLauncherClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.toggleOpen();
  }

  toggleOpen(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.openWidget();
  }

  close(): void {
    this.open.set(false);
    this.directoryOpen.set(false);
    this.search.set('');
    this.conversationSearch.set('');
    this.messageSearch.set('');
    this.editingMessage.set(null);
    this.closeContextMenu();
    this.syncTypingHeartbeat();
  }

  refresh(): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.store.refreshActive();
  }

  toggleDirectory(): void {
    this.closeContextMenu();
    this.directoryOpen.update(value => !value);
    if (this.directoryOpen()) {
      this.store.searchUsers(this.search());
    }
  }

  updateSearch(value: string): void {
    this.search.set(value);
    this.store.searchUsers(value);
  }

  openDirect(user: ChatUser): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.editingMessage.set(null);
    this.store.openDirect(user);
    this.directoryOpen.set(false);
    this.search.set('');
    this.messageSearch.set('');
    this.composer.set('');
  }

  select(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.editingMessage.set(null);
    this.messageSearch.set('');
    this.store.selectConversation(conversation.id);
    this.composer.set(this.store.draftFor(conversation.id));
  }

  setMessageView(view: MessageView): void {
    this.messageView.set(view);
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
  }

  title(conversation: ChatConversation): string {
    if (conversation.kind === 'group') {
      return conversation.title;
    }
    return this.otherParticipants(conversation)[0]?.name || conversation.title;
  }

  subtitle(conversation: ChatConversation): string {
    if (conversation.kind === 'group') {
      return `${conversation.participants.length} members`;
    }
    const other = this.otherParticipants(conversation)[0];
    if (!other) {
      return 'Direct message';
    }
    if (other.online) {
      return 'Online now';
    }
    return other.role || other.email || 'Direct message';
  }

  messagePreview(conversation: ChatConversation): string {
    if (!conversation.lastMessage?.body) {
      return this.subtitle(conversation);
    }
    return conversation.lastMessage.editedAt
      ? `Edited: ${conversation.lastMessage.body}`
      : conversation.lastMessage.body;
  }

  typingLabelForConversation(conversation: ChatConversation): string {
    const names = this.store
      .typingStates()
      .filter(
        state => state.conversationId === conversation.id && !this.store.isCurrentUserId(state.userId)
      )
      .map(state => state.userName)
      .filter(Boolean);
    if (!names.length) {
      return '';
    }
    return names.length === 1 ? `${names[0]} is typing` : `${names.length} people are typing`;
  }

  sender(message: ChatMessage): ChatUser {
    const conversation = this.store.activeConversation();
    return (
      conversation?.participants.find(user => this.store.hasUserId([user.id], message.senderId)) ?? {
        id: message.senderId,
        name: this.isOwn(message) ? 'You' : 'User'
      }
    );
  }

  isOwn(message: ChatMessage): boolean {
    return this.store.isCurrentUserId(message.senderId);
  }

  messageDeliveryLabel(message: ChatMessage): string {
    if (!this.isOwn(message)) {
      return '';
    }
    if (message.deliveryState === 'sending') {
      return 'sending';
    }
    if (message.deliveryState === 'failed') {
      return 'failed';
    }
    const conversation = this.store.activeConversation();
    const otherUserIds = conversation
      ? this.otherParticipants(conversation).map(user => user.id)
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

  onInput(value: string): void {
    this.composer.set(value);
    if (!this.editingMessage()) {
      this.store.saveDraft(this.store.activeConversationId(), value);
    }
    this.store.emitTyping(true);
    this.syncTypingHeartbeat();
  }

  handleComposerFocus(): void {
    if (!this.composer().trim()) {
      return;
    }
    this.store.emitTyping(true);
    this.syncTypingHeartbeat();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.send();
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
    if (!this.isOwn(message) || message.deliveryState === 'sending') {
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

  retry(message: ChatMessage): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.store.retryMessage(message);
  }

  useQuickReply(reply: string): void {
    this.closeContextMenu();
    const next = this.composer().trim() ? `${this.composer()}\n${reply}` : reply;
    this.onInput(next);
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
    if (this.store.activeConversationId() !== conversation.id) {
      this.composer.set(this.store.draftFor(this.store.activeConversationId()));
    }
  }

  restore(conversation: ChatConversation): void {
    this.closeContextMenu();
    this.store.restoreConversation(conversation.id);
    this.conversationFilter.set('all');
    this.select(conversation);
  }

  toggleArchived(conversation: ChatConversation): void {
    if (this.store.isConversationArchived(conversation.id)) {
      this.restore(conversation);
      return;
    }
    this.archive(conversation);
  }

  openConversationMenu(event: MouseEvent, conversation: ChatConversation): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({
      type: 'conversation',
      conversation,
      ...this.contextMenuPosition(event, 230, 340)
    });
  }

  openMessageMenu(event: MouseEvent, message: ChatMessage): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({
      type: 'message',
      message,
      ...this.contextMenuPosition(event, 226, 342)
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

  copyMessage(message: ChatMessage): void {
    this.closeContextMenu();
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(message.body).catch(() => undefined);
  }

  quoteMessage(message: ChatMessage): void {
    this.closeContextMenu();
    const sender = this.isOwn(message) ? 'You' : this.sender(message).name;
    const quotedBody = message.body
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    const quote = `Replying to ${sender}\n${quotedBody}\n\n`;
    this.onInput(this.composer().trim() ? `${this.composer()}\n${quote}` : quote);
  }

  toggleMessageStar(message: ChatMessage): void {
    this.closeContextMenu();
    this.store.toggleMessageStarred(message.id);
  }

  deleteMessage(message: ChatMessage): void {
    this.closeContextMenu();
    if (!this.isOwn(message)) {
      return;
    }
    if (typeof window === 'undefined') {
      this.store.deleteMessage(message);
      return;
    }

    this.toast.action(
      'danger',
      'This removes the message from the current conversation.',
      'Delete',
      () => {
        this.store.deleteMessage(message);
      },
      8000,
      undefined,
      {
        title: 'Delete message?',
        coalesce: false
      }
    );
  }

  onMessageScroll(): void {
    const element = this.messageScroller?.nativeElement;
    if (!element) {
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    this.shouldStickToBottom = distanceFromBottom < 90;
    this.showJumpToLatest.set(!this.shouldStickToBottom);
  }

  scrollToLatest(): void {
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.scrollToBottom();
    this.store.markActiveRead();
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

  otherParticipants(conversation: ChatConversation): ChatUser[] {
    return conversation.participants.filter(user => !this.store.isCurrentUser(user));
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

  startLauncherDrag(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.dragging.set(true);
    this.dragMoved = false;
    this.suppressNextLauncherClick = false;
    this.dragStart = { x: event.clientX, y: event.clientY };
    const position = this.bubblePosition();
    this.dragOffset = {
      x: event.clientX - position.x,
      y: event.clientY - position.y
    };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  }

  @HostListener('document:pointermove', ['$event'])
  handleLauncherDrag(event: PointerEvent): void {
    if (!this.dragging()) {
      return;
    }
    const deltaX = Math.abs(event.clientX - this.dragStart.x);
    const deltaY = Math.abs(event.clientY - this.dragStart.y);
    if (deltaX > 3 || deltaY > 3) {
      this.dragMoved = true;
    }
    this.bubblePosition.set(
      this.clampBubblePosition({
        x: event.clientX - this.dragOffset.x,
        y: event.clientY - this.dragOffset.y
      })
    );
  }

  @HostListener('document:pointerup')
  stopLauncherDrag(): void {
    if (!this.dragging()) {
      return;
    }
    this.dragging.set(false);
    this.saveBubblePosition(this.bubblePosition());
    if (this.dragMoved) {
      this.suppressNextLauncherClick = true;
      window.setTimeout(() => {
        this.suppressNextLauncherClick = false;
      }, 0);
    }
  }

  @HostListener('window:resize')
  handleResize(): void {
    this.viewport.set(this.readViewport());
    this.bubblePosition.update(position => this.clampBubblePosition(position));
    this.saveBubblePosition(this.bubblePosition());
  }

  @HostListener('window:blur')
  handleWindowBlur(): void {
    if (this.dragging()) {
      this.stopLauncherDrag();
    }
  }

  @HostListener('window:engineers-salary-reference:messages-open', ['$event'])
  handleExternalOpen(event: Event): void {
    const detail = (event as CustomEvent<{ conversationId?: string | null }>).detail;
    this.openWidget(detail?.conversationId ?? null);
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeContextMenu();
    if (this.open()) {
      this.close();
    }
  }

  private openWidget(preferredConversationId?: string | null): void {
    this.open.set(true);
    this.directoryOpen.set(false);
    this.closeContextMenu();
    this.shouldStickToBottom = true;
    this.showJumpToLatest.set(false);
    this.store.load(preferredConversationId ?? this.store.activeConversationId());
    this.store.markActiveRead();
    this.composer.set(this.store.draftFor(this.store.activeConversationId()));
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

  private syncTypingHeartbeat(): void {
    if (!this.open() || !this.composer().trim()) {
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
      if (!this.open() || !this.composer().trim()) {
        this.syncTypingHeartbeat();
        return;
      }
      this.store.emitTyping(true);
    }, 1200);
  }

  private loadBubblePosition(): WidgetPoint {
    const fallback = this.defaultBubblePosition();
    if (typeof window === 'undefined') {
      return fallback;
    }
    try {
      const raw = window.localStorage.getItem(WIDGET_POSITION_KEY);
      if (!raw) {
        return fallback;
      }
      const value = JSON.parse(raw) as Partial<WidgetPoint>;
      return this.clampBubblePosition({
        x: Number(value.x) || fallback.x,
        y: Number(value.y) || fallback.y
      });
    } catch {
      return fallback;
    }
  }

  private saveBubblePosition(position: WidgetPoint): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(WIDGET_POSITION_KEY, JSON.stringify(position));
    } catch {
      // The widget position is a convenience preference only.
    }
  }

  private defaultBubblePosition(): WidgetPoint {
    const viewport = this.readViewport();
    return this.clampBubblePosition({
      x: viewport.width - BUBBLE_SIZE - 20,
      y: viewport.height - BUBBLE_SIZE - 20
    });
  }

  private clampBubblePosition(position: WidgetPoint): WidgetPoint {
    const viewport = this.readViewport();
    return {
      x: this.clamp(position.x, BUBBLE_MARGIN, viewport.width - BUBBLE_SIZE - BUBBLE_MARGIN),
      y: this.clamp(position.y, BUBBLE_MARGIN, viewport.height - BUBBLE_SIZE - BUBBLE_MARGIN)
    };
  }

  private readViewport(): WidgetViewport {
    if (typeof window === 'undefined') {
      return { width: 1280, height: 720 };
    }
    return {
      width: Math.max(360, window.innerWidth || 1280),
      height: Math.max(520, window.innerHeight || 720)
    };
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }
    return Math.max(min, Math.min(value, max));
  }

  ngOnDestroy(): void {
    if (this.typingHeartbeat) {
      clearInterval(this.typingHeartbeat);
    }
  }
}
