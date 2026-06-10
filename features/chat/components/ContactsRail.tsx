import React, { useMemo } from 'react'
import { MessageCircle, Phone, Video } from 'lucide-react'
import { useMembers } from '@/shared/hooks/useMembers'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { ChatParticipant } from '@/shared/types/chat'
import { ChatThread } from '@/features/chat/services/supabaseMessagingService'
import { formatContactPresenceLine } from '@/shared/hooks/usePresence'

const ContactsRail: React.FC = () => {
  const { members, loading } = useMembers()
  const { threads, startChatWithMembers, startCall } = useProductionChat()

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
    const existingThread = threads.find((thread: ChatThread) =>
      thread.participants.some((participant: ChatParticipant) => participant.id === contact.id)
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
  }

  const handleStartCall = async (contact: ChatParticipant, type: 'audio' | 'video') => {
    try {
      const threadId = await ensureThread(contact)
      if (threadId) {
        await startCall(threadId, type, contact.id, contact.name, contact.avatarUrl)
      }
    } catch (error) {
      console.error('Failed to start call:', error)
    }
  }

  const renderContacts = () => {
    if (loading) {
      return (
        <div className="text-xs text-content-tertiary">Loading contacts…</div>
      )
    }

    if (!contacts.length) {
      return (
        <div className="rounded-xl border border-dashed border-border bg-surface-secondary px-3 py-6 text-center text-sm text-content-secondary">
          No contacts available. Invite a teammate to get started.
        </div>
      )
    }

    return contacts.map((contact) => {
      const member = memberMap.get(contact.id)
      const line = formatContactPresenceLine(
        member?.status ?? null,
        member?.last_seen ?? null
      )

      return (
        <div
          key={contact.id}
          className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-3 py-2 shadow-sm"
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
              <p className="text-sm font-medium text-content">{contact.name}</p>
              <p className="text-xs text-content-secondary">{line}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleStartChat(contact)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content-secondary transition-colors hover:bg-primary-100 hover:text-primary-700"
              title="Open chat"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleStartCall(contact, 'audio')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content-secondary transition-colors hover:bg-primary-100 hover:text-primary-700"
              title="Start voice call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleStartCall(contact, 'video')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-content-secondary transition-colors hover:bg-primary-100 hover:text-primary-700"
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
          <h3 className="text-sm font-semibold text-content">Contacts</h3>
          <p className="text-xs text-content-secondary">Reach out instantly</p>
        </div>
        <span className="text-sm font-semibold text-content-secondary">{contacts.length}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">{renderContacts()}</div>

      <p className="text-xs text-content-tertiary">
        Tip: Invite friends to ConnectAfrik to grow this list of quick contacts.
      </p>
    </div>
  )
}

export default ContactsRail
