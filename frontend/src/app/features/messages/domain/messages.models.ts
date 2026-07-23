export type ChatConversationKind = 'direct' | 'group';
export type ChatDeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
  online?: boolean;
  lastSeenAt?: string;
}

export interface ChatMessage {
  id: string;
  clientId?: string | null;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  readBy: string[];
  deliveredBy?: string[];
  deliveryState?: ChatDeliveryState;
}

export interface ChatConversation {
  id: string;
  kind: ChatConversationKind;
  title: string;
  participants: ChatUser[];
  lastMessage?: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
  muted?: boolean;
  pinned?: boolean;
  pending?: boolean;
  pendingUserId?: string;
}

export interface ChatTypingState {
  conversationId: string;
  userId: string;
  userName: string;
  expiresAt: number;
}

export interface ChatThreadSnapshot {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  directory: ChatUser[];
  loading: boolean;
  sending: boolean;
  error: string | null;
}

export interface ChatPagedMessages {
  items: ChatMessage[];
  nextCursor?: string | null;
}
