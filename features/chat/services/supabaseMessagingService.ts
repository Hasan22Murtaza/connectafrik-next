import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import type { ChatParticipant as BaseParticipant } from "@/shared/types/chat"
import { notificationService } from '@/shared/services/notificationService'
import {
  callSessionInsertToChatMessage,
  callSessionUpdateToChatMessage,
} from '@/features/chat/services/callSessionRealtime'
import { GROUP_MEMBER_JOINED, GROUP_MEMBER_LEFT } from '@/lib/groupChatSystemMessages'

/** call_sessions.status-aligned message_type values (signaling; excluded from generic chat push). */
const ALL_CALL_SIGNAL_MESSAGE_TYPES: string[] = [
  'initiated', 'ringing', 'active', 'declined', 'ended', 'missed', 'failed',
]

const SKIP_GENERIC_CHAT_PUSH_MESSAGE_TYPES = new Set<string>([
  ...ALL_CALL_SIGNAL_MESSAGE_TYPES,
  GROUP_MEMBER_JOINED,
  GROUP_MEMBER_LEFT,
])

export interface ChatParticipant extends BaseParticipant {}

export interface ChatAttachment {
  id: string
  name: string
  url: string
  type: 'image' | 'video' | 'file'
  size: number
  mimeType: string
}

export interface MessageReactionSummary {
  emoji: string
  count: number
  user_reacted: boolean
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
  deleted_for?: string[] // Array of user IDs who deleted this message for themselves
  deleted_at?: string
  attachments?: ChatAttachment[]
  sender?: ChatParticipant
  reply_to_id?: string
  reactions?: MessageReactionSummary[]
}

export interface ChatThread {
  id: string
  name: string
  type: 'direct' | 'group'
  participants: ChatParticipant[]
  last_message_preview: string | null
  last_message_at: string
  unread_count: number
  /** From current user's `chat_participants.archived` */
  archived?: boolean
  /** From current user's `chat_participants.pinned` */
  pinned?: boolean
  pinned_at?: string | null
  created_at: string
  updated_at: string
  /** Set when this thread is the canonical chat for a group */
  group_id?: string | null
  /** Group thread: image URL from linked `groups.banner_url` when present */
  banner_url?: string | null
}

export interface CreateThreadOptions {
  participant_ids: string[]
  participants?: ChatParticipant[]
  type?: 'direct' | 'group'
  title?: string | null
  name?: string
  group_id?: string
  metadata?: Record<string, unknown>
  openInDock?: boolean
}

export interface SendMessageOptions {
  content: string
  attachments?: ChatAttachment[]
  metadata?: Record<string, unknown>
  message_type?: string
  reply_to_id?: string
}

export interface RecentCallEntry {
  thread_id: string
  created_at: string
  message_type: string
  call_type: 'audio' | 'video'
  metadata?: Record<string, unknown>
  thread_name?: string | null
  thread_type?: string | null
  contact_id?: string | null
  contact_name?: string | null
  contact_avatar_url?: string | null
  banner_url?: string | null
}

type ThreadSubscriber = (thread: ChatThread) => void
type MessageSubscriber = (message: ChatMessage) => void
type CallSignalSubscriber = (message: ChatMessage) => void

// Subscribers for real-time updates
const threadSubscribers = new Map<string, Set<ThreadSubscriber>>()
const messageSubscribers = new Map<string, Set<MessageSubscriber>>()
const threadMessageChannels = new Map<string, any>()
/** Block postgres_changes delivery for threads the user left (e.g. group chat after leave). */
const deniedRealtimeThreadIds = new Set<string>()

// Real-time subscriptions
let threadsSubscription: any = null
let messagesSubscription: any = null

const notifyThreadSubscribers = (thread: ChatThread) => {
  threadSubscribers.forEach((callbacks, userId) => {
    if (thread.participants.some(p => p.id === userId)) {
      callbacks.forEach((callback) => callback(thread))
    }
  })
}

