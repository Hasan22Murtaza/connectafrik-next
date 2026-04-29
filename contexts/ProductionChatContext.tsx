'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ChatMessage, ChatThread, supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService'
import { toCallSessionStatusMessageType } from '@/features/chat/services/callSessionRealtime'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'
import { apiClient, ApiError } from '@/lib/api-client'
import toast from 'react-hot-toast'
import { usePresence } from '@/shared/hooks/usePresence'
import { openCallWindow } from '@/shared/utils/callWindow'

interface ChatParticipant {
  id: string
  name: string
  avatarUrl?: string
}

interface ThreadOptions {
  participant_ids?: string[]
  type?: 'direct' | 'group'
  name?: string
  group_id?: string
  metadata?: Record<string, any>
  openInDock?: boolean
}

export interface CallRequest {
  threadId: string
  type: 'audio' | 'video'
  callerId: string
  callerName?: string
  callerAvatarUrl?: string
  roomId?: string
  token?: string
  targetUserId?: string
  callId?: string
  isGroupCall?: boolean
}

interface ProductionChatContextType {
  startChatWithMembers: (participants: ChatParticipant[], options?: ThreadOptions) => Promise<string | null>
  openThread: (threadId: string) => void
  startCall: (
    threadId: string,
    type: 'audio' | 'video',
    targetUserId?: string,
    targetUserName?: string,
    targetUserAvatarUrl?: string
  ) => Promise<void>
  callRequests: Record<string, CallRequest>
  currentUser: { id: string; name?: string; avatarUrl?: string } | null
  clearCallRequest: (threadId: string) => void
  openThreads: string[]
  closeThread: (threadId: string) => void
  getThreadById: (threadId: string) => ChatThread | undefined
  getMessagesForThread: (threadId: string) => ChatMessage[]
  sendMessage: (threadId: string, text: string, payload?: any) => Promise<void>
  minimizedThreadIds: string[]
  markThreadRead: (threadId: string) => void
  threads: ChatThread[]
  clearMessagesForUser: (threadId: string, userId: string) => void
  markMessageDeletedForUser: (threadId: string, messageId: string, userId: string) => void
  setMessagesForThread: (threadId: string, messages: ChatMessage[]) => void
}

function parseCallSessionMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return typeof p === 'object' && p && !Array.isArray(p) ? p : {}
    } catch {
      return {}
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, any>) : {}
}

const ProductionChatContext = createContext<ProductionChatContextType | undefined>(undefined)

export const useProductionChat = () => {
  const context = useContext(ProductionChatContext)
  if (context === undefined) {
    throw new Error('useProductionChat must be used within a ProductionChatProvider')
  }
  return context
}

