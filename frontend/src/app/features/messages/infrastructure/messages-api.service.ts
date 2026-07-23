import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { normalizeApiUrl } from '@core/http/api-url.util';
import { resolveAuthRuntimeOptions } from '@core/auth/auth-runtime.util';
import { runtimeConfig } from '@core/runtime-config';
import { environment } from '@env/environment';
import { ChatConversation, ChatMessage, ChatPagedMessages, ChatUser } from '../domain/messages.models';
import { ChatTypingState } from '../domain/messages.models';

type LooseRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class MessagesApiService {
  private readonly http = inject(HttpClient);
  private readonly authRuntime = resolveAuthRuntimeOptions();
  readonly lastError = signal<string | null>(null);

  listConversations(): Observable<ChatConversation[] | null> {
    return this.http.get<unknown>(this.url('Messaging/conversations'), this.options()).pipe(
      map(response => this.unwrapArray(response).map(item => this.normalizeConversation(item))),
      catchError(error =>
        this.handleError<ChatConversation[]>(error, 'Could not load conversations.')
      )
    );
  }

  listMessages(
    conversationId: string,
    cursor?: string | null
  ): Observable<ChatPagedMessages | null> {
    return this.http
      .get<unknown>(
        this.url(`Messaging/conversations/${encodeURIComponent(conversationId)}/messages`),
        {
          ...this.options(),
          params: cursor ? { cursor, limit: 50 } : { limit: 50 }
        }
      )
      .pipe(
        map(response => {
          const payload = this.unwrapPayload(response);
          const rawItems = Array.isArray(payload)
            ? payload
            : this.asArray(
                this.asRecord(payload)?.['items'] ?? this.asRecord(payload)?.['messages']
              );
          return {
            items: rawItems.map(item => this.normalizeMessage(item, conversationId)),
            nextCursor: this.asString(this.asRecord(payload)?.['nextCursor'])
          };
        }),
        catchError(error => this.handleError<ChatPagedMessages>(error, 'Could not load messages.'))
      );
  }

  searchUsers(query: string): Observable<ChatUser[] | null> {
    return this.http
      .get<unknown>(this.url('Messaging/users'), {
        ...this.options(),
        params: query.trim() ? { search: query.trim(), limit: 20 } : { limit: 20 }
      })
      .pipe(
        map(response => this.unwrapArray(response).map(item => this.normalizeUser(item))),
        catchError(error => this.handleError<ChatUser[]>(error, 'Could not load users.'))
      );
  }

  openDirectConversation(userId: string): Observable<ChatConversation | null> {
    return this.http
      .post<unknown>(this.url('Messaging/conversations/direct'), { userId }, this.options())
      .pipe(
        map(response => this.normalizeConversation(this.unwrapPayload(response))),
        catchError(error =>
          this.handleError<ChatConversation>(error, 'Could not open this conversation.')
        )
      );
  }

  sendMessage(
    conversationId: string,
    body: string,
    clientId: string
  ): Observable<ChatMessage | null> {
    return this.http
      .post<unknown>(
        this.url(`Messaging/conversations/${encodeURIComponent(conversationId)}/messages`),
        { body, clientId },
        this.options()
      )
      .pipe(
        map(response => this.normalizeMessage(this.unwrapPayload(response), conversationId)),
        catchError(error => this.handleError<ChatMessage>(error, 'Could not send this message.'))
      );
  }

  editMessage(messageId: string, body: string): Observable<ChatMessage | null> {
    return this.http
      .put<unknown>(
        this.url(`Messaging/messages/${encodeURIComponent(messageId)}`),
        { body },
        this.options()
      )
      .pipe(
        map(response => this.normalizeMessage(this.unwrapPayload(response), '')),
        catchError(error => this.handleError<ChatMessage>(error, 'Could not edit this message.'))
      );
  }

  deleteMessage(messageId: string): Observable<boolean> {
    return this.http
      .delete<unknown>(this.url(`Messaging/messages/${encodeURIComponent(messageId)}`), this.options())
      .pipe(
        map(() => true),
        catchError(error => {
          this.lastError.set(this.describeHttpError(error, 'Could not delete this message.'));
          return of(false);
        })
      );
  }

  markRead(conversationId: string): Observable<boolean> {
    return this.http
      .post<unknown>(
        this.url(`Messaging/conversations/${encodeURIComponent(conversationId)}/read`),
        {},
        this.options()
      )
      .pipe(
        map(() => true),
        catchError(error => {
          this.lastError.set(this.describeHttpError(error, 'Could not mark conversation as read.'));
          return of(false);
        })
      );
  }

  setMuted(conversationId: string, muted: boolean): Observable<ChatConversation | null> {
    return this.http
      .patch<unknown>(
        this.url(`Messaging/conversations/${encodeURIComponent(conversationId)}/mute`),
        { muted },
        this.options()
      )
      .pipe(
        map(response => this.normalizeConversation(this.unwrapPayload(response))),
        catchError(error =>
          this.handleError<ChatConversation>(error, 'Could not update conversation settings.')
        )
      );
  }

  sendTyping(conversationId: string): Observable<boolean> {
    return this.http
      .post<unknown>(
        this.url(`Messaging/conversations/${encodeURIComponent(conversationId)}/typing`),
        {},
        this.options()
      )
      .pipe(
        map(() => true),
        catchError(() => of(false))
      );
  }

  listTyping(conversationId: string): Observable<ChatTypingState[] | null> {
    return this.http
      .get<unknown>(
        this.url(`Messaging/conversations/${encodeURIComponent(conversationId)}/typing`),
        this.options()
      )
      .pipe(
        map(response =>
          this.unwrapArray(response).map(item => ({
            conversationId: this.asString(item['conversationId']) || conversationId,
            userId: this.asString(item['userId']),
            userName: this.asString(item['userName']) || 'Someone',
            expiresAt: Date.parse(this.asString(item['expiresAt'])) || Date.now() + 2500
          }))
        ),
        catchError(error => this.handleError<ChatTypingState[]>(error, 'Could not load typing.'))
      );
  }

  private url(path: string): string {
    const runtime = runtimeConfig();
    const apiBase = (runtime.apiBaseUrl ?? environment.API_BASE_URL ?? '').replace(/\/+$/, '');
    return normalizeApiUrl(apiBase, path);
  }

  private options(): { withCredentials: boolean } {
    return { withCredentials: this.authRuntime.withCredentials };
  }

  private handleError<T>(error: unknown, fallback: string): Observable<T | null> {
    this.lastError.set(this.describeHttpError(error, fallback));
    return of(null);
  }

  private describeHttpError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    const status = error.status ? `HTTP ${error.status}` : 'Network error';
    const payload = this.asRecord(error.error);
    const apiMessage =
      this.asString(payload?.['message']) ||
      this.asString(payload?.['title']) ||
      this.asString(payload?.['detail']) ||
      this.asString(error.error);
    return apiMessage ? `${fallback} ${status}: ${apiMessage}` : `${fallback} ${status}.`;
  }

  private unwrapArray(response: unknown): LooseRecord[] {
    return this.asArray(this.unwrapPayload(response));
  }

  private unwrapPayload(response: unknown): unknown {
    let current = response;
    for (let i = 0; i < 4; i += 1) {
      const record = this.asRecord(current);
      if (!record) {
        break;
      }
      const next = record['data'] ?? record['payload'] ?? record['result'];
      if (!next || next === current) {
        break;
      }
      current = next;
    }
    return current;
  }

  private normalizeConversation(raw: unknown): ChatConversation {
    const record = this.asRecord(raw) ?? {};
    const id = this.asString(record['id']) || this.createId('conversation');
    const participants = this.asArray(record['participants'] ?? record['users']).map(item =>
      this.normalizeUser(item)
    );
    const lastMessageRaw = record['lastMessage'] ?? record['latestMessage'];
    const lastMessage = lastMessageRaw ? this.normalizeMessage(lastMessageRaw, id) : null;
    const title =
      this.asString(record['title']) ||
      this.asString(record['name']) ||
      participants
        .map(user => user.name)
        .filter(Boolean)
        .join(', ') ||
      'Conversation';

    return {
      id,
      kind:
        this.asString(record['type']) === 'group' || this.asString(record['kind']) === 'group'
          ? 'group'
          : 'direct',
      title,
      participants,
      lastMessage,
      unreadCount: this.asNumber(record['unreadCount'] ?? record['unread']) ?? 0,
      updatedAt:
        this.asString(record['updatedAt'] ?? record['lastActivityAt'] ?? record['createdAt']) ||
        new Date().toISOString(),
      muted: record['muted'] === true,
      pinned: record['pinned'] === true
    };
  }

  private normalizeMessage(raw: unknown, fallbackConversationId: string): ChatMessage {
    const record = this.asRecord(raw) ?? {};
    const readBy = this.asArray(record['readBy'])
      .map(item => this.asString(item))
      .filter(Boolean);
    const deliveredBy = this.asArray(record['deliveredBy'])
      .map(item => this.asString(item))
      .filter(Boolean);
    return {
      id: this.asString(record['id']) || this.asString(record['clientId']) || this.createId('msg'),
      clientId: this.asString(record['clientId']),
      conversationId: this.asString(record['conversationId']) || fallbackConversationId,
      senderId: this.asString(record['senderId'] ?? record['userId'] ?? record['fromUserId']),
      body: this.asString(record['body'] ?? record['message'] ?? record['text']),
      createdAt: this.asString(record['createdAt'] ?? record['sentAt']) || new Date().toISOString(),
      editedAt: this.asString(record['editedAt']),
      deletedAt: this.asString(record['deletedAt']),
      readBy,
      deliveredBy: deliveredBy.length ? deliveredBy : readBy
    };
  }

  private normalizeUser(raw: unknown): ChatUser {
    const record = this.asRecord(raw) ?? {};
    const email = this.asString(record['email'] ?? record['mail']);
    const name =
      this.asString(record['name'] ?? record['fullName'] ?? record['displayName']) ||
      (email ? email.split('@')[0] : 'User');
    return {
      id: this.asString(record['id'] ?? record['userId']) || email || this.createId('user'),
      name,
      email,
      avatarUrl: this.asString(record['avatarUrl'] ?? record['photoUrl']),
      role: this.asString(record['role'] ?? record['jobTitle']),
      online: record['online'] === true,
      lastSeenAt: this.asString(record['lastSeenAt'])
    };
  }

  private asRecord(value: unknown): LooseRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as LooseRecord)
      : null;
  }

  private asArray(value: unknown): LooseRecord[] {
    return Array.isArray(value) ? (value.filter(item => this.asRecord(item)) as LooseRecord[]) : [];
  }

  private asString(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  }

  private asNumber(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
