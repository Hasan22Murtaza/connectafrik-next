import React, { useState } from 'react'
import { MessageCircle, Phone, Video, UserPlus } from 'lucide-react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { friendRequestService } from '@/features/social/services/friendRequestService'

interface OnlineContact {
  id: string
  name: string
  avatarUrl?: string
  status: 'online' | 'away' | 'busy' | 'offline'
  lastSeen?: string
}

interface OnlineContactsSectionProps {
  contacts: OnlineContact[]
  onStartChat?: (contact: OnlineContact) => void
  onStartCall?: (contact: OnlineContact, type: 'audio' | 'video') => void
  showAddFriendButton?: boolean // For suggested users vs. friends
  title?: string // Custom title
}

const OnlineContactsSection: React.FC<OnlineContactsSectionProps> = ({
  contacts,
  onStartChat,
  onStartCall,
  showAddFriendButton = false,
  title,
}) => {
  const { startChatWithMembers, startCall } = useProductionChat()
  const [sendingRequest, setSendingRequest] = useState<Record<string, boolean>>({})

  const handleStartChat = async (contact: OnlineContact) => {
    try {
      const chatParticipant = {
        id: contact.id,
        name: contact.name,
        avatarUrl: contact.avatarUrl,
      }
      await startChatWithMembers([chatParticipant], { 
        participant_ids: [chatParticipant.id], 
        openInDock: true 
      })
      onStartChat?.(contact)
    } catch (error) {
      // Failed to start chat
    }
  }

  const handleStartCall = async (contact: OnlineContact, type: 'audio' | 'video') => {
    try {
      const chatParticipant = {
        id: contact.id,
        name: contact.name,
        avatarUrl: contact.avatarUrl,
      }
      const threadId = await startChatWithMembers([chatParticipant], {
        participant_ids: [chatParticipant.id],
        openInDock: true
      })
      if (threadId) {
        await startCall(threadId, type)
        onStartCall?.(contact, type)
      }
    } catch (error) {
      // Failed to start call
    }
  }

  const handleAddFriend = async (contact: OnlineContact) => {
    setSendingRequest(prev => ({ ...prev, [contact.id]: true }))

    try {
      const result = await friendRequestService.sendFriendRequest(contact.id)
      if (!result.success) {
        alert(result.error || 'Failed to send friend request')
      }
    } catch (error) {
      alert('Failed to send friend request')
    } finally {
      setSendingRequest(prev => ({ ...prev, [contact.id]: false }))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'away':
        return 'bg-yellow-500'
      case 'busy':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = (status: string) => {
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

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {title || (showAddFriendButton ? 'People You May Know' : 'Online Contacts')}
        </h2>
        <span className="text-sm text-gray-500">{contacts.length}</span>
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="group flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
          >
            <div className="flex flex-1 items-center space-x-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                  {contact.avatarUrl ? (
                    <img
                      src={contact.avatarUrl}
                      alt={contact.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-600">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div
                  className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(
                    contact.status
                  )}`}
                ></div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{contact.name}</p>
                <p className="text-xs text-gray-500">{getStatusText(contact.status)}</p>
              </div>
            </div>

            <div className="flex items-center space-x-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              {showAddFriendButton ? (
                <button
                  onClick={() => handleAddFriend(contact)}
                  disabled={sendingRequest[contact.id]}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Add Friend"
                >
                  {sendingRequest[contact.id] ? (
                    'Sending...'
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 inline mr-1" />
                      Add
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleStartChat(contact)}
                    className="rounded-full p-1.5 text-blue-600 transition-colors hover:bg-blue-100"
                    title="Start chat"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleStartCall(contact, 'audio')}
                    className="rounded-full p-1.5 text-green-600 transition-colors hover:bg-green-100"
                    title="Voice call"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleStartCall(contact, 'video')}
                    className="rounded-full p-1.5 text-purple-600 transition-colors hover:bg-purple-100"
                    title="Video call"
                  >
                    <Video className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {contacts.length === 0 && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
            👥
          </div>
          <p className="text-sm text-gray-500">
            {showAddFriendButton ? 'No suggestions available' : 'No friends online'}
          </p>
        </div>
      )}
    </div>
  )
}

export default OnlineContactsSection
