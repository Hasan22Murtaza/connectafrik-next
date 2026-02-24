import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import type { ChatParticipant as BaseParticipant } from "@/shared/types/chat"
import { notificationService } from '@/shared/services/notificationService'

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
  deleted_for?: string[] // Array of user IDs who deleted this message for themselves
  deleted_at?: string
  attachments?: ChatAttachment[]
  sender?: ChatParticipant
  reply_to_id?: string
}

export interface ChatThread {
  id: string
  name: string
  type: 'direct' | 'group'
  participants: ChatParticipant[]
  last_message_preview: string | null
  last_message_at: string
  unread_count: number
  created_at: string
  updated_at: string
}

export interface CreateThreadOptions {
  participant_ids: string[]
  participants?: ChatParticipant[]
  type?: 'direct' | 'group'
  title?: string | null
  name?: string
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
}

type ThreadSubscriber = (thread: ChatThread) => void
type MessageSubscriber = (message: ChatMessage) => void

// Subscribers for real-time updates
const threadSubscribers = new Map<string, Set<ThreadSubscriber>>()
const messageSubscribers = new Map<string, Set<MessageSubscriber>>()

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

  // Send push notification for new messages (not call requests). Skip when skipPush is true
  // (e.g. from the realtime handler) so we only send push once from the sendMessage path.
  if (!options?.skipPush && message.message_type !== 'call_request' && message.message_type !== 'call_accepted' && message.message_type !== 'call_ended') {
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
              data: {
                thread_id: message.thread_id,
                sender_id: message.sender_id,
                sender_name: senderName,
              }
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

const computeThreadKey = (participantIds: string[]) =>
  Array.from(new Set(participantIds)).sort().join(':')

let fallbackEnabled = false

const localThreads = new Map<string, ChatThread>()
const localMessages = new Map<string, ChatMessage[]>()
const localThreadKeys = new Map<string, string>()

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

const searchLocalMessages = (query: string, userId: string, threadId?: string): ChatMessage[] => {
  const normalized = query.toLowerCase()
  const targetThreadIds = threadId
    ? [threadId]
    : getLocalThreadsForUser(userId).map((thread) => thread.id)

  const results: ChatMessage[] = []

  targetThreadIds.forEach((id) => {
    const messages = localMessages.get(id) ?? []
    messages.forEach((message) => {
      const content = message.content ?? ''
      if (!message.is_deleted && content.toLowerCase().includes(normalized)) {
        results.push(message)
      }
    })
  })

  return results
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

  // Subscribe to message updates
  messagesSubscription = supabase
    .channel('chat_messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      },
      async (payload) => {
        const message = payload.new as any

        // Check if current user is a participant via API (404/error => skip unless call message)
        try {
          await apiClient.get<{ data: unknown }>(`/api/chat/threads/${message.thread_id}`)
        } catch {
          const isCallMessage = ['call_request', 'call_accepted', 'call_rejected', 'call_ended'].includes(message.message_type)
          if (!isCallMessage) return
        }

        // Fetch full message with sender info (no single-message API; use Supabase for realtime)
        const { data: fullMessage } = await supabase
          .from('chat_messages')
          .select(`
            *,
            sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
          `)
          .eq('id', message.id)
          .single()

        if (fullMessage) {
          const formattedMessage = await formatMessage(fullMessage)
          notifyMessageSubscribers(formattedMessage, { skipPush: true })
        }
      }
    )
    .subscribe()
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

  const resolvedType: 'direct' | 'group' = thread.type || (participants.length > 2 ? 'group' : 'direct')

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

  return {
    id: thread.id,
    name: displayName,
    type: resolvedType,
    participants,
    last_message_preview: thread.last_message_preview,
    last_message_at: lastMessageAt,
    unread_count: unreadCount || 0,
    created_at: thread.created_at,
    updated_at: thread.updated_at || lastMessageAt,
  }
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

    const rpcThreads = (data ?? []).map((thread: any) => {
      const lastTimestamp = thread.last_message_at ?? new Date().toISOString()

      return {
        id: thread.thread_id,
        name: thread.thread_name,
        title: thread.thread_name,
        type: thread.thread_type,
        last_message_preview: thread.last_message_content,
        last_message_at: lastTimestamp,
        last_activity_at: lastTimestamp,
        created_at: lastTimestamp,
        updated_at: lastTimestamp,
        unread_count: typeof thread.unread_count === 'number' ? thread.unread_count : 0,
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
    reply_to_id: message.reply_to_id
  }
}

// Function to fetch sender information for messages
const fetchSenderInfo = async (senderId: string) => {
  try {
    const res = await apiClient.get<{ data: { id: string; full_name?: string; username?: string; avatar_url?: string } }>(
      `/api/users/${senderId}`
    )
    const data = (res as any)?.data
    if (!data) throw new Error('No profile')
    return {
      id: data.id,
      name: data.full_name || data.username || 'Unknown User',
      avatarUrl: data.avatar_url ?? null
    }
  } catch (error) {
    console.error('Error fetching sender info:', error)
    return {
      id: senderId,
      name: 'Unknown User',
      avatarUrl: null
    }
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
      const res = await apiClient.get<{ data: any[]; page: number; pageSize: number; hasMore: boolean }>(
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

  async getThreadMessages(threadId: string): Promise<ChatMessage[]> {
    try {
      const res = await apiClient.get<{ data: any[] }>(
        `/api/chat/threads/${threadId}/messages`
      )
      const messages = res?.data ?? []
      if (fallbackEnabled) {
        fallbackEnabled = false
      }
      return messages.map((m: any) => mapApiMessageToChatMessage(m))
    } catch (error) {
      console.error('Error in getThreadMessages:', error)
      activateFallback(error)
      return localMessages.get(threadId) ?? []
    }
  },

  async getRecentCalls(currentUserId: string, limit = 10, page = 0): Promise<RecentCallEntry[]> {
    if (!currentUserId) return []

    try {
      const res = await apiClient.get<{ data: any[]; page: number; pageSize: number; hasMore: boolean }>(
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

      // Send push notification for call requests immediately (works even when offline)
      if (payload.message_type === 'call_request') {
        try {
          const callParticipantsRes = await apiClient.get<{ data: { user_id: string }[] }>(
            `/api/chat/threads/${threadId}/participants`,
            { exclude_user_id: currentUser.id }
          )
          const participants = callParticipantsRes?.data ?? []

          if (participants.length > 0) {
            const metadata = payload.metadata as any
            const callType = metadata?.callType || 'audio'
            const roomId = metadata?.roomId
            const token = metadata?.token
            const callerId = currentUser.id
            const callerName = currentUser.name || metadata?.callerName || 'Someone'

            for (const participant of participants) {
              try {
                if (roomId && token && callerId) {
                  await notificationService.sendNotification({
                    user_id: participant.user_id,
                    title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
                    body: `${callerName} is calling you...`,
                    notification_type: 'system',
                    skip_db: true,
                    tag: `incoming-call-${threadId}`,
                    requireInteraction: true,
                    vibrate: [200, 100, 200, 100, 200, 100, 200],
                    data: {
                      type: 'incoming_call',
                      call_type: callType,
                      room_id: roomId,
                      thread_id: threadId,
                      token: token,
                      caller_id: callerId,
                      caller_name: callerName,
                      url: `/call/${roomId}`
                    }
                  })
                  console.log(`📞 Sent incoming call push notification to ${participant.user_id}`)
                }
              } catch (notificationError) {
                console.error('Error sending call notification:', notificationError)
              }
            }
          }
        } catch (error) {
          console.error('Error processing call request notification:', error)
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

  async deleteMessageForMe(messageId: string, userId: string): Promise<void> {
    if (fallbackEnabled) {
      deleteLocalMessage(messageId)
      return
    }

    try {
      const { error } = await supabase.rpc('delete_message_for_user', {
        p_message_id: messageId,
        p_user_id: userId
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting message for me:', error)
      activateFallback(error)
      deleteLocalMessage(messageId)
    }
  },

  async deleteMessageForEveryone(messageId: string, userId: string): Promise<void> {
    if (fallbackEnabled) {
      deleteLocalMessage(messageId)
      return
    }

    try {
      const { error } = await supabase.rpc('delete_message_for_everyone', {
        p_message_id: messageId,
        p_user_id: userId
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting message for everyone:', error)
      throw error // Re-throw to show user the error (might be time limit)
    }
  },

  async canDeleteForEveryone(messageId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('can_delete_for_everyone', {
        p_message_id: messageId,
        p_user_id: userId
      })

      if (error) {
        console.error('Error checking delete permission:', error)
        return false
      }

      return data === true
    } catch (error) {
      console.error('Error in canDeleteForEveryone:', error)
      return false
    }
  },

  async searchMessages(query: string, userId: string, threadId?: string): Promise<ChatMessage[]> {
    if (fallbackEnabled) {
      return searchLocalMessages(query, userId, threadId)
    }

    try {
      const params: Record<string, string> = { q: query }
      if (threadId) params.thread_id = threadId
      const res = await apiClient.get<{ data: any[] }>('/api/chat/messages/search', params)
      const messages = res?.data ?? []
      return messages.map((m: any) => mapApiMessageToChatMessage(m))
    } catch (error) {
      console.error('Error in searchMessages:', error)
      activateFallback(error)
      return searchLocalMessages(query, userId, threadId)
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

  subscribeToThread(threadId: string, callback: MessageSubscriber): () => void {
    const existing = messageSubscribers.get(threadId)
    const callbacks = existing ?? new Set<MessageSubscriber>()
    callbacks.add(callback)
    messageSubscribers.set(threadId, callbacks)

    // Ensure real-time subscriptions are initialized if not already
    // We need a currentUser to initialize, so we'll get it from the first subscriber
    // This is a workaround - ideally we'd pass currentUser here
    if (!messagesSubscription && !fallbackEnabled) {
      // Try to get currentUser from auth session
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

    return () => {
      const subs = messageSubscribers.get(threadId)
      if (!subs) return
      subs.delete(callback)
      if (subs.size === 0) {
        messageSubscribers.delete(threadId)
      }
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
      // Fetch all group threads and filter by groupId in metadata
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('type', 'group')

      if (error) {
        console.error('Error finding group thread:', error)
        return null
      }

      if (!data || data.length === 0) return null

      // Find thread with matching groupId in metadata
      const groupThread = data.find(
        (t) => t.metadata && typeof t.metadata === 'object' && 'groupId' in t.metadata && t.metadata.groupId === groupId
      )

      if (!groupThread) return null

      // Format the thread with participants (use currentUserId if provided)
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
}