const notifyMessageSubscribers = async (message: ChatMessage, options?: { skipPush?: boolean }) => {
  const callbacks = messageSubscribers.get(message.thread_id)
  if (callbacks) {
    callbacks.forEach((callback) => callback(message))
  }

  // Send push notification for new messages (excluding call signaling). Skip when skipPush is true
  // (e.g. from the realtime handler) so we only send push once from the sendMessage path.
  if (!options?.skipPush && !SKIP_GENERIC_CHAT_PUSH_MESSAGE_TYPES.has(message.message_type || '')) {
    try {
      const res = await apiClient.get<{ data: { user_id: string }[] }>(
        `/api/chat/threads/${message.thread_id}/participants`,
        { exclude_user_id: message.sender_id }
      )
      const participants = res?.data ?? []

      if (participants.length > 0) {
        // Deduplicate participant user_ids to avoid sending multiple notifications to the same user
        const uniqueUserIds = [...new Set(participants.map(p => p.user_id))]

        // Get sender name from message or fetch from profile
        const senderName = message.sender?.name || 
                          (message as any).sender?.full_name || 
                          (message as any).sender?.username || 
                          (message as any).sender_name || 
                          'Someone'
        
        // Prepare message preview
        const messagePreview = message.content || 
                              (message.attachments && message.attachments.length > 0 
                                ? 'Shared an attachment' 
                                : 'Sent a message')

        // Send ONE push notification per unique participant (saves 1 DB record + pushes to all their devices)
        for (const userId of uniqueUserIds) {
          console.log('Sending push notification to participant:', userId)
          try {
            await notificationService.sendNotification({
              user_id: userId,
              title: senderName,
              body: messagePreview,
              notification_type: 'chat_message',
              message_id: message.id,
              data: {
                thread_id: message.thread_id,
                sender_id: message.sender_id,
                sender_name: senderName,
              },
            })
          } catch (notificationError) {
            // Don't fail the message if notification fails
          }
        }
      }
    } catch (error) {
      // Don't fail the message if notification fails
    }
  }
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const nowIso = () => new Date().toISOString()

const toPushDataRecord = (data: Record<string, unknown>): Record<string, string> => {
  const entries = Object.entries(data).flatMap(([key, value]) => {
    if (value === undefined || value === null) return []
    if (typeof value === 'string') return [[key, value] as [string, string]]
    if (typeof value === 'number' || typeof value === 'boolean') return [[key, String(value)] as [string, string]]
    try {
      return [[key, JSON.stringify(value)] as [string, string]]
    } catch {
      return [[key, String(value)] as [string, string]]
    }
  })
  return Object.fromEntries(entries)
}

const computeThreadKey = (participantIds: string[]) =>
  Array.from(new Set(participantIds)).sort().join(':')

let fallbackEnabled = false

const localThreads = new Map<string, ChatThread>()
const localMessages = new Map<string, ChatMessage[]>()
const localThreadKeys = new Map<string, string>()
const canDeletePermissionCache = new Map<string, boolean>()
const canDeletePermissionInFlight = new Map<string, Promise<boolean>>()

const activateFallback = (reason: unknown) => {
  if (!fallbackEnabled) {
    console.warn('Supabase messaging service fallback activated', reason)
  }
  fallbackEnabled = true
}

const getLocalThreadsForUser = (userId: string): ChatThread[] => {
  return Array.from(localThreads.values()).filter((thread) =>
    thread.participants.some((participant) => participant.id === userId)
  )
}

const ensurePlaceholderParticipant = (participantId: string): ChatParticipant => ({
  id: participantId,
  name: 'ConnectAfrik Member',
})

const isPolicyRecursionError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as { code?: string; message?: string }
  if (code === '42P17') return true
  return typeof message === 'string' && message.toLowerCase().includes('infinite recursion')
}

const getCanDeletePermissionKey = (messageId: string, userId: string) =>
  `${messageId}:${userId}`

const createLocalThread = (currentUser: ChatParticipant, options: CreateThreadOptions): ChatThread => {
  const participantMap = new Map<string, ChatParticipant>()

  options.participants?.forEach((participant) => {
    participantMap.set(participant.id, participant)
  })

  options.participant_ids?.forEach((id) => {
    if (!participantMap.has(id)) {
      participantMap.set(id, ensurePlaceholderParticipant(id))
    }
  })

  participantMap.set(currentUser.id, currentUser)

  const participants = Array.from(participantMap.values())
  const participantIds = participants.map((participant) => participant.id)
  const key = computeThreadKey(participantIds)

  const existingId = localThreadKeys.get(key)
  if (existingId) {
    const existingThread = localThreads.get(existingId)
    if (existingThread) {
      return existingThread
    }
  }

  const otherParticipants = participants.filter((participant) => participant.id !== currentUser.id)
  const isGroup = options.type ? options.type === 'group' : otherParticipants.length > 1
  const primaryNames = otherParticipants
    .slice(0, 3)
    .map((participant) => participant.name || 'Member')
    .join(', ')
  const groupNameBase = primaryNames || 'Group Chat'
  const extraLabel = otherParticipants.length > 3 ? ' +' + (otherParticipants.length - 3) : ''
  const placeholderName =
    options.title ??
    (isGroup
      ? groupNameBase + extraLabel
      : otherParticipants[0]?.name || currentUser.name || 'Direct Chat')

  const timestamp = nowIso()

  const thread: ChatThread = {
    id: createId(),
    name: placeholderName,
    type: isGroup ? 'group' : 'direct',
    participants,
    last_message_preview: null,
    last_message_at: timestamp,
    unread_count: 0,
    archived: false,
    pinned: false,
    pinned_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  localThreads.set(thread.id, thread)
  localThreadKeys.set(key, thread.id)

  if (!localMessages.has(thread.id)) {
    localMessages.set(thread.id, [])
  }

  notifyThreadSubscribers(thread)
  return thread
}

const createLocalMessage = (
  threadId: string,
  payload: SendMessageOptions,
  currentUser: ChatParticipant
): ChatMessage => {
  const timestamp = nowIso()
  const content = payload.content ?? ''
  const hasAttachments = Boolean(payload.attachments && payload.attachments.length > 0)

  const message: ChatMessage = {
    id: createId(),
    thread_id: threadId,
    sender_id: currentUser.id,
    content,
    created_at: timestamp,
    updated_at: timestamp,
    message_type: payload.message_type ?? 'text',
    metadata: payload.metadata,
    read_by: [currentUser.id],
    is_deleted: false,
    attachments: payload.attachments,
    sender: currentUser,
  }

  const existingMessages = localMessages.get(threadId) ?? []
  localMessages.set(threadId, [...existingMessages, message])

  const thread = localThreads.get(threadId)
  if (thread) {
    const preview =
      content.trim().length > 0
        ? content
        : hasAttachments
        ? 'Shared an attachment'
        : thread.last_message_preview

    const updatedThread: ChatThread = {
      ...thread,
      last_message_preview: preview,
      last_message_at: timestamp,
      updated_at: timestamp,
      unread_count: 0,
    }

    localThreads.set(threadId, updatedThread)
    notifyThreadSubscribers(updatedThread)
  }

  notifyMessageSubscribers(message, { skipPush: true })
  return message
}

const markLocalMessagesAsRead = (threadId: string, userId: string) => {
  const messages = localMessages.get(threadId)
  if (!messages) return

  const nextMessages = messages.map((message) => {
    if (message.read_by.includes(userId)) {
      return message
    }
    return { ...message, read_by: [...message.read_by, userId] }
  })

  localMessages.set(threadId, nextMessages)

  const thread = localThreads.get(threadId)
  if (thread) {
    const updatedThread: ChatThread = { ...thread, unread_count: 0 }
    localThreads.set(threadId, updatedThread)
    notifyThreadSubscribers(updatedThread)
  }
}

const deleteLocalMessage = (messageId: string) => {
  localMessages.forEach((messages, threadId) => {
    const next = messages.map((message) =>
      message.id === messageId ? { ...message, is_deleted: true, content: '' } : message
    )
    localMessages.set(threadId, next)
  })
}

const findLocalMessageById = (messageId: string): ChatMessage | undefined => {
  for (const messages of localMessages.values()) {
    const found = messages.find((m) => m.id === messageId)
    if (found) return found
  }
  return undefined
}

// Initialize real-time subscriptions
const initializeSubscriptions = async (currentUser: ChatParticipant) => {
  if (!currentUser) return

  // Subscribe to thread updates
  threadsSubscription = supabase
    .channel('chat_threads')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_threads',
      },
      async (payload) => {
        const threadId = (payload.new as any)?.id
        if (!threadId) return
        try {
          const res = await apiClient.get<{ data: any }>(`/api/chat/threads/${threadId}`)
          const thread = (res as any)?.data
          if (thread) {
            const formattedThread = await formatThread(thread, currentUser.id)
            if (!formattedThread.participants.some((participant) => participant.id === currentUser.id)) {
              return
            }
            notifyThreadSubscribers(formattedThread)
          }
        } catch {
          // Thread may be inaccessible; ignore
        }
      }
    )
    .subscribe()

  // Message realtime is managed by per-thread channels in subscribeToThread.
  messagesSubscription = null
}

