import type { ChatParticipant as BaseParticipant } from "@/shared/types/chat"

export interface ChatParticipant extends BaseParticipant {}

export interface ChatAttachment {
  id: string
  name: string
  url: string
  type: 'image' | 'video' | 'file'
  size: number
  mimeType: string
}

export interface ChatMessage {
  id: string
  thread_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at?: string
  message_type?: string
  metadata?: Record<string, unknown>
  read_by: string[]
  is_deleted?: boolean
  attachments?: ChatAttachment[]
  sender?: ChatParticipant
}

export interface ChatThread {
  id: string
  name: string
  type: 'direct' | 'group'
  participants: ChatParticipant[]
  last_message_preview: string | null
  last_message_at: string
  unread_count: number
}

export interface CreateThreadOptions {
  participant_ids: string[]
  participants?: ChatParticipant[]
  type?: 'direct' | 'group'
  title?: string | null
}

export interface SendMessageOptions {
  content: string
  attachments?: ChatAttachment[]
  metadata?: Record<string, unknown>
  message_type?: string
}

type ThreadSubscriber = (thread: ChatThread) => void
type MessageSubscriber = (message: ChatMessage) => void

const STORAGE_KEY = 'connectafrik.messaging.v1'

interface StoredThread {
  id: string
  type: 'direct' | 'group'
  title?: string | null
  participantIds: string[]
  createdAt: string
  updatedAt: string
}

interface StoredMessage {
  id: string
  threadId: string
  senderId: string
  content: string
  createdAt: string
  updatedAt?: string
  messageType?: string
  metadata?: Record<string, unknown>
  readBy: string[]
  isDeleted?: boolean
  attachments?: ChatAttachment[]
}

interface StoredState {
  threads: StoredThread[]
  messages: Record<string, StoredMessage[]>
  profiles: Record<string, ChatParticipant>
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const nowIso = () => new Date().toISOString()

let loaded = false
let memoryState: StoredState = {
  threads: [],
  messages: {},
  profiles: {},
}

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const loadState = (): StoredState => {
  if (!isBrowser) {
    return { ...memoryState, messages: { ...memoryState.messages } }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { ...memoryState, messages: { ...memoryState.messages } }
    }
    const parsed = JSON.parse(raw) as StoredState
    if (!parsed.messages) parsed.messages = {}
    if (!parsed.profiles) parsed.profiles = {}
    if (!parsed.threads) parsed.threads = []
    return parsed
  } catch {
    return { threads: [], messages: {}, profiles: {} }
  }
}

const persistState = (state: StoredState) => {
  memoryState = state
  if (isBrowser) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore storage errors
    }
  }
}

const getState = (): StoredState => {
  if (!loaded) {
    memoryState = loadState()
    loaded = true
  }
  return memoryState
}

const upsertProfile = (profile: ChatParticipant | undefined) => {
  if (!profile) return
  if (!profile.id) return
  const state = getState()
  state.profiles[profile.id] = {
    id: profile.id,
    name: profile.name || 'Unknown',
    avatarUrl: profile.avatarUrl,
  }
  persistState(state)
}

const ensureProfiles = (participants: ChatParticipant[]) => {
  if (!participants.length) return
  const state = getState()
  let updated = false
  participants.forEach((participant) => {
    if (!participant.id) return
    const existing = state.profiles[participant.id]
    if (!existing || existing.name !== participant.name || existing.avatarUrl !== participant.avatarUrl) {
      state.profiles[participant.id] = {
        id: participant.id,
        name: participant.name || existing?.name || 'Unknown',
        avatarUrl: participant.avatarUrl ?? existing?.avatarUrl,
      }
      updated = true
    }
  })
  if (updated) {
    persistState(state)
  }
}

const buildMessage = (message: StoredMessage, state: StoredState): ChatMessage => {
  const sender = state.profiles[message.senderId]
  return {
    id: message.id,
    thread_id: message.threadId,
    sender_id: message.senderId,
    content: message.isDeleted ? '' : message.content,
    created_at: message.createdAt,
    updated_at: message.updatedAt,
    message_type: message.messageType,
    metadata: message.metadata,
    read_by: message.readBy,
    is_deleted: message.isDeleted,
    attachments: message.attachments,
    sender,
  }
}

