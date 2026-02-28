'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ChatMessage, ChatThread, supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import {
  initializePresence,
  updatePresence as updatePresenceStatus,
  subscribeToPresenceChanges,
  cleanup as cleanupPresence,
} from '@/shared/services/presenceService'

interface ChatParticipant {
  id: string
  name: string
  avatarUrl?: string
}

interface ThreadOptions {
  participant_ids?: string[]
  type?: 'direct' | 'group'
  name?: string
  metadata?: Record<string, any>
  openInDock?: boolean
}

interface CallRequest {
  threadId: string
  type: 'audio' | 'video'
  callerId: string
  callerName?: string
  roomId?: string
  token?: string
}

interface ProductionChatContextType {
  presence: Record<string, 'online' | 'away' | 'busy' | 'offline'>
  updatePresence: (userId: string, status: 'online' | 'away' | 'busy' | 'offline') => void
  startChatWithMembers: (participants: ChatParticipant[], options?: ThreadOptions) => Promise<string | null>
  openThread: (threadId: string) => void
  startCall: (threadId: string, type: 'audio' | 'video') => Promise<void>
  callRequests: Record<string, CallRequest>
  currentUser: { id: string; name?: string } | null
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
  setMessagesForThread: (threadId: string, messages: ChatMessage[]) => void
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
  const [presence, setPresence] = useState<Record<string, 'online' | 'away' | 'busy' | 'offline'>>({})
  const [callRequests, setCallRequests] = useState<Record<string, CallRequest>>({})
  const [openThreads, setOpenThreads] = useState<string[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})

  const displayName =
    user?.user_metadata?.full_name ||
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ||
    user?.email
  const currentUser = user ? { id: user.id, name: displayName || user.email } : null
  const updatePresence = useCallback((userId: string, status: 'online' | 'away' | 'busy' | 'offline') => {
    setPresence(prev => ({
      ...prev,
      [userId]: status
    }))
  }, [])

  const openThread = useCallback(async (threadId: string) => {
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

  const startCall = useCallback(async (threadId: string, type: 'audio' | 'video') => {
    try {
      const roomResponse = await fetch('/api/videosdk/room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!roomResponse.ok) {
        const errorData = await roomResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create call room. Please try again.')
      }

      const roomData = await roomResponse.json()
      const roomId = roomData.roomId
      
      if (!roomId) {
        throw new Error('Failed to create call room. Please try again.')
      }
      
      const response = await fetch('/api/videosdk/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId: currentUser?.id || ''
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate call token. Please try again.')
      }

      const data = await response.json()
      if (!data?.token) {
        throw new Error('Failed to generate call token. Please try again.')
      }

      const token = data.token as string

      const callRequest: CallRequest = {
        threadId,
        type,
        callerId: currentUser?.id || '',
        callerName: currentUser?.name || 'Unknown',
        roomId,
        token
      }

      setCallRequests(prev => ({
        ...prev,
        [threadId]: callRequest
      }))

      // Open new call window for the caller (like Facebook)
      if (typeof window !== 'undefined') {
        const { openCallWindow } = await import('@/shared/utils/callWindow')
        
        // Get recipient/group name from thread
        const userThreads = await supabaseMessagingService.getUserThreads(currentUser)
        const thread = userThreads.find(t => t.id === threadId)
        const isGroupCall = (thread?.participants?.length || 0) > 2
        const recipientName = isGroupCall
          ? (thread?.name || 'Group Call')
          : (thread?.participants?.find((p: any) => p.id !== currentUser?.id)?.name || 'Unknown')

        openCallWindow({
          roomId,
          callType: type,
          threadId,
          callerName: currentUser?.name || 'Unknown',
          recipientName,
          isIncoming: false,
          callerId: currentUser?.id
        })

        window.dispatchEvent(new CustomEvent('startCall', {
          detail: {
            threadId,
            type,
            meetingId: roomId,
            token,
            participantId: currentUser?.id,
            participantName: currentUser?.name
          }
        }))
      }
      console.log('Sending call request message', currentUser?.name)
      try {
        await supabaseMessagingService.sendMessage(
          threadId,
          {
            content: `📞 Incoming ${type === 'video' ? 'video' : 'audio'} call`,
            message_type: 'call_request',
            metadata: {
              callType: type,
              roomId,
              token,
              callerId: currentUser?.id,
              callerName: currentUser?.name,
              timestamp: new Date().toISOString()
            }
          },
          { id: currentUser?.id || '', name: currentUser?.name || 'Unknown' }
        )
      } catch (msgError) {
        console.warn('⚠️ Failed to send call notification:', msgError)
        // Don't fail the call if message sending fails
      }
    } catch (error) {
      console.error('Failed to start call:', error)
      throw error // Re-throw so caller can handle it
    }
  }, [currentUser])

  const clearCallRequest = useCallback((threadId: string) => {
    setCallRequests(prev => {
      const updated = { ...prev }
      delete updated[threadId]
      return updated
    })
  }, [])

  // Listen for incoming call requests (from WebSocket/Realtime)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleIncomingCall = (event: CustomEvent) => {
      const { threadId, type, callerId, callerName, roomId, token } = event.detail
      
      setCallRequests(prev => ({
        ...prev,
        [threadId]: {
          threadId,
          type,
          callerId,
          callerName,
          roomId,
          token
        }
      }))
    }

    window.addEventListener('incomingCall', handleIncomingCall as EventListener)
    
    return () => {
      window.removeEventListener('incomingCall', handleIncomingCall as EventListener)
    }
  }, [])

  useEffect(() => {
    const loadMessagesForThreads = async () => {
      if (!currentUser || openThreads.length === 0) return

      for (const threadId of openThreads) {
        try {
          const threadMessages = await supabaseMessagingService.getThreadMessages(threadId)
          setMessages(prev => ({
            ...prev,
            [threadId]: threadMessages
          }))
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

        if (message.message_type === 'call_request' && message.sender_id !== currentUser.id) {
          const metadata = message.metadata as any
          if (metadata?.roomId && metadata?.callType) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('incomingCall', {
                detail: {
                  threadId: threadId,
                  type: metadata.callType,
                  callerId: message.sender_id,
                  callerName: message.sender?.name || metadata?.callerName || 'Unknown',
                  roomId: metadata.roomId,
                  token: metadata.token
                }
              }))
            }
          }
        }
        // Clear call request when call ended message is received (so UI updates for both parties)
        if (message.message_type === 'call_ended') {
          clearCallRequest(threadId)
        }
      })
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

    const channel = supabase
      .channel('global-call-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: 'message_type=eq.call_request'
        },
        async (payload) => {
          const msg = payload.new as any
          if (msg.sender_id === currentUser.id) return

          // Guard against cross-thread/cross-team ringing:
          // only dispatch incoming calls for threads the current user can access.
          try {
            await apiClient.get<{ data: unknown }>(`/api/chat/threads/${msg.thread_id}`)
          } catch {
            return
          }

          const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
          if (metadata?.roomId && metadata?.callType) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('incomingCall', {
                detail: {
                  threadId: msg.thread_id,
                  type: metadata.callType,
                  callerId: msg.sender_id,
                  callerName: metadata.callerName || 'Unknown',
                  roomId: metadata.roomId,
                  token: metadata.token
                }
              }))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser])

  useEffect(() => {
    if (!user?.id) return

    const unsubscribe = subscribeToPresenceChanges((userId, status, lastSeen) => {
      updatePresence(userId, status)
    })

    return () => {
      unsubscribe()
    }
  }, [user?.id, updatePresence])

  useEffect(() => {
    if (!user?.id) return

    initializePresence(user.id).then(() => {
      updatePresence(user.id, 'online')
    })

    return () => {
      cleanupPresence(user.id)
    }
  }, [user?.id, updatePresence])

  const value: ProductionChatContextType = {
    presence,
    updatePresence,
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
    setMessagesForThread
  }

  return (
    <ProductionChatContext.Provider value={value}>
      {children}
    </ProductionChatContext.Provider>
  )
}

