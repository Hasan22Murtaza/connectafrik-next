'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Phone, Video, UserPlus } from 'lucide-react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { friendRequestService } from '@/features/social/services/friendRequestService'

interface OnlineContact {
  id: string
  name: string
  avatarUrl?: string
  status: 'online' | 'offline'
  lastSeen?: string
}

interface OnlineContactsSectionProps {
  contacts: OnlineContact[]
  onStartChat?: (contact: OnlineContact) => void
  onStartCall?: (contact: OnlineContact, type: 'audio' | 'video') => void
  showAddFriendButton?: boolean
  title?: string
}

const OnlineContactsSection: React.FC<OnlineContactsSectionProps> = ({
  contacts,
  onStartChat,
  onStartCall,
  showAddFriendButton = false,
  title,
}) => {
  const router = useRouter()
  const { startChatWithMembers, startCall } = useProductionChat()
  const [sendingRequest, setSendingRequest] = useState<Record<string, boolean>>({})

  const handleStartChat = async (contact: OnlineContact) => {
    try {
      const chatParticipant = {
        id: contact.id,
        name: contact.name,
        avatarUrl: contact.avatarUrl,
      }
      const threadId = await startChatWithMembers([chatParticipant], {
        participant_ids: [chatParticipant.id],
        openInDock: false,
      })
      if (threadId) {
        router.push(`/chat/${encodeURIComponent(threadId)}`)
        onStartChat?.(contact)
      }
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
        await startCall(threadId, type, chatParticipant.id, chatParticipant.name, chatParticipant.avatarUrl)
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

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-content-secondary">
          {title || (showAddFriendButton ? 'People You May Know' : 'Online Contacts')}
        </h2>
      </div>

      <div>
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-surface-hover cursor-pointer"
          >
            <div className="flex flex-1 items-center space-x-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-tertiary">
                {contact.avatarUrl ? (
                  <img
                    src={contact.avatarUrl}
                    alt={contact.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-content-secondary">
                    {contact.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-content">{contact.name}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center space-x-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              {showAddFriendButton ? (
                <button
                  onClick={() => handleAddFriend(contact)}
                  disabled={sendingRequest[contact.id]}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-content-inverse bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Link Up"
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
                    className="rounded-full p-1.5 text-blue-500 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-tertiary"
                    title="Start chat"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleStartCall(contact, 'audio')}
                    className="rounded-full p-1.5 text-green-500 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-tertiary"
                    title="Voice call"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleStartCall(contact, 'video')}
                    className="rounded-full p-1.5 text-purple-500 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-tertiary"
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-2xl">
            👥
          </div>
          <p className="text-sm text-content-secondary">
            {showAddFriendButton ? 'No suggestions available' : 'No friends online'}
          </p>
        </div>
      )}
    </div>
  )
}

export default OnlineContactsSection
