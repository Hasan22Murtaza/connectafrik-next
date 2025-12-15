import React, { useMemo } from 'react'
import { MessageCircle, Phone, Video, Circle } from 'lucide-react'
import { useMembers } from '@/shared/hooks/useMembers'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { ChatParticipant, PresenceStatus } from '@/shared/types/chat'

const statusColor: Record<PresenceStatus, string> = {
  online: 'text-green-500',
  away: 'text-yellow-500',
  busy: 'text-red-500',
  offline: 'text-gray-300',
}

const statusLabel: Record<PresenceStatus, string> = {
  online: 'Active',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
}

const ContactsRail: React.FC = () => {
  const { members, loading } = useMembers()
  const { threads, startChatWithMembers, startCall, presence, updatePresence } = useProductionChat()

  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members])

  const contacts = useMemo<ChatParticipant[]>(
    () =>
      members.map((member) => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.avatar_url,
      })),
    [members]
  )

  const ensureThread = async (contact: ChatParticipant): Promise<string | null> => {
    const existingThread = threads.find((thread) =>
      thread.participants.some((participant) => participant.id === contact.id)
    )

    if (existingThread) {
      return existingThread.id
    }

    const newThreadId = await startChatWithMembers([contact], { 
      participant_ids: [contact.id], 
      openInDock: true 
    })
    return newThreadId
  }

  const handleStartChat = async (contact: ChatParticipant) => {
    await startChatWithMembers([contact])
    updatePresence(contact.id, 'online')
  }

  const handleStartCall = async (contact: ChatParticipant, type: 'audio' | 'video') => {
    try {
      const threadId = await ensureThread(contact)
      if (threadId) {
        updatePresence(contact.id, 'online')
        await startCall(threadId, type)
      }
    } catch (error) {
      console.error('Failed to start call:', error)
    }
  }

  const renderContacts = () => {
    if (loading) {
      return (
        <div className="text-xs text-gray-400">Loading contacts�</div>
      )
    }

    if (!contacts.length) {
      return (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          No contacts available. Invite a teammate to get started.
        </div>
      )
    }

    return contacts.map((contact) => {
      const member = memberMap.get(contact.id)
      const fallbackStatus: PresenceStatus = (member?.status as PresenceStatus) || 'offline'
      const derivedStatus: PresenceStatus = (presence[contact.id] as PresenceStatus) || fallbackStatus

      return (
        <div
          key={contact.id}
          className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm"
        >
          <div className="flex items-center space-x-3">
            {contact.avatarUrl ? (
              <img
                src={contact.avatarUrl}
                alt={contact.name}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                {contact.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{contact.name}</p>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <Circle className={`h-2 w-2 ${statusColor[derivedStatus]}`} fill="currentColor" />
                <span>{statusLabel[derivedStatus]}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleStartChat(contact)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-primary-100 hover:text-primary-700"
              title="Open chat"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleStartCall(contact, 'audio')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-primary-100 hover:text-primary-700"
              title="Start voice call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleStartCall(contact, 'video')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-primary-100 hover:text-primary-700"
              title="Start video call"
            >
              <Video className="h-4 w-4" />
            </button>
          </div>
        </div>
      )
    })
  }

  return (
    <div className="card sticky top-24 flex min-h-[320px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Contacts</h3>
          <p className="text-xs text-gray-500">Reach out instantly</p>
        </div>
        <span className="text-sm font-semibold text-gray-500">{contacts.length}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">{renderContacts()}</div>

      <p className="text-xs text-gray-400">
        Tip: Invite friends to ConnectAfrik to grow this list of quick contacts.
      </p>
    </div>
  )
}

export default ContactsRail
