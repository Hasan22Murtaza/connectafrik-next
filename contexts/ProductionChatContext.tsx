'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ChatMessage, ChatThread, supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'

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

  const currentUser = user ? { id: user.id, name: user.user_metadata?.full_name || user.email } : null

  const updatePresence = useCallback((userId: string, status: 'online' | 'away' | 'busy' | 'offline') => {
    setPresence(prev => ({
      ...prev,
      [userId]: status
    }))
  }, [])

  const openThread = useCallback((threadId: string) => {
    setOpenThreads(prev => {
      if (!prev.includes(threadId)) {
        return [...prev, threadId]
      }
      return prev
    })
    // Dispatch custom event to open chat dock
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openChatThread', { detail: { threadId } }))
    }
  }, [])

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
      // Persist message via supabaseMessagingService
      const message = await supabaseMessagingService.sendMessage(threadId, {
        content: text,
        attachments: payload?.attachments,
        reply_to_id: payload?.reply_to_id,
        message_type: payload?.message_type,
        metadata: payload?.metadata,
      }, currentUser)

      // Update local messages state
      setMessages(prev => {
        const current = prev[threadId] || []
        // Check if message already exists (avoid duplicates)
        if (current.some(m => m.id === message.id)) {
          return prev
        }
        return { ...prev, [threadId]: [...current, message] }
      })
    } catch (error) {
      console.error('Error sending message:', error)
      // Fallback: add message to local state even if persistence fails
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

  const markThreadRead = useCallback((threadId: string) => {
    // Placeholder: in production, update unread counts in storage
  }, [])

  const minimizedThreadIds: string[] = []

  const startChatWithMembers = useCallback(async (
    participants: ChatParticipant[],
    options?: ThreadOptions
  ): Promise<string | null> => {
    if (!currentUser) {
      console.error('Cannot start chat: no current user')
      return null
    }

    try {
      // Create thread in database using supabaseMessagingService
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

      // Fetch the created thread to get full details
      const userThreads = await supabaseMessagingService.getUserThreads(currentUser)
      const createdThread = userThreads.find(t => t.id === threadId)

      if (createdThread) {
        // Add thread to threads state
        setThreads(prev => {
          const exists = prev.find(t => t.id === threadId)
          if (exists) return prev
          return [...prev, createdThread]
        })
      } else {
        // If thread not found, create a temporary thread object
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
        setThreads(prev => {
          const exists = prev.find(t => t.id === threadId)
          if (exists) return prev
          return [...prev, tempThread]
        })
      }

      // Open the thread if requested (default to true if not specified)
      const shouldOpen = options?.openInDock !== false
      if (shouldOpen) {
        openThread(threadId)
      }

      // Dispatch event for chat system to handle
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
      // ✅ FIXED: Create room first via VideoSDK API, then get token
      console.log('📞 Creating VideoSDK room...')
      const roomResponse = await fetch('/api/videosdk/room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!roomResponse.ok) {
        const errorData = await roomResponse.json().catch(() => ({}))
        console.error('Failed to create VideoSDK room:', errorData)
        throw new Error(errorData.error || 'Failed to create call room. Please try again.')
      }

      const roomData = await roomResponse.json()
      const roomId = roomData.roomId
      
      if (!roomId) {
        console.error('Invalid response from room API:', roomData)
        throw new Error('Failed to create call room. Please try again.')
      }

      console.log('✅ VideoSDK room created:', roomId)
      
      // Get real token from our API endpoint
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
        console.error('Failed to generate VideoSDK token:', errorData)
        throw new Error(errorData.error || 'Failed to generate call token. Please try again.')
      }

      const data = await response.json()
      console.log('VideoSDK token data:255', data)
      if (!data?.token) {
        console.error('Invalid response from token API:', data)
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

      // Dispatch event to start the call
      if (typeof window !== 'undefined') {
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

      // ✅ Send call notification to recipient via Supabase Realtime
      // This should be handled by your messaging service to notify the other participant
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

  // Load messages for open threads
  useEffect(() => {
    const loadMessagesForThreads = async () => {
      if (!currentUser || openThreads.length === 0) return

      for (const threadId of openThreads) {
        try {
          // Always fetch latest messages when thread opens
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

  // Subscribe to new messages for open threads
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
            console.log('📞 Incoming call request detected in open thread:', threadId)
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
      })
      unsubscribeCallbacks.push(unsubscribe)
    })

    return () => {
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe())
    }
  }, [currentUser, openThreads])

  useEffect(() => {
    if (!currentUser) return

    const unsubscribeCallbacks: (() => void)[] = []
    const subscribedThreadIds = new Set<string>()

    const subscribeToThreadForCalls = (threadId: string) => {
      if (subscribedThreadIds.has(threadId)) {
        return
      }

      subscribedThreadIds.add(threadId)
      const messageUnsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
        if (message.message_type === 'call_request' && message.sender_id !== currentUser.id) {
          const metadata = message.metadata as any
          if (metadata?.roomId && metadata?.callType) {
            console.log('📞 Incoming call request detected (global subscription):', {
              threadId: threadId,
              callerId: message.sender_id,
              callerName: message.sender?.name || metadata?.callerName || 'Unknown',
              type: metadata.callType,
              roomId: metadata.roomId,
              token: metadata.token
            })

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
      })
      unsubscribeCallbacks.push(messageUnsubscribe)
    }

    const setupGlobalCallListener = async () => {
      try {
        const userThreads = await supabaseMessagingService.getUserThreads(currentUser)
        userThreads.forEach(thread => {
          subscribeToThreadForCalls(thread.id)
        })
      } catch (error) {
        console.error('Error setting up global call listener:', error)
      }
    }

    const threadUnsubscribe = supabaseMessagingService.subscribeToUserThreads(currentUser, (thread) => {
      subscribeToThreadForCalls(thread.id)
    })
    unsubscribeCallbacks.push(threadUnsubscribe)

    setupGlobalCallListener()

    return () => {
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe())
      subscribedThreadIds.clear()
    }
  }, [currentUser])

  // Update current user's presence to online when component mounts
  useEffect(() => {
    if (user?.id) {
      updatePresence(user.id, 'online')
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
    threads
  }

  return (
    <ProductionChatContext.Provider value={value}>
      {children}
    </ProductionChatContext.Provider>
  )
}