const deriveThreadName = (thread: StoredThread, state: StoredState, userId: string): string => {
  if (thread.title) {
    return thread.title
  }
  const otherParticipants = thread.participantIds.filter((id) => id !== userId).map((id) => state.profiles[id])
  if (thread.type === 'direct' && otherParticipants.length === 1) {
    return otherParticipants[0]?.name || 'Direct chat'
  }
  if (otherParticipants.length) {
    return otherParticipants.map((p) => p?.name || 'Member').join(', ')
  }
  return 'Conversation'
}

const buildThreadForUser = (thread: StoredThread, userId: string, state: StoredState): ChatThread => {
  const messages = state.messages[thread.id] ?? []
  const sortedMessages = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const lastMessage = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1] : null
  const unreadCount = messages.reduce((count, message) => {
    if (message.senderId === userId) return count
    if (message.readBy?.includes(userId)) return count
    return count + 1
  }, 0)
  const participants = thread.participantIds
    .map((id) => state.profiles[id])
    .filter((participant): participant is ChatParticipant => Boolean(participant))
  return {
    id: thread.id,
    name: deriveThreadName(thread, state, userId),
    type: thread.type,
    participants,
    last_message_preview: lastMessage ? (lastMessage.isDeleted ? 'Message removed' : lastMessage.content) : null,
    last_message_at: lastMessage?.createdAt ?? thread.updatedAt,
    unread_count: unreadCount,
  }
}

const threadSubscribers = new Map<string, Set<ThreadSubscriber>>()
const messageSubscribers = new Map<string, Set<MessageSubscriber>>()

const notifyThreadSubscribers = (threadId: string) => {
  const state = getState()
  const thread = state.threads.find((item) => item.id === threadId)
  if (!thread) return
  threadSubscribers.forEach((callbacks, userId) => {
    if (!thread.participantIds.includes(userId)) return
    const payload = buildThreadForUser(thread, userId, state)
    callbacks.forEach((callback) => callback(payload))
  })
}

const notifyMessageSubscribers = (threadId: string, message: StoredMessage) => {
  const state = getState()
  const payload = buildMessage(message, state)
  const callbacks = messageSubscribers.get(threadId)
  if (!callbacks) return
  callbacks.forEach((callback) => callback(payload))
}

const ensureSeedThread = (currentUser: ChatParticipant) => {
  const state = getState()
  const alreadyHasThread = state.threads.some((thread) => thread.participantIds.includes(currentUser.id))
  if (alreadyHasThread) {
    return
  }
  // No longer creating a hardcoded contact - users can start their own conversations
}

