export type CallType = 'audio' | 'video'

export type PresenceStatus = 'online' | 'offline' | 'away' | 'busy'

export interface ChatParticipant {
  id: string
  name: string
  avatarUrl?: string
}

export interface ChatMessageMetadata {
  postId?: string
  postUrl?: string
  previewText?: string
  attachments?: Array<{ id: string; type: 'image' | 'video' | 'file'; url: string }>
}

export interface ChatMessage {
  id: string
  threadId: string
  senderId: string
  senderName: string
  content: string
  createdAt: string
  type: 'text' | 'system' | 'post-share'
  status: 'sending' | 'sent' | 'delivered' | 'read'
  metadata?: ChatMessageMetadata
}

export interface ChatThread {
  id: string
  key: string
  name: string
  participantIds: string[]
  participants: ChatParticipant[]
  isGroup: boolean
  lastMessagePreview?: string
  lastActivityAt: string
  unreadCount: number
  typingMemberIds?: string[]
  pinned?: boolean
}

export interface CallSession {
  id: string
  threadId: string
  type: CallType
  status: 'ringing' | 'active' | 'ended'
  startedAt: string
  createdBy: string
  participants: string[]
  endedAt?: string
}

export interface SharePayload {
  postId: string
  postUrl?: string
  message?: string
}

export interface StartChatOptions {
  initialMessage?: string
  sharePayload?: SharePayload
  openInDock?: boolean
}