// Cleanup subscriptions
const cleanupSubscriptions = () => {
  if (threadsSubscription) {
    supabase.removeChannel(threadsSubscription)
    threadsSubscription = null
  }
  if (messagesSubscription) {
    supabase.removeChannel(messagesSubscription)
    messagesSubscription = null
  }
  threadMessageChannels.forEach((channel) => {
    try { supabase.removeChannel(channel) } catch {}
  })
  threadMessageChannels.clear()
  deniedRealtimeThreadIds.clear()
}

// Format thread data from Supabase
const formatThread = async (thread: any, currentUserId: string): Promise<ChatThread> => {
  const rawParticipants = Array.isArray(thread.chat_participants)
    ? thread.chat_participants
    : Array.isArray(thread.participants)
    ? thread.participants
    : []

  const participants = rawParticipants
    .map((cp: any) => {
      const user = cp.user ?? cp.profile ?? {}
      const id = cp.user_id ?? cp.id ?? user.id
      if (!id) return null

      const name =
        cp.name ??
        user.full_name ??
        user.username ??
        cp.user_name ??
        cp.display_name ??
        'Unknown'

      const avatarCandidate = cp.avatarUrl ?? cp.avatar_url ?? user.avatar_url ?? null

      return {
        id,
        name,
        avatarUrl: avatarCandidate ?? undefined,
      }
    })
    .filter((participant: any): participant is ChatParticipant => Boolean(participant))

  const otherParticipants = participants.filter((participant: any) => participant.id !== currentUserId)
  const otherNames = otherParticipants
    .map((participant: any) => participant.name)
    .filter((name: any): name is string => Boolean(name))

  const resolvedType: 'direct' | 'group' =
    thread.type === 'group' || Boolean(thread.group_id)
      ? 'group'
      : thread.type || (participants.length > 2 ? 'group' : 'direct')

  const directFallbackName =
    otherNames[0] ||
    thread.title ||
    thread.name ||
    'Direct Chat'

  const groupFallbackName =
    thread.title ||
    thread.name ||
    (otherNames.length > 0 ? otherNames.join(', ') : 'Group Chat')

  const displayName = resolvedType === 'direct' ? directFallbackName : groupFallbackName

  const lastMessageAt =
    thread.last_message_at ||
    thread.last_activity_at ||
    thread.updated_at ||
    thread.created_at ||
    new Date().toISOString()

  // Get unread count for current user using a subquery approach
  let unreadCount: number
  if (typeof thread.unread_count === 'number' && Number.isFinite(thread.unread_count)) {
    unreadCount = thread.unread_count
  } else {
    const { data: unreadMessages } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('thread_id', thread.id)
      .neq('sender_id', currentUserId)

    unreadCount = 0
    if (unreadMessages && unreadMessages.length > 0) {
      const messageIds = unreadMessages.map(m => m.id)
      const { data: readMessages } = await supabase
        .from('message_reads')
        .select('message_id')
        .in('message_id', messageIds)
        .eq('user_id', currentUserId)

      const readMessageIds = new Set((readMessages || []).map(r => r.message_id))
      unreadCount = messageIds.filter(id => !readMessageIds.has(id)).length
    }
  }

  const bannerFromEmbed =
    thread.group_banner && typeof thread.group_banner === 'object'
      ? thread.group_banner.banner_url
      : null

  return {
    id: thread.id,
    name: displayName,
    type: resolvedType,
    participants,
    last_message_preview: thread.last_message_preview,
    last_message_at: lastMessageAt,
    unread_count: unreadCount || 0,
    archived: typeof thread.archived === 'boolean' ? thread.archived : false,
    pinned: typeof thread.pinned === 'boolean' ? thread.pinned : false,
    pinned_at: typeof thread.pinned_at === 'string' ? thread.pinned_at : null,
    created_at: thread.created_at,
    updated_at: thread.updated_at || lastMessageAt,
    group_id: thread.group_id ?? null,
    banner_url: thread.banner_url ?? bannerFromEmbed ?? null,
  }
}