export const messagingService = {
  async getUserThreads(currentUser?: ChatParticipant | null): Promise<ChatThread[]> {
    if (!currentUser) {
      return []
    }
    ensureProfiles([currentUser])
    ensureSeedThread(currentUser)

    const state = getState()
    const threads = state.threads
      .filter((thread) => thread.participantIds.includes(currentUser.id))
      .map((thread) => buildThreadForUser(thread, currentUser.id, state))
    return threads.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
  },

  async getThreadMessages(threadId: string): Promise<ChatMessage[]> {
    const state = getState()
    const messages = state.messages[threadId] ?? []
    return [...messages]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((message) => buildMessage(message, state))
  },

  async createThread(currentUser: ChatParticipant, options: CreateThreadOptions): Promise<string> {
    ensureProfiles([currentUser])
    const state = getState()
    ensureProfiles(options.participants ?? [])
    const participantIds = Array.from(new Set([currentUser.id, ...options.participant_ids]))
    const createdAt = nowIso()
    const threadId = createId()
    const thread: StoredThread = {
      id: threadId,
      type: options.type ?? (participantIds.length > 2 ? 'group' : 'direct'),
      title: options.title,
      participantIds,
      createdAt,
      updatedAt: createdAt,
    }
    state.threads.push(thread)
    if (!state.messages[threadId]) {
      state.messages[threadId] = []
    }
    persistState(state)
    notifyThreadSubscribers(threadId)
    return threadId
  },

  async sendMessage(threadId: string, payload: SendMessageOptions, currentUser: ChatParticipant): Promise<ChatMessage> {
    ensureProfiles([currentUser])
    const state = getState()
    if (!state.messages[threadId]) {
      state.messages[threadId] = []
    }
    const now = nowIso()
    const storedMessage: StoredMessage = {
      id: createId(),
      threadId,
      senderId: currentUser.id,
      content: payload.content,
      createdAt: now,
      updatedAt: now,
      messageType: payload.message_type ?? 'text',
      metadata: payload.metadata,
      attachments: payload.attachments,
      readBy: [currentUser.id],
    }
    state.messages[threadId].push(storedMessage)

    const thread = state.threads.find((item) => item.id === threadId)
    if (thread) {
      thread.updatedAt = now
    }
    persistState(state)
    notifyThreadSubscribers(threadId)
    notifyMessageSubscribers(threadId, storedMessage)
    return buildMessage(storedMessage, state)
  },

  async markMessagesAsRead(threadId: string, messageIds: string[], userId: string): Promise<void> {
    if (!userId) return
    const state = getState()
    const messages = state.messages[threadId]
    if (!messages || !messages.length) return

    let changed = false
    messages.forEach((message) => {
      if (!messageIds.includes(message.id)) return
      if (!message.readBy.includes(userId)) {
        message.readBy.push(userId)
        changed = true
      }
    })
    if (changed) {
      persistState(state)
      notifyThreadSubscribers(threadId)
    }
  },

  async deleteMessage(messageId: string): Promise<void> {
    const state = getState()
    let affectedThreadId: string | null = null
    Object.entries(state.messages).forEach(([threadId, messages]) => {
      messages.forEach((message) => {
        if (message.id === messageId) {
          message.isDeleted = true
          affectedThreadId = threadId
        }
      })
    })
    persistState(state)
    if (affectedThreadId) {
      notifyThreadSubscribers(affectedThreadId)
    }
  },

  async searchMessages(query: string, userId: string, threadId?: string): Promise<ChatMessage[]> {
    const state = getState()
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    const threadIds = threadId
      ? [threadId]
      : state.threads
          .filter((thread) => thread.participantIds.includes(userId))
          .map((thread) => thread.id)
    const results: ChatMessage[] = []
    threadIds.forEach((id) => {
      const messages = state.messages[id] ?? []
      messages.forEach((message) => {
        if (message.isDeleted) return
        if (message.content.toLowerCase().includes(normalized)) {
          results.push(buildMessage(message, state))
        }
      })
    })
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  subscribeToUserThreads(currentUser: ChatParticipant, callback: ThreadSubscriber): () => void {
    ensureProfiles([currentUser])
    const existing = threadSubscribers.get(currentUser.id)
    const callbacks = existing ?? new Set<ThreadSubscriber>()
    callbacks.add(callback)
    threadSubscribers.set(currentUser.id, callbacks)

    return () => {
      const subs = threadSubscribers.get(currentUser.id)
      if (!subs) return
      subs.delete(callback)
      if (subs.size === 0) {
        threadSubscribers.delete(currentUser.id)
      }
    }
  },

  subscribeToThread(threadId: string, callback: MessageSubscriber): () => void {
    const existing = messageSubscribers.get(threadId)
    const callbacks = existing ?? new Set<MessageSubscriber>()
    callbacks.add(callback)
    messageSubscribers.set(threadId, callbacks)
    return () => {
      const subs = messageSubscribers.get(threadId)
      if (!subs) return
      subs.delete(callback)
      if (subs.size === 0) {
        messageSubscribers.delete(threadId)
      }
    }
  },

  cleanup(): void {
    threadSubscribers.clear()
    messageSubscribers.clear()
  },
}

