'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ChatMessage, ChatThread } from '@/features/chat/services/supabaseMessagingService'
import { useAuth } from './AuthContext'

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
    window.dispatchEvent(new CustomEvent('openChatThread', { detail: { threadId } }))
  }, [])

  const closeThread = useCallback((threadId: string) => {
    setOpenThreads(prev => prev.filter(id => id !== threadId))
    window.dispatchEvent(new CustomEvent('closeChatThread', { detail: { threadId } }))
  }, [])

  const getThreadById = useCallback((threadId: string) => {
    return threads.find(t => t.id === threadId)
  }, [threads])

  const getMessagesForThread = useCallback((threadId: string) => {
    return messages[threadId] || []
  }, [messages])

  const sendMessage = useCallback(async (threadId: string, text: string, payload?: any) => {
    // In a fuller implementation this would persist via supabaseMessagingService
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      thread_id: threadId,
      sender_id: currentUser?.id || '',
      content: text,
      created_at: new Date().toISOString(),
      ...payload,
    }
    setMessages(prev => {
      const current = prev[threadId] || []
      return { ...prev, [threadId]: [...current, message] }
    })
  }, [currentUser?.id])

  const markThreadRead = useCallback((threadId: string) => {
    // Placeholder: in production, update unread counts in storage
  }, [])

  const minimizedThreadIds: string[] = []

  const startChatWithMembers = useCallback(async (
    participants: ChatParticipant[],
    options?: ThreadOptions
  ): Promise<string | null> => {
    try {
      // Generate a thread ID (in production, this would be created in the database)
      const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Store thread info (in production, this would be stored in database)
      const threadData = {
        id: threadId,
        participants,
        options,
        createdAt: new Date().toISOString()
      }

      // Open the thread if requested
      if (options?.openInDock) {
        openThread(threadId)
      }

      // Dispatch event for chat system to handle
      window.dispatchEvent(new CustomEvent('chatThreadCreated', { detail: threadData }))

      return threadId
    } catch (error) {
      console.error('Failed to start chat:', error)
      return null
    }
  }, [openThread])

  const startCall = useCallback(async (threadId: string, type: 'audio' | 'video') => {
    try {
      // In production, this would generate a VideoSDK token and room ID
      // For now, we'll create a mock call request
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const token = `token_${Date.now()}` // In production, fetch from VideoSDK

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

      // Also dispatch to the other participant(s) via WebSocket/Realtime
      // This would be handled by your realtime service
    } catch (error) {
      console.error('Failed to start call:', error)
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
    markThreadRead
  }

  return (
    <ProductionChatContext.Provider value={value}>
      {children}
    </ProductionChatContext.Provider>
  )
}

