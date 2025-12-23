'use client'
// @ts-nocheck

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Minus, Phone, Send, Video, X, Paperclip, Check, MoreVertical } from 'lucide-react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { useMembers } from '@/shared/hooks/useMembers'
import type { PresenceStatus } from '@/shared/types/chat'
import { VideoSDKCallModal, VideoSDKCallModalProps } from '@/features/video/components/VideoSDKCallModal'
import FileAttachment from './FileAttachment'
import FilePreview from './FilePreview'
import { fileUploadService, FileUploadResult } from '@/shared/services/fileUploadService'
import { MessageBubble } from './MessageBubble'
import { supabaseMessagingService, type ChatMessage } from '@/features/chat/services/supabaseMessagingService'
import { toast } from 'react-hot-toast'

interface ChatWindowProps {
  threadId: string
  onClose: (threadId: string) => void
  onMinimize: (threadId: string) => void
}

const formatPresenceLabel = (status?: string) => {
  switch (status) {
    case 'online':
      return 'Active now'
    case 'away':
      return 'Away'
    case 'busy':
      return 'Do not disturb'
    default:
      return 'Offline'
  }
}

const ChatWindow: React.FC<ChatWindowProps> = ({ threadId, onClose, onMinimize }) => {
  const {
    getThreadById,
    getMessagesForThread,
    sendMessage,
    currentUser,
    presence,
    callRequests,
    clearCallRequest,
    minimizedThreadIds,
    openThread,
    startCall,
    markThreadRead,
  } = useProductionChat()

  const { members } = useMembers()

  const memberStatusMap = useMemo(() => {
    const map = new Map<string, PresenceStatus>()
    members.forEach((member) => {
      if (member.status) {
        map.set(member.id, member.status)
      } else if (member.last_seen) {
        map.set(member.id, 'away')
      }
    })
    return map
  }, [members])

  const thread = getThreadById(threadId)
  const messages = getMessagesForThread(threadId)
  const pendingCall = callRequests[threadId]
  const pendingCallType = pendingCall?.type
  const pendingRoomId = pendingCall?.roomId
  const pendingCallerName = pendingCall?.callerName
  const pendingToken = pendingCall?.token
  const pendingCallerId = pendingCall?.callerId
  const currentUserId = currentUser?.id || null

  const otherParticipants = useMemo(
    () => thread?.participants?.filter((p: any) => p.id !== currentUser?.id) || [],
    [thread?.participants, currentUser?.id]
  )
  const primaryParticipant = otherParticipants[0]
  
  // Check if this is a self-chat (user chatting with themselves)
  const isSelfChat = useMemo(() => {
    return thread?.participants?.length === 1 && thread?.participants[0]?.id === currentUser?.id
  }, [thread?.participants, currentUser?.id])

  // Computed thread name
  const displayThreadName = useMemo(() => {
    if (isSelfChat) {
      return `${currentUser?.name || 'You'} (Notes)`
    }
    return primaryParticipant?.name || thread?.name || 'Chat'
  }, [isSelfChat, primaryParticipant?.name, thread?.name, currentUser?.name])

  const participantStatuses = useMemo<PresenceStatus[]>(
    () => otherParticipants.map((participant: any) => presence[participant.id] || 'offline'),
    [otherParticipants, presence]
  )
  const presenceStatus = useMemo<PresenceStatus>(() => {
    if (participantStatuses.some((status) => status === 'online')) return 'online'
    if (participantStatuses.some((status) => status === 'busy')) return 'busy'
    if (participantStatuses.some((status) => status === 'away')) return 'away'
    return 'offline'
  }, [participantStatuses])

  const [draft, setDraft] = useState('')
  const [isCallOpen, setIsCallOpen] = useState(false)
  const [currentCallType, setCurrentCallType] = useState<'audio' | 'video'>('video')
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [isFileAttachmentOpen, setIsFileAttachmentOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<FileUploadResult[]>([])
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null) // Track message being replied to
  const [deleteStates, setDeleteStates] = useState<Map<string, boolean>>(new Map()) // Track which messages can be deleted for everyone
  const [showOptionsMenu, setShowOptionsMenu] = useState(false) // Track options menu visibility
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userInitiatedCall = useRef(false) // Track if user started the call
  const deleteStatesCacheRef = useRef<Map<string, boolean>>(new Map()) // Cache for delete permissions
  const processedMessageIdsRef = useRef<Set<string>>(new Set()) // Track already processed message IDs
  
  // Check delete permissions for each message (only when message list actually changes)
  useEffect(() => {
    if (!currentUser) return

    const checkDeletePermissions = async () => {
      const messagesToCheck = messages.filter((m: ChatMessage) => m.sender_id === currentUser.id && !m.is_deleted)
      let hasNewMessages = false
      
      for (const message of messagesToCheck) {
        // Only check if not already processed
        if (!processedMessageIdsRef.current.has(message.id)) {
          const canDelete = await supabaseMessagingService.canDeleteForEveryone(message.id, currentUser.id)
          deleteStatesCacheRef.current.set(message.id, canDelete)
          processedMessageIdsRef.current.add(message.id)
          hasNewMessages = true
        }
      }
      
      // Only update state if we processed new messages
      if (hasNewMessages) {
        setDeleteStates(new Map(deleteStatesCacheRef.current))
      }
    }

    checkDeletePermissions()
  }, [messages.length, currentUser?.id])

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowOptionsMenu(false)
    if (showOptionsMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showOptionsMenu])

  useEffect(() => {
    if (pendingCallType) {
      const initiatedByCurrentUser = Boolean(
        pendingCallerId && currentUserId && pendingCallerId === currentUserId
      )

      console.log(
        'ChatWindow received pending call:',
        pendingCallType,
        'roomId:',
        pendingRoomId,
        'thread:',
        threadId,
        'currentUser:',
        currentUser?.id,
        'initiatedByCurrentUser:',
        initiatedByCurrentUser,
        'userInitiatedFlag:',
        userInitiatedCall.current
      )

      setCurrentCallType(pendingCallType)
      setIsCallOpen(true)
      if (pendingRoomId) {
        setActiveRoomId(pendingRoomId)
      }
      if (initiatedByCurrentUser) {
        userInitiatedCall.current = true
      }
      setIsIncomingCall(!initiatedByCurrentUser)
    } else if (!userInitiatedCall.current) {
      setIsIncomingCall(false)
      setActiveRoomId(null)
    }
  }, [pendingCallType, pendingRoomId, pendingCallerId, threadId, currentUserId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, threadId])

  // Mark thread as read when messages are viewed or when thread opens
  useEffect(() => {
    if (thread && !minimizedThreadIds.includes(threadId) && messages.length > 0) {
      markThreadRead(threadId)
    }
  }, [threadId, thread, minimizedThreadIds, messages.length, markThreadRead])

  if (!thread) return null

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text && pendingFiles.length === 0) return

    await sendMessage(threadId, text, {
      content: text,
      attachments: pendingFiles,
      reply_to_id: replyingTo?.id, // Include reply reference if replying
    })

    fileUploadService.revokePreviews(pendingFiles)
    setDraft('')
    setPendingFiles([])
    setReplyingTo(null) // Clear reply state after sending
  }

  const handleReply = (message: ChatMessage) => {
    setReplyingTo(message)
    // Focus input (will be handled by input ref)
  }

  const handleDelete = async (messageId: string, deleteForEveryone: boolean) => {
    if (!currentUser) return

    try {
      if (deleteForEveryone) {
        // Check if user can delete for everyone (15 min limit)
        const canDelete = await supabaseMessagingService.canDeleteForEveryone(messageId, currentUser.id)
        if (!canDelete) {
          toast.error('Can only delete for everyone within 15 minutes of sending')
          return
        }
        await supabaseMessagingService.deleteMessageForEveryone(messageId, currentUser.id)
        toast.success('Message deleted for everyone')
      } else {
        await supabaseMessagingService.deleteMessageForMe(messageId, currentUser.id)
        toast.success('Message deleted for you')
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      toast.error(deleteForEveryone ? 'Failed to delete message for everyone' : 'Failed to delete message')
    }
  }

  const handleClearAllMessages = async () => {
    if (!currentUser) return

    const confirmed = window.confirm(
      'Are you sure you want to clear all messages in this chat? This will only clear them for you.'
    )

    if (!confirmed) return

    try {
      // Delete all messages for the current user
      const messagesToDelete = messages.filter((msg: ChatMessage) => !msg.deleted_for?.includes(currentUser.id))

      for (const message of messagesToDelete) {
        await supabaseMessagingService.deleteMessageForMe(message.id, currentUser.id)
      }

      toast.success('All messages cleared')
      setShowOptionsMenu(false)
    } catch (error) {
      console.error('Error clearing messages:', error)
      toast.error('Failed to clear messages')
    }
  }

  const handleStartCall = async (type: 'audio' | 'video') => {
    try {
      console.log('User initiated call:', type, 'threadId:', threadId)
      userInitiatedCall.current = true // Mark that user started this call
      setCurrentCallType(type)
      setIsIncomingCall(false) // Mark as outgoing call
      setIsCallOpen(true)
      
      // The startCall function now handles token fetching and room creation
      await startCall(threadId, type)
      
      // The roomId will be set via the pendingCall state from context
      console.log('✅ Call request sent successfully')
    } catch (error) {
      console.error('Error starting call:', error)
      setIsCallOpen(false)
      setIsIncomingCall(false)
      setActiveRoomId(null)
      userInitiatedCall.current = false
    }
  }

  const handleEndCall = () => {
    console.log('handleEndCall called')
    setIsCallOpen(false)
    setIsIncomingCall(false)
    setCurrentCallType('video')
    setActiveRoomId(null)
    userInitiatedCall.current = false // Reset the flag
    // Clear the call request when call actually ends
    clearCallRequest(threadId)
  }

  const handleFilesSelected = (files: FileUploadResult[]) => {
    setPendingFiles((prev) => [...prev, ...files])
    setIsFileAttachmentOpen(false)
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const target = prev[index]
      if (target) {
        fileUploadService.revokePreviews([target])
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleToggleMinimize = () => {
    if (minimizedThreadIds.includes(threadId)) {
      openThread(threadId)
    } else {
      onMinimize(threadId)
    }
  }

  return (
    <div className="pointer-events-auto flex w-72 sm:w-80 max-w-[90vw] sm:max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center space-x-3">
          <div className="relative h-10 w-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {isSelfChat 
                ? (currentUser?.name || 'Y').charAt(0).toUpperCase()
                : (primaryParticipant?.name || thread.name || 'U').charAt(0).toUpperCase()
              }
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">{displayThreadName}</div>
            <div className="text-xs text-gray-500">
              {isSelfChat 
                ? 'Save messages to yourself'
                : otherParticipants.length > 1
                ? `${otherParticipants.length} participants`
                : formatPresenceLabel(presenceStatus)
              }
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {isCallOpen ? (
            <button onClick={handleEndCall} className="text-red-600 hover:text-red-700" title="End call">
              <Phone className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => handleStartCall('audio')}
                className="text-gray-500 hover:text-[#f97316]"
                title="Start voice call"
              >
                <Phone className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleStartCall('video')}
                className="text-gray-500 hover:text-[#f97316]"
                title="Start video call"
              >
                <Video className="h-4 w-4" />
              </button>
            </>
          )}
          <div className="relative">
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="text-gray-400 hover:text-gray-600"
              title="Options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showOptionsMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[180px]">
                <button
                  onClick={handleClearAllMessages}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm text-red-600"
                >
                  <X className="h-4 w-4" />
                  <span>Clear All Messages</span>
                </button>
              </div>
            )}
          </div>
          <button onClick={handleToggleMinimize} className="text-gray-400 hover:text-gray-600" title="Minimize">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => onClose(threadId)} className="text-gray-400 hover:text-gray-600" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isCallOpen && (
        <div className="flex items-center justify-between bg-primary-50 px-4 py-2 text-xs text-primary-700">
          <span>{currentCallType === 'video' ? 'Video call active' : 'Audio call active'}</span>
          <button onClick={handleEndCall} className="font-semibold hover:text-primary-800">
            End call
          </button>
        </div>
      )}

      <div className="flex max-h-64 sm:max-h-72 flex-1 flex-col space-y-3 sm:space-y-4 overflow-y-auto px-3 sm:px-4 py-2 sm:py-3">
        {messages.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Send a message to kick off the conversation.
          </div>
        ) : (
          messages
            .filter((message) => {
              // Filter out messages deleted for current user
              if (!currentUser) return true
              return !message.deleted_for?.includes(currentUser.id)
            })
            .map((message: ChatMessage) => {
              const isOwn = message.sender_id === currentUser?.id
              const canDeleteForEveryone = deleteStates.get(message.id) ?? false

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwn}
                  currentUserId={currentUser?.id || ''}
                  threadParticipants={thread?.participants?.map((p: any) => p.id) || []}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  canDeleteForEveryone={canDeleteForEveryone}
                />
              )
            })
        )}
        <div ref={messagesEndRef} />
      </div>

      {pendingFiles.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-3">
          <FilePreview files={pendingFiles} onRemove={removePendingFile} />
        </div>
      )}

      <form onSubmit={handleSend} className="border-t border-gray-200 bg-white px-2 sm:px-3 py-2 sm:py-3">
        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-2 border-l-4 border-orange-500">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Replying to {replyingTo.sender?.name || 'Unknown'}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {replyingTo.is_deleted ? '🚫 This message was deleted' : replyingTo.content}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="flex-shrink-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="Cancel reply"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsFileAttachmentOpen(true)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message..."
            className="flex-1 min-w-0 rounded-full border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200"
          />
          <button
            type="submit"
            className="flex h-10 w-10 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800"
            aria-label="Send message"
          >
            <Send className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </form>

      <FileAttachment
        isOpen={isFileAttachmentOpen}
        onClose={() => setIsFileAttachmentOpen(false)}
        onFilesSelected={handleFilesSelected}
      />

      <VideoSDKCallModal
        isOpen={isCallOpen}
        onClose={handleEndCall}
        callType={currentCallType}
        callerName={isIncomingCall ? (primaryParticipant?.name || pendingCallerName || thread.name || 'Unknown caller') : (currentUser?.name || 'You')}
        recipientName={isIncomingCall ? (currentUser?.name || 'You') : (primaryParticipant?.name || pendingCallerName || thread.name || 'Unknown')}
        isIncoming={isIncomingCall}
        onCallEnd={handleEndCall}
        threadId={threadId}
        currentUserId={currentUser?.id}
        roomIdHint={activeRoomId ?? pendingRoomId ?? undefined}
        tokenHint={pendingToken}
      />
    </div>
  )
}

export default ChatWindow