/** Intermediate shape from `get_user_threads` RPC before `formatThread`. */
type RpcThreadBootstrap = {
  id: string
  name: string
  title: string
  type: unknown
  archived: boolean
  last_message_preview: unknown
  last_message_at: string
  last_activity_at: string
  created_at: string
  updated_at: string
  unread_count: number
  pinned: boolean
  pinned_at: string | null
  participants: unknown[]
}

const loadThreadsViaRpc = async (
  currentUserId: string,
  sortThreads: (threads: ChatThread[]) => ChatThread[]
): Promise<ChatThread[]> => {
  try {
    const { data, error } = await supabase.rpc('get_user_threads', { user_uuid: currentUserId })

    if (error) {
      console.error('Error loading threads via RPC:', error)
      activateFallback(error)
      return sortThreads(getLocalThreadsForUser(currentUserId))
    }

    const rpcThreads: RpcThreadBootstrap[] = (data ?? []).map((thread: any): RpcThreadBootstrap => {
      const lastTimestamp = thread.last_message_at ?? new Date().toISOString()

      return {
        id: thread.thread_id,
        name: thread.thread_name,
        title: thread.thread_name,
        type: thread.thread_type,
        archived: false,
        last_message_preview: thread.last_message_content,
        last_message_at: lastTimestamp,
        last_activity_at: lastTimestamp,
        created_at: lastTimestamp,
        updated_at: lastTimestamp,
        unread_count: typeof thread.unread_count === 'number' ? thread.unread_count : 0,
        pinned: typeof thread.pinned === 'boolean' ? thread.pinned : false,
        pinned_at: typeof thread.pinned_at === 'string' ? thread.pinned_at : null,
        participants: Array.isArray(thread.participants)
          ? thread.participants.map((participant: any) => ({
              user_id: participant.id,
              user: {
                id: participant.id,
                full_name: participant.name,
                username: participant.name,
                avatar_url: participant.avatar_url,
              },
            }))
          : [],
      }
    })

    const threadIds = rpcThreads.map((t) => t.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
    if (threadIds.length > 0) {
      const { data: prefRows } = await supabase
        .from('chat_participants')
        .select('thread_id, unread_count, pinned, pinned_at, archived')
        .eq('user_id', currentUserId)
        .in('thread_id', threadIds)

      const prefMap = new Map(
        (prefRows ?? []).map((r: any) => [
          r.thread_id as string,
          {
            unread_count: typeof r.unread_count === 'number' ? r.unread_count : 0,
            pinned: Boolean(r.pinned),
            pinned_at: typeof r.pinned_at === 'string' ? r.pinned_at : null,
            archived: Boolean(r.archived),
          },
        ])
      )

      for (const t of rpcThreads) {
        const p = prefMap.get(t.id)
        if (p) {
          t.unread_count = p.unread_count
          t.pinned = p.pinned
          t.pinned_at = p.pinned_at
          t.archived = p.archived
        }
      }
    }

    const formattedThreads = await Promise.all(
      rpcThreads.map((threadRecord: any) => formatThread(threadRecord, currentUserId))
    )

    return sortThreads(formattedThreads)
  } catch (error) {
    console.error('Unexpected error while loading threads via RPC:', error)
    activateFallback(error)
    return sortThreads(getLocalThreadsForUser(currentUserId))
  }
}

// Map API message response (already has read_by, attachments) to ChatMessage
const mapApiMessageToChatMessage = (message: any): ChatMessage => {
  const sender = message.sender ?? message.sender_id
  const senderProfile = typeof sender === 'object' ? sender : null
  const attachmentsRaw = message.attachments ?? []
  const attachments: ChatAttachment[] = Array.isArray(attachmentsRaw)
    ? attachmentsRaw.map((att: any) => ({
        id: att.id,
        name: att.file_name ?? att.name,
        url: att.file_url ?? att.url,
        type: (att.file_type ?? att.mimeType ?? '').startsWith('image/') ? 'image' as const :
              (att.file_type ?? att.mimeType ?? '').startsWith('video/') ? 'video' as const : 'file' as const,
        size: att.file_size ?? att.size ?? 0,
        mimeType: att.file_type ?? att.mimeType ?? '',
      }))
    : []

  return {
    id: message.id,
    thread_id: message.thread_id,
    sender_id: message.sender_id,
    content: message.content ?? '',
    created_at: message.created_at,
    updated_at: message.updated_at,
    message_type: message.message_type,
    metadata: message.metadata,
    read_by: Array.isArray(message.read_by) ? message.read_by : [],
    is_deleted: message.is_deleted,
    deleted_for: message.deleted_for ?? [],
    deleted_at: message.deleted_at,
    attachments,
    sender: senderProfile ? {
      id: senderProfile.id,
      name: senderProfile.full_name || senderProfile.username || 'Loading...',
      avatarUrl: senderProfile.avatar_url ?? undefined,
    } : {
      id: message.sender_id,
      name: 'Loading...',
      avatarUrl: undefined,
    },
    reply_to_id: message.reply_to_id,
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
  }
}

// Format message data from Supabase
const formatMessage = async (message: any): Promise<ChatMessage> => {
  // Get read receipts
  const { data: reads } = await supabase
    .from('message_reads')
    .select('user_id')
    .eq('message_id', message.id)

  // Get attachments
  const { data: attachments } = await supabase
    .from('message_attachments')
    .select('*')
    .eq('message_id', message.id)

  return {
    id: message.id,
    thread_id: message.thread_id,
    sender_id: message.sender_id,
    content: message.content,
    created_at: message.created_at,
    updated_at: message.updated_at,
    message_type: message.message_type,
    metadata: message.metadata,
    read_by: reads?.map(r => r.user_id) || [],
    is_deleted: message.is_deleted,
    deleted_for: message.deleted_for || [],
    deleted_at: message.deleted_at,
    attachments: attachments?.map(att => ({
      id: att.id,
      name: att.file_name,
      url: att.file_url,
      type: att.file_type.startsWith('image/') ? 'image' :
            att.file_type.startsWith('video/') ? 'video' : 'file',
      size: att.file_size,
      mimeType: att.file_type
    })),
    sender: message.sender ? {
      id: message.sender.id,
      name: message.sender.full_name || message.sender.username || 'Loading...',
      avatarUrl: message.sender.avatar_url
    } : (message.profiles ? {
      id: message.profiles.id,
      name: message.profiles.full_name || message.profiles.username || 'Loading...',
      avatarUrl: message.profiles.avatar_url
    } : {
      id: message.sender_id,
      name: 'Loading...',
      avatarUrl: null
    }),
    reply_to_id: message.reply_to_id,
    reactions: [],
  }
}


export const supabaseMessagingService = {
  async getUserThreads(currentUser?: ChatParticipant | null, options?: { limit?: number; page?: number }): Promise<ChatThread[]> {
    if (!currentUser) {
      return []
    }

    const limit = options?.limit ?? 20
    const page = options?.page ?? 0

    const sortThreads = (threads: ChatThread[]) =>
      [...threads].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))

    try {
      const res = await apiClient.get<{ data: any[]; meta?: { page: number; pageSize: number; hasMore: boolean } }>(
        '/api/chat/threads',
        { limit, page }
      )
      const threads = res?.data ?? []
      if (fallbackEnabled) {
        fallbackEnabled = false
      }
      if (!threads.length) {
        return []
      }
      const formattedThreads = await Promise.all(
        threads.map((thread: any) => formatThread(thread, currentUser.id))
      )
      formattedThreads.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
      return formattedThreads
    } catch (error: any) {
      const details = error?.details ?? error?.message
      if (isPolicyRecursionError(details ?? error)) {
        return loadThreadsViaRpc(currentUser.id, sortThreads)
      }
      console.error('Error in getUserThreads:', error)
      activateFallback(error)
      const all = sortThreads(getLocalThreadsForUser(currentUser.id))
      const from = page * limit
      return all.slice(from, from + limit)
    }
  },

  /** Full thread row from API (includes banner_url, group_id). Use when list/temp thread is incomplete. */
  async fetchThreadDetail(currentUserId: string, threadId: string): Promise<ChatThread | null> {
    if (!threadId?.trim() || !currentUserId) return null
    try {
      const res = await apiClient.get<{ data: any; meta?: unknown }>(`/api/chat/threads/${threadId}`)
      const raw = (res as any)?.data
      if (!raw?.id) return null
      return formatThread(raw, currentUserId)
    } catch (error) {
      console.error('fetchThreadDetail:', error)
      return null
    }
  },

  /** Sets this user's `chat_participants.archived` via POST /api/chat/threads/:id/archive */
  async setThreadArchived(
    threadId: string,
    currentUserId: string,
    archived: boolean
  ): Promise<ChatThread | null> {
    if (!threadId?.trim() || !currentUserId) return null
    try {
      const res = await apiClient.post<{ data: any; meta?: unknown }>(
        `/api/chat/threads/${threadId}/archive`,
        { archived }
      )
      const raw = (res as any)?.data
      if (!raw?.id) return null
      return formatThread(raw, currentUserId)
    } catch (error) {
      console.error('setThreadArchived:', error)
      throw error
    }
  },

  /** Sets current user's `chat_participants.pinned` via POST /api/chat/threads/:id/pin */
  async setThreadPinned(
    threadId: string,
    currentUserId: string,
    pinned: boolean
  ): Promise<ChatThread | null> {
    if (!threadId?.trim() || !currentUserId) return null
    try {
      const res = await apiClient.post<{ data: any; meta?: unknown }>(
        `/api/chat/threads/${threadId}/pin`,
        { pinned }
      )
      const raw = (res as any)?.data
      if (!raw?.id) return null
      return formatThread(raw, currentUserId)
    } catch (error) {
      console.error('setThreadPinned:', error)
      throw error
    }
  },

  async getThreadMessages(
    threadId: string,
    options?: { limit?: number; page?: number; keyword?: string }
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const limit = options?.limit ?? 50
    const page = options?.page ?? 0
    const keyword = options?.keyword?.trim()
    const params: Record<string, string | number | boolean | undefined> = { limit, page }
    if (keyword) params.keyword = keyword

    try {
      const res = await apiClient.get<{
        data?: any[]
        hasMore?: boolean
      }>(`/api/chat/threads/${threadId}/messages`, params)
      const payload = res as Record<string, unknown>
      const rawList = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : []) as any[]
      const hasMore =
        typeof payload?.hasMore === 'boolean'
          ? payload.hasMore
          : rawList.length >= limit
      if (fallbackEnabled) {
        fallbackEnabled = false
      }
      return {
        messages: rawList.map((m: any) => mapApiMessageToChatMessage(m)),
        hasMore,
      }
    } catch (error) {
      console.error('Error in getThreadMessages:', error)
      activateFallback(error)
      let list = localMessages.get(threadId) ?? []
      if (keyword) {
        const k = keyword.toLowerCase()
        list = list.filter((m) => (m.content || '').toLowerCase().includes(k))
      }
      const from = page * limit
      const slice = list.slice(from, from + limit)
      return {
        messages: slice,
        hasMore: from + slice.length < list.length,
      }
    }
  },

  async getRecentCalls(currentUserId: string, limit = 10, page = 0): Promise<RecentCallEntry[]> {
    if (!currentUserId) return []

    try {
      const res = await apiClient.get<{ data: any[]; meta?: { page: number; pageSize: number; hasMore: boolean } }>(
        '/api/chat/calls/recent',
        { limit, page }
      )
      const list = res?.data ?? []
      return list.map((r: any) => {
        const meta = (r.metadata ?? {}) as Record<string, unknown>
        return {
          thread_id: r.thread_id,
          created_at: r.created_at,
          message_type: r.message_type,
          call_type: (meta.callType === 'video' ? 'video' : 'audio') as 'audio' | 'video',
          metadata: meta,
          thread_name: r.thread_name ?? null,
          thread_type: r.thread_type ?? null,
          contact_id: r.contact_id ?? null,
          contact_name: r.contact_name ?? null,
          contact_avatar_url: r.contact_avatar_url ?? null,
          banner_url: r.banner_url ?? null,
        }
      })
    } catch (err) {
      console.error('Error fetching recent calls:', err)
      return []
    }
  },

  async createThread(currentUser: ChatParticipant, options: CreateThreadOptions): Promise<string> {
    try {
      const participantIds = Array.from(new Set([currentUser.id, ...options.participant_ids]))
      const resolvedType = options.type ?? (participantIds.length > 2 ? 'group' : 'direct')
      const res = await apiClient.post<{ data: { id: string } }>('/api/chat/threads', {
        participant_ids: options.participant_ids,
        type: resolvedType,
        title: options.title ?? undefined,
        name: options.name ?? options.title ?? undefined,
        group_id: options.group_id,
      })
      const id = (res as any)?.data?.id
      if (!id) throw new Error('No thread id returned')
      return id
    } catch (error) {
      console.error('Error creating thread:', error)
      activateFallback(error)
      const thread = createLocalThread(currentUser, options)
      return thread.id
    }
  },

  async sendMessage(threadId: string, payload: SendMessageOptions, currentUser: ChatParticipant): Promise<ChatMessage> {
    try {
      const res = await apiClient.post<{ data: any }>(
        `/api/chat/threads/${threadId}/messages`,
        {
          content: payload.content,
          message_type: payload.message_type ?? 'text',
          metadata: payload.metadata,
          attachments: payload.attachments,
          reply_to_id: payload.reply_to_id,
        }
      )
      const rawMessage = (res as any)?.data
      if (!rawMessage) throw new Error('No message returned')
      const formattedMessage = mapApiMessageToChatMessage(rawMessage)

      // Send call signaling notifications.
      // For reject/missed signals we await delivery to avoid window-close races in call popup flows.
      if (ALL_CALL_SIGNAL_MESSAGE_TYPES.includes(payload.message_type || '')) {
        const runCallSignalNotifications = async () => {
          try {
            const metadata = payload.metadata as any
            const messageType = payload.message_type || 'text'
            // FCM only for incoming ring; other signals use call_sessions Realtime (no duplicate pushes / token churn).
            if (messageType !== 'ringing') {
              return
            }
            const callType = metadata?.callType || metadata?.call_type || 'audio'
            const roomId = metadata?.roomId || metadata?.room_id
            const token = metadata?.token
            const targetUserId = metadata?.targetUserId || metadata?.target_user_id
            const callId = metadata?.callId || metadata?.call_id
            const actorId = currentUser.id
            const actorName = currentUser.name || metadata?.callerName || metadata?.caller_name || 'Someone'
            const signalSentAtIso = new Date().toISOString()

            // Fast path: when target user is already known, avoid extra participants lookup.
            let targetParticipants: { user_id: string }[] = []
            if (targetUserId) {
              targetParticipants = [{ user_id: targetUserId }]
            } else {
              const callParticipantsRes = await apiClient.get<{ data: { user_id: string }[] }>(
                `/api/chat/threads/${threadId}/participants`,
                { exclude_user_id: currentUser.id }
              )
              targetParticipants = callParticipantsRes?.data ?? []
            }

            targetParticipants = Array.from(
              new Set(
                targetParticipants
                  .map((p) => p?.user_id)
                  .filter((id): id is string => Boolean(id && id !== actorId))
              )
            ).map((user_id) => ({ user_id }))

            if (targetParticipants.length === 0) {
              throw new Error(`No target participants resolved for ${messageType} in thread ${threadId}`)
            }

            const buildNotification = (_recipientUserId: string) => {
              const isGroupCall = metadata?.isGroupCall === true || metadata?.is_group_call === true || metadata?.is_group_call === 'true'
              return {
                title: `Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
                body: `${actorName} is calling you...`,
                notification_type: 'ringing',
                tag: `incoming-call-${threadId}`,
                requireInteraction: true,
                silent: false,
                vibrate: [200, 100, 200, 100, 200, 100, 200] as number[],
                data: {
                  type: 'ringing',
                  call_type: callType,
                  room_id: roomId,
                  thread_id: threadId,
                  ...(token ? { token } : {}),
                  ...(callId ? { call_id: callId, callId } : {}),
                  caller_id: actorId,
                  caller_name: actorName,
                  caller_avatar_url: metadata?.callerAvatarUrl || metadata?.caller_avatar_url,
                  is_group_call: isGroupCall ? 'true' : 'false',
                  isGroupCall: isGroupCall ? 'true' : 'false',
                  sent_at: signalSentAtIso,
                  url: `/call/${roomId}`
                }
              }
            }

            const notificationResults = await Promise.allSettled(targetParticipants.map(async (participant) => {
              const notification = buildNotification(participant.user_id)
              const persistToNotificationsTable = false
              const response = await notificationService.sendNotification({
                user_id: participant.user_id,
                title: notification.title,
                body: notification.body,
                notification_type: notification.notification_type as any,
                skip_db: !persistToNotificationsTable,
                tag: notification.tag,
                requireInteraction: notification.requireInteraction,
                silent: notification.silent,
                ...(notification.vibrate ? { vibrate: notification.vibrate } : {}),
                data: toPushDataRecord(notification.data || {}),
              })
              if (!response.success) {
                throw new Error(response.error || `Failed to send ${messageType} notification`)
              }
              console.log(`📞 Sent ${messageType} notification to ${participant.user_id}`)
            }))

            const failedCount = notificationResults.filter((result) => result.status === 'rejected').length
            if (failedCount > 0) {
              const firstError = notificationResults.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined
              throw new Error(
                `Failed to deliver ${failedCount}/${notificationResults.length} ${messageType} notifications` +
                (firstError?.reason ? `: ${String(firstError.reason)}` : '')
              )
            }
          } catch (error) {
            console.error('Error processing call signaling notification:', error)
          }
        }

        const messageType = payload.message_type || 'text'
        const shouldAwaitSignalDelivery =
          messageType === 'ringing' ||
          messageType === 'active' ||
          messageType === 'declined' ||
          messageType === 'missed'
        if (shouldAwaitSignalDelivery) {
          await runCallSignalNotifications()
        } else {
          void runCallSignalNotifications()
        }
      }

      notifyMessageSubscribers(formattedMessage)
      return formattedMessage
    } catch (error) {
      console.error('Error sending message:', error)
      activateFallback(error)
      return createLocalMessage(threadId, payload, currentUser)
    }
  },

  async markMessagesAsRead(threadId: string, messageIds: string[], userId: string): Promise<void> {
    if (!userId || !messageIds.length) return

    try {
      await apiClient.post(`/api/chat/threads/${threadId}/read`, { message_ids: messageIds })
    } catch (error) {
      console.error('Error in markMessagesAsRead:', error)
      markLocalMessagesAsRead(threadId, userId)
    }
  },

  async deleteMessage(messageId: string): Promise<void> {
    if (fallbackEnabled) {
      deleteLocalMessage(messageId)
      return
    }

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', messageId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      activateFallback(error)
      deleteLocalMessage(messageId)
    }
  },

  async deleteMessageForMe(threadId: string, messageId: string, _userId: string): Promise<void> {
    if (fallbackEnabled) {
      deleteLocalMessage(messageId)
      return
    }

    try {
      await apiClient.post(`/api/chat/threads/${threadId}/messages/${messageId}/delete-for-me`)
    } catch (error) {
      console.error('Error deleting message for me:', error)
      throw error
    }
  },

  async deleteMessageForEveryone(threadId: string, messageId: string, _userId: string): Promise<void> {
    if (fallbackEnabled) {
      deleteLocalMessage(messageId)
      return
    }

    try {
      await apiClient.post(`/api/chat/threads/${threadId}/messages/${messageId}/delete-for-everyone`)
    } catch (error) {
      console.error('Error deleting message for everyone:', error)
      throw error // Re-throw to show user the error (might be time limit)
    }
  },

  async clearThreadMessagesForMe(threadId: string, _userId: string): Promise<void> {
    if (fallbackEnabled) {
      const threadMessages = localMessages.get(threadId) || []
      threadMessages.forEach((message) => deleteLocalMessage(message.id))
      return
    }

    try {
      await apiClient.post(`/api/chat/threads/${threadId}/messages/clear`)
    } catch (error) {
      console.error('Error clearing thread messages for me:', error)
      activateFallback(error)
      const threadMessages = localMessages.get(threadId) || []
      threadMessages.forEach((message) => deleteLocalMessage(message.id))
    }
  },

  async canDeleteForEveryone(
    threadId: string,
    messageId: string,
    userId: string
  ): Promise<boolean> {
    const cacheKey = getCanDeletePermissionKey(messageId, userId)

    if (canDeletePermissionCache.has(cacheKey)) {
      return canDeletePermissionCache.get(cacheKey) === true
    }

    const existingRequest = canDeletePermissionInFlight.get(cacheKey)
    if (existingRequest) {
      return existingRequest
    }

    const permissionRequest = (async () => {
      try {
        if (fallbackEnabled) {
          const msg = findLocalMessageById(messageId)
          const canDelete = Boolean(
            msg && msg.sender_id === userId && !msg.is_deleted
          )
          canDeletePermissionCache.set(cacheKey, canDelete)
          return canDelete
        }

        const data = await apiClient.get<{ canDelete: boolean }>(
          `/api/chat/threads/${threadId}/messages/${messageId}/can-delete-for-everyone`
        )
        const canDelete = data?.canDelete === true
        canDeletePermissionCache.set(cacheKey, canDelete)
        return canDelete
      } catch (error) {
        console.error('Error in canDeleteForEveryone:', error)
        canDeletePermissionCache.set(cacheKey, false)
        return false
      } finally {
        canDeletePermissionInFlight.delete(cacheKey)
      }
    })()

    canDeletePermissionInFlight.set(cacheKey, permissionRequest)

    try {
      return await permissionRequest
    } catch (error) {
      console.error('Error in canDeleteForEveryone:', error)
      return false
    }
  },

  subscribeToUserThreads(currentUser: ChatParticipant, callback: ThreadSubscriber): () => void {
    const existing = threadSubscribers.get(currentUser.id)
    const callbacks = existing ?? new Set<ThreadSubscriber>()
    callbacks.add(callback)
    threadSubscribers.set(currentUser.id, callbacks)

    if (!threadsSubscription && !fallbackEnabled) {
      initializeSubscriptions(currentUser)
    }

    if (fallbackEnabled) {
      getLocalThreadsForUser(currentUser.id).forEach((thread) => callback(thread))
    }

    return () => {
      const subs = threadSubscribers.get(currentUser.id)
      if (!subs) return
      subs.delete(callback)
      if (subs.size === 0) {
        threadSubscribers.delete(currentUser.id)
      }
    }
  },

  subscribeToThread(threadId: string, callback: MessageSubscriber, currentUserForInit?: ChatParticipant | null): () => void {
    const existing = messageSubscribers.get(threadId)
    const callbacks = existing ?? new Set<MessageSubscriber>()
    callbacks.add(callback)
    messageSubscribers.set(threadId, callbacks)

    // Ensure base thread subscriptions are initialized if not already.
    // Prefer explicit current user from caller to avoid auth-session timing races.
    if (!threadsSubscription && !fallbackEnabled) {
      if (currentUserForInit?.id) {
        initializeSubscriptions(currentUserForInit)
      } else {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            const currentUser: ChatParticipant = {
              id: session.user.id,
              name: session.user.user_metadata?.full_name || session.user.email || 'User'
            }
            initializeSubscriptions(currentUser)
          }
        })
      }
    }

    if (!fallbackEnabled && !threadMessageChannels.has(threadId)) {
      const channelName = `chat_messages:${threadId}:${Date.now().toString(36)}`
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `thread_id=eq.${threadId}`,
          },
          async (payload) => {
            if (deniedRealtimeThreadIds.has(threadId)) return
            const message = payload.new as any
            try {
              const { data: fullMessage } = await supabase
                .from('chat_messages')
                .select(`
                  *,
                  sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
                `)
                .eq('id', message.id)
                .single()

              const formattedMessage = fullMessage
                ? await formatMessage(fullMessage)
                : mapApiMessageToChatMessage(message)

              notifyMessageSubscribers(formattedMessage, { skipPush: true })
            } catch (error) {
              console.warn('Realtime thread message hydration failed, using lightweight payload:', error)
              notifyMessageSubscribers(mapApiMessageToChatMessage(message), { skipPush: true })
            }
          }
        )
        .subscribe()

      threadMessageChannels.set(threadId, channel)
    }

    return () => {
      const subs = messageSubscribers.get(threadId)
      if (!subs) return
      subs.delete(callback)
      if (subs.size === 0) {
        messageSubscribers.delete(threadId)
        const channel = threadMessageChannels.get(threadId)
        if (channel) {
          try { supabase.removeChannel(channel) } catch {}
          threadMessageChannels.delete(threadId)
        }
      }
    }
  },

  subscribeToCallSignals(threadId: string, callback: CallSignalSubscriber): () => void {
    if (!threadId) return () => {}

    if (fallbackEnabled) {
      return this.subscribeToThread(threadId, (msg) => {
        if (ALL_CALL_SIGNAL_MESSAGE_TYPES.includes(msg.message_type || '')) {
          callback(msg)
        }
      })
    }

    const channelName = `call_signals:${threadId}:${Date.now().toString(36)}`
    const callChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_sessions',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const status = row?.status
          if (status !== 'ringing' && status !== 'initiated') return
          callback(callSessionInsertToChatMessage(row))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_sessions',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const mapped = callSessionUpdateToChatMessage(row, payload.old as Record<string, unknown>)
          if (mapped) callback(mapped as ChatMessage)
        }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(callChannel) } catch {}
    }
  },

  async updateMessageSenderInfo(messageId: string): Promise<ChatMessage | null> {
    try {
      const { data: message, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
        `)
        .eq('id', messageId)
        .single()

      if (error) throw error

      return formatMessage(message)
    } catch (error) {
      console.error('Error updating message sender info:', error)
      return null
    }
  },

  cleanup(): void {
    cleanupSubscriptions()
    threadSubscribers.clear()
    messageSubscribers.clear()
  },

  /**
   * Find an existing group chat thread for a specific group
   */
  async findGroupThread(groupId: string, currentUserId?: string): Promise<ChatThread | null> {
    try {
      const { data: groupThread, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('type', 'group')
        .eq('group_id', groupId)
        .maybeSingle()

      if (error) {
        console.error('Error finding group thread:', error)
        return null
      }

      if (!groupThread) return null

      const thread = await formatThread(groupThread, currentUserId || '')
      return thread
    } catch (error) {
      console.error('Error finding group thread:', error)
      return null
    }
  },

  /**
   * Get all members of a group
   */
  async getGroupMembers(groupId: string): Promise<Array<{ user_id: string; role: string }>> {
    try {
      const { data, error } = await supabase
        .from('group_memberships')
        .select('user_id, role')
        .eq('group_id', groupId)
        .eq('status', 'active')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching group members:', error)
      return []
    }
  },

  /**
   * Get user profiles by IDs and convert to ChatParticipants
   */
  async getUsersByIds(userIds: string[]): Promise<ChatParticipant[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds)

      if (error) throw error

      return (data || []).map(profile => ({
        id: profile.id,
        name: profile.full_name || profile.username || 'Unknown',
        username: profile.username,
        avatar_url: profile.avatar_url,
      }))
    } catch (error) {
      console.error('Error fetching users by IDs:', error)
      return []
    }
  },

  /** Stop applying incoming realtime rows to UI (call when user leaves a group chat thread). */
  denyRealtimeForThread(threadId: string) {
    deniedRealtimeThreadIds.add(threadId)
  },

  /** Allow realtime again after the user regains thread access (e.g. re-joined group). */
  allowRealtimeForThread(threadId: string) {
    deniedRealtimeThreadIds.delete(threadId)
  },
}
