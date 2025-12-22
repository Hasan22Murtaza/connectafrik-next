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
      // ✅ FIXED: Generate real VideoSDK token from Next.js API route
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Get auth token if available
      let authToken: string | undefined
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        authToken = sessionData.session?.access_token
      } catch (error) {
        console.warn('⚠️ Could not get auth session:', error)
      }

      // Get real token from Next.js API route (not Supabase Edge Function)
      const response = await fetch('/api/videosdk/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          roomId,
          userId: currentUser?.id || ''
        }
      })

      if (error || !data?.token) {
        console.error('Failed to generate VideoSDK token:', error)
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
          // Avoid duplicates
          if (current.some(m => m.id === message.id)) {
            return prev
          }
          return { ...prev, [threadId]: [...current, message] }
        })
      })
      unsubscribeCallbacks.push(unsubscribe)
    })

    return () => {
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe())
    }
  }, [currentUser, openThreads])

  // ✅ CRITICAL: Subscribe to call_request messages from all threads user is part of
  // This is needed because call requests can come from any thread the user is part of
  useEffect(() => {
    if (!currentUser) return

    console.log('📞 Setting up call request listener for user:', currentUser.id)
    
    const unsubscribeCallbacks: (() => void)[] = []
    const subscribedThreadIds = new Set<string>()

    // Function to subscribe to a thread for call requests
    const subscribeToThreadForCalls = (threadId: string) => {
      if (subscribedThreadIds.has(threadId)) {
        return // Already subscribed
      }
      subscribedThreadIds.add(threadId)
      
      const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message: ChatMessage) => {
        // Handle call_request messages - update callRequests state
        if (message.message_type === 'call_request' && message.metadata) {
          const metadata = message.metadata as any
          const callerId = metadata.callerId || message.sender_id
          
          // Only process if this is not from the current user
          if (callerId !== currentUser.id) {
            console.log('📞 Incoming call request received:', {
              threadId: message.thread_id,
              callerId,
              callerName: metadata.callerName || message.sender?.name || 'Unknown',
              callType: metadata.callType || 'video',
              roomId: metadata.roomId
            })
            
            const callRequest: CallRequest = {
              threadId: message.thread_id,
              type: metadata.callType || 'video',
              callerId: callerId,
              callerName: metadata.callerName || message.sender?.name || 'Unknown',
              roomId: metadata.roomId,
              token: metadata.token // This will be ignored - receiver generates their own
            }

            setCallRequests(prev => ({
              ...prev,
              [message.thread_id]: callRequest
            }))

            // Also dispatch incomingCall event for backward compatibility
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('incomingCall', {
                detail: callRequest
              }))
            }
          }
        }

        // Also update messages state if thread is open
        if (openThreads.includes(message.thread_id)) {
          setMessages(prev => {
            const current = prev[message.thread_id] || []
            // Avoid duplicates
            if (current.some(m => m.id === message.id)) {
              return prev
            }
            return { ...prev, [message.thread_id]: [...current, message] }
          })
        }
      })
      unsubscribeCallbacks.push(unsubscribe)
    }

    // Subscribe to all existing threads
    const setupCallRequestListener = async () => {
      try {
        const userThreads = await supabaseMessagingService.getUserThreads(currentUser)
        console.log('📞 Found', userThreads.length, 'threads for call request listening')
        
        // Subscribe to each thread to catch call_request messages
        userThreads.forEach(thread => {
          subscribeToThreadForCalls(thread.id)
        })
        
        // Also update threads state so UI can show them
        setThreads(userThreads)
      } catch (error) {
        console.error('❌ Error setting up call request listener:', error)
      }
    }

    setupCallRequestListener()

    // Also subscribe to threads as they're added to the threads state
    threads.forEach(thread => {
      subscribeToThreadForCalls(thread.id)
    })

    return () => {
      console.log('📞 Cleaning up call request listeners')
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe())
      subscribedThreadIds.clear()
    }
  }, [currentUser, openThreads, threads])

  // ✅ FALLBACK: Also listen directly to Supabase realtime for call_request messages
  // This ensures we catch call requests even if thread subscription hasn't been set up yet
  useEffect(() => {
    if (!currentUser) return

    console.log('📞 Setting up direct Supabase realtime listener for call requests')
    
    // Subscribe to Supabase realtime channel for messages
    const channel = supabase
      .channel('call-requests-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `message_type=eq.call_request`
        },
        async (payload) => {
          const message = payload.new as any
          console.log('📞 Direct realtime call_request received:', message.thread_id)
          
          // Check if user is a participant
          const { data: participant } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('thread_id', message.thread_id)
            .eq('user_id', currentUser.id)
            .maybeSingle()
          
          if (!participant) {
            console.log('📞 User is not a participant in this thread, ignoring call request')
            return
          }
          
          // Check if this is not from current user
          const metadata = message.metadata || {}
          const callerId = metadata.callerId || message.sender_id
          if (callerId === currentUser.id) {
            console.log('📞 Call request is from current user, ignoring')
            return
          }
          
          // Fetch full message with sender info
          const { data: fullMessage } = await supabase
            .from('chat_messages')
            .select(`
              *,
              sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
            `)
            .eq('id', message.id)
            .single()
          
          if (fullMessage) {
            const fullMetadata = fullMessage.metadata as any || {}
            console.log('📞 Processing call request from direct realtime listener:', {
              threadId: fullMessage.thread_id,
              callerId: fullMetadata.callerId || fullMessage.sender_id,
              roomId: fullMetadata.roomId
            })
            
            const callRequest: CallRequest = {
              threadId: fullMessage.thread_id,
              type: fullMetadata.callType || 'video',
              callerId: fullMetadata.callerId || fullMessage.sender_id,
              callerName: fullMetadata.callerName || 'Unknown',
              roomId: fullMetadata.roomId,
              token: fullMetadata.token // This will be ignored - receiver generates their own
            }

            setCallRequests(prev => {
              // Avoid duplicates
              if (prev[fullMessage.thread_id]) {
                console.log('📞 Call request already exists for this thread, skipping')
                return prev
              }
              console.log('📞 Adding call request to state:', callRequest)
              return {
                ...prev,
                [fullMessage.thread_id]: callRequest
              }
            })
          }
        }
      )
      .subscribe((status) => {
        console.log('📞 Supabase realtime subscription status:', status)
      })

    return () => {
      console.log('📞 Cleaning up direct Supabase realtime listener')
      supabase.removeChannel(channel)
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

