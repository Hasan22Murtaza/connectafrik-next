import React, { useState } from 'react'
import { Reply, Trash2, UserCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ChatMessage } from '@/features/chat/services/supabaseMessagingService'
import MessageStatusIndicator from '@/features/chat/components/MessageStatusIndicator'

interface MessageBubbleProps {
  message: ChatMessage
  isOwnMessage: boolean
  currentUserId: string
  threadParticipants?: string[] // Array of participant user IDs in this thread
  onReply?: (message: ChatMessage) => void
  onDelete?: (messageId: string, deleteForEveryone: boolean) => void
  canDeleteForEveryone?: boolean
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  currentUserId,
  threadParticipants = [],
  onReply,
  onDelete,
  canDeleteForEveryone = false,
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Minimum swipe distance (in px) to trigger reply
  const minSwipeDistance = 50

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    // Swipe right to reply (from left edge)
    if (isRightSwipe && onReply) {
      onReply(message)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowMenu(true)
  }

  const handleDelete = (deleteForEveryone: boolean) => {
    if (onDelete) {
      onDelete(message.id, deleteForEveryone)
    }
    setShowMenu(false)
  }

  const handleReply = () => {
    if (onReply) {
      onReply(message)
    }
    setShowMenu(false)
  }

  // Hide menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setShowMenu(false)
    if (showMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showMenu])

  // Check if message is deleted
  const isDeleted = message.is_deleted
  const isDeletedForMe = message.deleted_for?.includes(currentUserId) ?? false

  // Don't render if deleted for current user
  if (isDeletedForMe) return null

  // Don't render system messages (call notifications, reactions, hand raised, screen share, etc.)
  // These are call/meeting management messages, not chat messages
  const systemMessageTypes = [
    'call_accepted',
    'call_request',
    'call_notification',
    'hand_raised',
    'reaction',
    'screen_share_started',
    'screen_share_stopped'
  ]

  if (systemMessageTypes.includes(message.message_type ?? '')) {
    return null;
  }

  // Determine message status for own messages
  const getMessageStatus = (): 'sending' | 'sent' | 'delivered' | 'read' => {
    if (!isOwnMessage) return 'sent' // Status only matters for own messages
    
    // If message has read_by data, determine status based on who has read it
    if (message.read_by && message.read_by.length > 0) {
      // Get other participants (excluding sender)
      const otherParticipants = threadParticipants.filter(id => id !== currentUserId)
      
      // If all other participants have read the message, it's "read"
      if (otherParticipants.length > 0 && otherParticipants.every(id => message.read_by!.includes(id))) {
        return 'read'
      }
      
      // If at least one other participant has read it, it's "delivered"
      if (otherParticipants.some(id => message.read_by!.includes(id))) {
        return 'delivered'
      }
    }
    
    // Default to "sent" if no read receipts or not all participants have read
    return 'sent'
  }

  const messageStatus = getMessageStatus()

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3 relative`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Context Menu */}
      {showMenu && (
        <div
          className="absolute z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[180px]"
          style={{
            top: '100%',
            [isOwnMessage ? 'right' : 'left']: '0',
            marginTop: '4px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Reply Option */}
          {onReply && !isDeleted && (
            <button
              onClick={handleReply}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
            >
              <Reply className="w-4 h-4 text-blue-500" />
              <span>Reply</span>
            </button>
          )}

          {/* Delete Options (only for own messages) */}
          {isOwnMessage && onDelete && !isDeleted && (
            <>
              <button
                onClick={() => handleDelete(false)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4 text-gray-500" />
                <span>Delete for Me</span>
              </button>

              {canDeleteForEveryone && (
                <button
                  onClick={() => handleDelete(true)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm text-red-600"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Delete for Everyone</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Message Bubble */}
      <div className={`max-w-[70%] ${isOwnMessage ? 'ml-auto' : 'mr-auto'}`}>
        {/* Sender Info (for group chats or other users' messages) */}
        {!isOwnMessage && message.sender && (
          <div className="flex items-center gap-2 mb-1 px-1">
            {message.sender.avatarUrl ? (
              <img
                src={message.sender.avatarUrl}
                alt={message.sender.name}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <UserCircle className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              {message.sender.name}
            </span>
          </div>
        )}

        {/* Reply Preview (if this is a reply) */}
        {message.reply_to_id && (
          <div
            className={`mb-2 p-2 rounded-lg border-l-4 ${
              isOwnMessage
                ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-500'
                : 'bg-gray-100 dark:bg-gray-800 border-gray-400'
            }`}
          >
            <div className="text-xs text-gray-600 dark:text-gray-400 italic">
              💬 Replying to a message
            </div>
          </div>
        )}

        {/* Message Content */}
        <div
          className={`rounded-2xl px-4 py-2 ${
            isOwnMessage
              ? 'bg-orange-500 text-white rounded-br-none'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
          }`}
        >
          {isDeleted ? (
            <p className="text-sm italic opacity-60">🚫 This message was deleted</p>
          ) : (
            <p className="text-sm break-words">{message.content}</p>
          )}

          {/* Timestamp and Status */}
          <div
            className={`flex items-center justify-between mt-1 ${
              isOwnMessage ? 'text-orange-100' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="text-xs">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
            <MessageStatusIndicator 
              status={messageStatus} 
              isOwnMessage={isOwnMessage} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