export const ProductionChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  usePresence()
  const [callRequests, setCallRequests] = useState<Record<string, CallRequest>>({})
  const [openThreads, setOpenThreads] = useState<string[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const callRequestsRef = useRef<Record<string, CallRequest>>({})
  const callStartInFlightRef = useRef<Set<string>>(new Set())
  /** Dedupes poll + Realtime so we do not open two modals for the same call_id. */
  const dispatchedIncomingCallIdsRef = useRef<Set<string>>(new Set())
  /** Main window: pause /calls/incoming poll while a call is active (accept is signaled via postMessage). */
  const pauseIncomingCallsPollRef = useRef(false)

  const currentUser = useMemo(() => {
    if (!user) return null
    const displayName =
      user.user_metadata?.full_name ||
      [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') ||
      user.email
    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      user.user_metadata?.profile_image ||
      undefined
    return { id: user.id, name: displayName || user.email, avatarUrl }
  }, [user])

  useEffect(() => {
    callRequestsRef.current = callRequests
  }, [callRequests])

  // Preload call-related chunks/sdk during idle time so call startup is faster.
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return
    let cancelled = false
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }
    const preload = () => {
      if (cancelled) return
      void import('@videosdk.live/js-sdk')
      void import('@/shared/utils/callWindow')
      void import('@/features/video/components/VideoSDKCallModal')
    }

    if (windowWithIdle.requestIdleCallback) {
      const idleId = windowWithIdle.requestIdleCallback(preload, { timeout: 1500 })
      return () => {
        cancelled = true
        try { windowWithIdle.cancelIdleCallback?.(idleId) } catch {}
      }
    }

    const timer = window.setTimeout(preload, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [user])

  const openThread = useCallback(async (threadId: string) => {
    supabaseMessagingService.allowRealtimeForThread(threadId)

    const existingThread = threads.find(t => t.id === threadId)
    
    if (!existingThread && currentUser) {
      try {
        const userThreads = await supabaseMessagingService.getUserThreads(currentUser)
        const thread = userThreads.find(t => t.id === threadId)
        if (thread) {
          setThreads(prev => {
            const exists = prev.find(t => t.id === threadId)
            if (exists) return prev
            return [...prev, thread]
          })
        }
      } catch (error) {
        console.error('Error loading thread:', error)
      }
    }
    
    setOpenThreads(prev => {
      if (!prev.includes(threadId)) {
        return [...prev, threadId]
      }
      return prev
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openChatThread', { detail: { threadId } }))
    }
  }, [threads, currentUser])

  const closeThread = useCallback((threadId: string) => {
    setOpenThreads(prev => prev.filter(id => id !== threadId))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('closeChatThread', { detail: { threadId } }))
    }
  }, [])

  const handleGroupChatLeft = useCallback(
    (e: Event) => {
      const tid = (e as CustomEvent<{ threadId?: string }>).detail?.threadId
      if (!tid) return
      supabaseMessagingService.denyRealtimeForThread(tid)
      closeThread(tid)
      setThreads((prev) => prev.filter((t) => t.id !== tid))
      setMessages((prev) => {
        const { [tid]: _removed, ...rest } = prev
        return rest
      })
    },
    [closeThread]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = handleGroupChatLeft as EventListener
    window.addEventListener('groupChatLeft', handler)
    return () => window.removeEventListener('groupChatLeft', handler)
  }, [handleGroupChatLeft])

  const getThreadById = useCallback((threadId: string) => {
    return threads.find(t => t.id === threadId)
  }, [threads])

  const getMessagesForThread = useCallback((threadId: string) => {
    return messages[threadId] || []
  }, [messages])

  const sendMessage = useCallback(async (threadId: string, text: string, payload?: any) => {
    if (!currentUser) {
      console.error('Cannot send message: no current user')
      return
    }

    try {
      const message = await supabaseMessagingService.sendMessage(threadId, {
        content: text,
        attachments: payload?.attachments,
        reply_to_id: payload?.reply_to_id,
        message_type: payload?.message_type,
        metadata: payload?.metadata,
      }, currentUser)

      setMessages(prev => {
        const current = prev[threadId] || []
        if (current.some(m => m.id === message.id)) {
          return prev
        }
        return { ...prev, [threadId]: [...current, message] }
      })
    } catch (error) {
      console.error('Error sending message:', error)
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        toast.error('You can no longer send messages in this chat')
        return
      }
      const fallbackMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        thread_id: threadId,
        sender_id: currentUser.id,
        content: text,
        created_at: new Date().toISOString(),
        read_by: [currentUser.id],
        is_deleted: false,
        ...payload,
      }
      setMessages(prev => {
        const current = prev[threadId] || []
        return { ...prev, [threadId]: [...current, fallbackMessage] }
      })
    }
  }, [currentUser])

  const markThreadRead = useCallback(async (threadId: string) => {
    if (!currentUser) return
    
    try {
      const threadMessages = messages[threadId] || []
      const unreadMessageIds = threadMessages
        .filter((msg: ChatMessage) => {
          return msg.sender_id !== currentUser.id && 
                 (!msg.read_by || !msg.read_by.includes(currentUser.id))
        })
        .map((msg: ChatMessage) => msg.id)
      
      if (unreadMessageIds.length > 0) {
        await supabaseMessagingService.markMessagesAsRead(threadId, unreadMessageIds, currentUser.id)
        
        setMessages(prev => {
          const current = prev[threadId] || []
          return {
            ...prev,
            [threadId]: current.map((msg: ChatMessage) => {
              if (unreadMessageIds.includes(msg.id)) {
                const updatedReadBy = msg.read_by || []
                if (!updatedReadBy.includes(currentUser.id)) {
                  return {
                    ...msg,
                    read_by: [...updatedReadBy, currentUser.id]
                  }
                }
              }
              return msg
            })
          }
        })
      }
    } catch (error) {
      console.error('Error marking thread as read:', error)
    }
  }, [currentUser, messages])

  const minimizedThreadIds: string[] = []

  const setMessagesForThread = useCallback((threadId: string, nextMessages: ChatMessage[]) => {
    setMessages(prev => ({ ...prev, [threadId]: nextMessages }))
  }, [])

  const clearMessagesForUser = useCallback((threadId: string, userId: string) => {
    setMessages(prev => {
      const current = prev[threadId] || []
      const next = current.map(m => {
        const deletedSet = new Set(Array.isArray(m.deleted_for) ? m.deleted_for : [])
        deletedSet.add(userId)
        return { ...m, deleted_for: Array.from(deletedSet) }
      })
      return { ...prev, [threadId]: next }
    })
  }, [])

  const markMessageDeletedForUser = useCallback((threadId: string, messageId: string, userId: string) => {
    setMessages(prev => {
      const current = prev[threadId] || []
      const next = current.map((m) => {
        if (m.id !== messageId) return m
        const deletedSet = new Set(Array.isArray(m.deleted_for) ? m.deleted_for : [])
        deletedSet.add(userId)
        return { ...m, deleted_for: Array.from(deletedSet) }
      })
      return { ...prev, [threadId]: next }
    })
  }, [])

  const startChatWithMembers = useCallback(async (
    participants: ChatParticipant[],
    options?: ThreadOptions
  ): Promise<string | null> => {
    if (!currentUser) {
      console.error('Cannot start chat: no current user')
      return null
    }

    try {
      const threadId = await supabaseMessagingService.createThread(currentUser, {
        participant_ids: options?.participant_ids || participants.map(p => p.id),
        type: options?.type,
        title: options?.name,
        name: options?.name,
        group_id: options?.group_id,
        metadata: options?.metadata,
      })

      if (!threadId) {
        console.error('Failed to create thread')
        return null
      }

      const userThreads = await supabaseMessagingService.getUserThreads(currentUser)
      const createdThread = userThreads.find(t => t.id === threadId)

      let threadToAdd: ChatThread | null = null

      if (createdThread) {
        threadToAdd = createdThread
        setThreads(prev => {
          const exists = prev.find(t => t.id === threadId)
          if (exists) return prev
          return [...prev, createdThread]
        })
      } else {
        const tempThread: ChatThread = {
          id: threadId,
          name: options?.name || participants.map(p => p.name).join(', ') || 'Chat',
          type: options?.type || (participants.length > 1 ? 'group' : 'direct'),
          participants: [currentUser, ...participants],
          last_message_preview: null,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          group_id: options?.group_id ?? null,
        }
        threadToAdd = tempThread
        setThreads(prev => {
          const exists = prev.find(t => t.id === threadId)
          if (exists) return prev
          return [...prev, tempThread]
        })
      }

      const shouldOpen = options?.openInDock !== false
      if (shouldOpen && threadToAdd) {
        openThread(threadId)
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chatThreadCreated', { 
          detail: { threadId, participants, options } 
        }))
      }

      return threadId
    } catch (error) {
      console.error('Failed to start chat:', error)
      return null
    }
  }, [currentUser, openThread])

  const startCall = useCallback(async (
    threadId: string,
    type: 'audio' | 'video',
    targetUserId?: string,
    targetUserName?: string,
    targetUserAvatarUrl?: string
  ) => {
    const telemetryBase = {
      threadId,
      type,
      targetUserId: (targetUserId || '').trim() || undefined,
      targetUserName: (targetUserName || '').trim() || undefined,
      targetUserAvatarUrl: (targetUserAvatarUrl || '').trim() || undefined,
    }
    const markCallStartMetric = (event: string, extra?: Record<string, unknown>) => {
      console.info('[call-telemetry]', {
        event,
        ts: Date.now(),
        ...telemetryBase,
        ...extra,
      })
    }
    markCallStartMetric('t0_click_call')

    const lockKey = `${threadId}:${(targetUserId || '').trim() || 'auto'}`
    if (callStartInFlightRef.current.has(lockKey)) {
      throw new Error('Call is already starting. Please wait.')
    }

    const activeCallForThread = callRequestsRef.current[threadId]
    if (activeCallForThread) {
      throw new Error('A call is already active for this chat.')
    }

    callStartInFlightRef.current.add(lockKey)
    try {
      const callId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

      const thread = threads.find((t) => t.id === threadId)
      const cachedParticipantIds = (thread?.participants || [])
        .map((p: any) => p?.id)
        .filter((id: string | undefined) => Boolean(id && id !== currentUser?.id)) as string[]
      let isGroupCall = (thread?.participants?.length || 0) > 2 || thread?.type === 'group'

      let resolvedTargetUserId = (targetUserId || '').trim()
      if (isGroupCall && resolvedTargetUserId) {
        // Group calls should broadcast to all members, not only a single target user.
        resolvedTargetUserId = ''
      }
      if (!isGroupCall && resolvedTargetUserId) {
        if (cachedParticipantIds.length > 0 && !cachedParticipantIds.includes(resolvedTargetUserId)) {
          throw new Error('Recipient ID not found in this chat. Call not sent.')
        }
      } else if (!isGroupCall && cachedParticipantIds.length === 1) {
        resolvedTargetUserId = cachedParticipantIds[0]
      } else if (!isGroupCall) {
        if (cachedParticipantIds.length > 1) {
          isGroupCall = true
          resolvedTargetUserId = ''
        } else if (cachedParticipantIds.length === 1) {
          resolvedTargetUserId = cachedParticipantIds[0]
        } else if (!resolvedTargetUserId) {
          throw new Error('Recipient ID not found. Call not sent.')
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      const roomPayload = {
        ...(resolvedTargetUserId && !isGroupCall
          ? { check_user_ids: [resolvedTargetUserId] }
          : {}),
        include_participant_token: true,
      }
      const roomResponse = await fetch('/api/videosdk/room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(roomPayload),
      })

      if (!roomResponse.ok) {
        const errBody = (await roomResponse.json().catch(() => ({}))) as {
          error?: string
          message?: string
        }
        const msg =
          typeof errBody.error === 'string'
            ? errBody.error
            : typeof errBody.message === 'string'
              ? errBody.message
              : 'Failed to create call room. Please try again.'
        throw new Error(msg)
      }

      const roomData = await roomResponse.json()
      const roomId = roomData.roomId
      const token = typeof roomData.token === 'string' ? roomData.token : undefined
      markCallStartMetric('room_created', { roomId })
      
      if (!roomId) {
        throw new Error('Failed to create call room. Please try again.')
      }

      const callRequest: CallRequest = {
        threadId,
        type,
        callerId: currentUser?.id || '',
        callerName: currentUser?.name || 'Unknown',
        roomId,
        token,
        targetUserId: resolvedTargetUserId,
        callId,
        isGroupCall,
      }

      // Persist call_sessions before opening the popup so end/missed/declined PATCH never hits 404.
      await apiClient.post(`/api/chat/threads/${threadId}/call-sessions`, {
        call_id: callId,
        call_type: type,
        room_id: roomId,
        token,
        target_user_id: resolvedTargetUserId || undefined,
        is_group_call: isGroupCall,
        caller_name: currentUser?.name || 'Unknown',
        caller_avatar_url: currentUser?.avatarUrl || '',
      })

      setCallRequests(prev => ({
        ...prev,
        [threadId]: callRequest
      }))

      if (typeof window !== 'undefined') {
        if (token && callId) {
          try {
            sessionStorage.setItem(
              `videosdk_call_bootstrap:${callId}`,
              JSON.stringify({ token }),
            )
          } catch {
            /* ignore quota or private mode */
          }
        }

        openCallWindow({
          roomId,
          callType: type,
          threadId,
          isGroupCall,
          isIncoming: false,
          callerId: currentUser?.id,
          callId,
        })

        window.dispatchEvent(new CustomEvent('startCall', {
          detail: {
            threadId,
            type,
            meetingId: roomId,
            participantId: currentUser?.id,
            participantName: currentUser?.name,
            callId,
            telemetry: {
              t0ClickCallTs: Date.now(),
              roomCreatedTs: Date.now(),
            },
          }
        }))
      }
    } catch (error) {
      console.error('Failed to start call:', error)
      if (typeof window !== 'undefined') {
        const msg =
          error instanceof Error ? error.message : 'Could not start the call.'
        toast.error(msg)
      }
      throw error
    } finally {
      callStartInFlightRef.current.delete(lockKey)
    }
  }, [currentUser, threads])

  const clearCallRequest = useCallback((threadId: string) => {
    setCallRequests(prev => {
      const updated = { ...prev }
      delete updated[threadId]
      return updated
    })
  }, [])

  const tryDispatchIncomingFromCallSession = useCallback(
    (row: Record<string, any>) => {
      if (!currentUser) return
      if (row.created_by === currentUser.id) return
      if (row.status !== 'ringing' && row.status !== 'initiated') return
      const meta = parseCallSessionMetadata(row.metadata)
      if (meta.targetUserId && meta.targetUserId !== currentUser.id) return
      const roomId = (row.room_id as string) || (meta.roomId as string)
      const callType = (row.call_type as string) || (meta.callType as string)
      const callId = (row.call_id as string) || (meta.callId as string)
      if (!roomId || !callType || !callId) return
      const existing = callRequestsRef.current[row.thread_id]
      if (existing?.callId === callId) return
      if (dispatchedIncomingCallIdsRef.current.has(callId)) return
      dispatchedIncomingCallIdsRef.current.add(callId)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('incomingCall', {
            detail: {
              threadId: row.thread_id,
              type: callType,
              callerId: row.created_by,
              callerName: (meta.callerName as string) || 'Unknown',
              callerAvatarUrl: meta.callerAvatarUrl as string | undefined,
              roomId,
              token: meta.token as string | undefined,
              targetUserId: meta.targetUserId as string | undefined,
              callId,
              isGroupCall: meta.isGroupCall === true,
            },
          })
        )
      }
    },
    [currentUser]
  )

  // Listen for incoming call requests (from WebSocket/Realtime)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleIncomingCall = (event: CustomEvent) => {
      const { threadId, type, callerId, callerName, callerAvatarUrl, roomId, targetUserId, callId, isGroupCall } = event.detail
      if (targetUserId && currentUser?.id && targetUserId !== currentUser.id) return

      setCallRequests(prev => {
        const cur = prev[threadId]
        if (
          cur &&
          cur.callId === callId &&
          cur.roomId === roomId &&
          cur.callerId === callerId
        ) {
          return prev
        }
        return {
          ...prev,
          [threadId]: {
            threadId,
            type,
            callerId,
            callerName,
            callerAvatarUrl,
            roomId,
            targetUserId,
            callId,
            isGroupCall,
          },
        }
      })
    }

    window.addEventListener('incomingCall', handleIncomingCall as EventListener)
    
    return () => {
      window.removeEventListener('incomingCall', handleIncomingCall as EventListener)
    }
  }, [currentUser?.id])

  useEffect(() => {
    const loadMessagesForThreads = async () => {
      if (!currentUser || openThreads.length === 0) return

      for (const threadId of openThreads) {
        try {
          const threadMessages = await supabaseMessagingService.getThreadMessages(threadId)
          setMessages(prev => {
            const current = prev[threadId] || []
            if (current.length === 0) {
              return {
                ...prev,
                [threadId]: threadMessages,
              }
            }

            // Merge paged API load with realtime updates to avoid clobbering latest messages.
            const mergedMap = new Map<string, ChatMessage>()
            current.forEach((msg) => mergedMap.set(msg.id, msg))
            threadMessages.forEach((msg) => mergedMap.set(msg.id, msg))
            const merged = Array.from(mergedMap.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )

            return {
              ...prev,
              [threadId]: merged,
            }
          })
        } catch (error) {
          console.error(`Error loading messages for thread ${threadId}:`, error)
        }
      }
    }

    loadMessagesForThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, openThreads.join(',')])

  useEffect(() => {
    if (!currentUser) return

    const unsubscribeCallbacks: (() => void)[] = []

    openThreads.forEach(threadId => {
      const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
        setMessages(prev => {
          const current = prev[threadId] || []
          if (current.some(m => m.id === message.id)) {
            return prev
          }
          return { ...prev, [threadId]: [...current, message] }
        })

        // Incoming calls use call_sessions + tryDispatchIncomingFromCallSession only (no chat_messages).
        // Clear call request when call finishes (missed or ended) so UI updates for both parties.
        const mt = toCallSessionStatusMessageType(message.message_type || '')
        if (mt === 'missed' || mt === 'ended' || mt === 'failed') {
          clearCallRequest(threadId)
        }
        if (mt === 'active') {
          const metadata = (message.metadata || {}) as any
          if (metadata?.acceptedBy && metadata.acceptedBy === currentUser.id) {
            clearCallRequest(threadId)
          }
        }
        if (mt === 'declined') {
          const metadata = (message.metadata || {}) as any
          if (metadata?.rejectedBy && metadata.rejectedBy === currentUser.id) {
            clearCallRequest(threadId)
          }
        }
      }, currentUser)
      unsubscribeCallbacks.push(unsubscribe)
    })

    return () => {
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe())
    }
  }, [currentUser, openThreads, clearCallRequest])

  useEffect(() => {
    if (!currentUser) return

    const channel = supabase
      .channel('message_reads_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads'
        },
        async (payload) => {
          const readReceipt = payload.new as { message_id: string; user_id: string }
          
          setMessages(prev => {
            const updated: Record<string, ChatMessage[]> = {}
            let hasChanges = false

            Object.entries(prev).forEach(([threadId, threadMessages]) => {
              const messageIndex = threadMessages.findIndex(m => m.id === readReceipt.message_id)
              if (messageIndex !== -1) {
                const message = threadMessages[messageIndex]
                const updatedReadBy = message.read_by || []
                
                if (!updatedReadBy.includes(readReceipt.user_id)) {
                  const updatedMessage = {
                    ...message,
                    read_by: [...updatedReadBy, readReceipt.user_id]
                  }
                  updated[threadId] = [
                    ...threadMessages.slice(0, messageIndex),
                    updatedMessage,
                    ...threadMessages.slice(messageIndex + 1)
                  ]
                  hasChanges = true
                } else {
                  updated[threadId] = threadMessages
                }
              } else {
                updated[threadId] = threadMessages
              }
            })

            return hasChanges ? updated : prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return

    const channelName = `global-call-sessions:${currentUser.id}:${Date.now().toString(36)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_sessions' },
        (payload) => {
          const row = payload.new as Record<string, any>
          // RLS on call_sessions already limits events to threads this user participates in.
          tryDispatchIncomingFromCallSession(row)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'call_sessions' },
        (payload) => {
          const row = payload.new as Record<string, any>
          const meta = parseCallSessionMetadata(row.metadata)
          const st = String(row.status || '')
          const lsRaw = meta.last_signal as string | undefined
          const lsNorm = lsRaw ? toCallSessionStatusMessageType(String(lsRaw)) : ''
          if (meta.acceptedBy === currentUser.id && (st === 'active' || lsNorm === 'active')) {
            clearCallRequest(row.thread_id)
          }
          if (meta.rejectedBy === currentUser.id && (st === 'declined' || lsNorm === 'declined')) {
            clearCallRequest(row.thread_id)
          }
          if (
            st === 'ended' ||
            st === 'missed' ||
            st === 'failed' ||
            lsNorm === 'ended' ||
            lsNorm === 'missed' ||
            lsNorm === 'failed'
          ) {
            clearCallRequest(row.thread_id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, clearCallRequest, tryDispatchIncomingFromCallSession])

  // Pause poll while user is in an active call (popup notifies opener via CALL_STATUS).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'CALL_STATUS' && event.data?.status === 'active') {
        pauseIncomingCallsPollRef.current = true
      }
      if (event.data?.type === 'CALL_STATUS' && event.data?.status === 'ended') {
        pauseIncomingCallsPollRef.current = false
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Event-driven fallback for incoming calls (Realtime is primary).
  // Avoid continuous polling; only perform one initial check and on visibility/focus wake-ups.
  // useEffect(() => {
  //   if (!currentUser) return
  //   // Dedicated call window runs the same provider; do not poll for incoming calls there.
  //   if (typeof window !== 'undefined' && window.location.pathname.startsWith('/call/')) return
  //   let cancelled = false

  //   const tick = async () => {
  //     if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  //     if (pauseIncomingCallsPollRef.current) return
  //     try {
  //       const res = await apiClient.get<{ sessions: Record<string, any>[] }>('/api/chat/calls/incoming')
  //       if (cancelled) return
  //       const sessions = res?.sessions ?? []
  //       for (const row of sessions) {
  //         tryDispatchIncomingFromCallSession(row)
  //       }
  //     } catch {
  //       /* ignore */
  //     }
  //   }

  //   const onVisible = () => {
  //     if (document.visibilityState === 'visible') void tick()
  //   }
  //   const onFocus = () => {
  //     void tick()
  //   }

  //   const initial = window.setTimeout(() => {
  //     void tick()
  //   }, 800)

  //   document.addEventListener('visibilitychange', onVisible)
  //   window.addEventListener('focus', onFocus)

  //   return () => {
  //     cancelled = true
  //     window.clearTimeout(initial)
  //     document.removeEventListener('visibilitychange', onVisible)
  //     window.removeEventListener('focus', onFocus)
  //   }
  // }, [currentUser, tryDispatchIncomingFromCallSession])

  const value: ProductionChatContextType = {
    startChatWithMembers,
    openThread,
    startCall,
    callRequests,
    currentUser,
    clearCallRequest,
    openThreads,
    closeThread,
    getThreadById,
    getMessagesForThread,
    sendMessage,
    minimizedThreadIds,
    markThreadRead,
    threads,
    clearMessagesForUser,
    markMessageDeletedForUser,
    setMessagesForThread
  }

  return (
    <ProductionChatContext.Provider value={value}>
      {children}
    </ProductionChatContext.Provider>
  )
}

