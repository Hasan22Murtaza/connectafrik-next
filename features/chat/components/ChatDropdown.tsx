import React, { useMemo, useEffect, useState, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, Phone, Video, Circle } from 'lucide-react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { PresenceStatus, ChatParticipant } from '@/shared/types/chat'
import { useMembers } from '@/shared/hooks/useMembers'
import { supabaseMessagingService, ChatThread, RecentCallEntry } from '@/features/chat/services/supabaseMessagingService'

interface ChatDropdownProps {
  onClose: () => void
  mode?: 'chat' | 'call'
}

const statusColor: Record<PresenceStatus, string> = {
  online: 'text-green-500',
  away: 'text-yellow-500',
  busy: 'text-red-500',
  offline: 'text-gray-300',
}

const ChatDropdown: React.FC<ChatDropdownProps> = ({ onClose, mode = 'chat' }) => {
  const { openThread, startCall, startChatWithMembers, presence, currentUser, threads: contextThreads } = useProductionChat()
  const { members } = useMembers()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [recentCallEntries, setRecentCallEntries] = useState<RecentCallEntry[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    const loadThreads = async () => {
      if (currentUser) {
        const userThreads = await supabaseMessagingService.getUserThreads({
          id: currentUser.id,
          name: currentUser.name || '',
        })
        setThreads(userThreads)
      }
    }
    loadThreads()
  }, [currentUser])

  useEffect(() => {
    const loadRecentCalls = async () => {
      if (currentUser?.id) {
        const entries = await supabaseMessagingService.getRecentCalls(currentUser.id)
        setRecentCallEntries(entries)
      }
    }
    loadRecentCalls()
  }, [currentUser?.id])

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return dateB - dateA
    })
  }, [threads])

  const availableContacts = useMemo(() => {
    return members
      .filter(member => member.id !== (currentUser?.id as string))
      .map(member => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.avatar_url,
        status: (presence[member.id] || (member.last_seen ? 'away' : 'offline')) as PresenceStatus
      }))
  }, [members, currentUser, presence])

  const sortedRecentCalls = useMemo(() => {
    const allThreads = [...threads, ...contextThreads]
    return recentCallEntries
      .map(entry => {
        const thread = allThreads.find(t => t.id === entry.thread_id)
        if (!thread) return null
        const otherParticipants = thread.participants.filter(
          (p: ChatParticipant) => p.id !== currentUser?.id
        )
        const primary = otherParticipants[0] ?? thread.participants[0]
        if (!primary) return null
        return {
          ...entry,
          name: primary.name || thread.name || 'Unknown',
          avatarUrl: primary.avatarUrl,
          id: primary.id,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [recentCallEntries, threads, contextThreads, currentUser?.id])

  const handleOpenThread = async (threadId: string) => {
    // Find the thread in local threads or context threads
    const thread = threads.find(t => t.id === threadId) || contextThreads.find(t => t.id === threadId)
    
    // Open the thread - this will add it to openThreads and trigger ChatDock to load it
    openThread(threadId)
    onClose()
  }

  const handleStartCall = async (threadId: string, type: 'audio' | 'video') => {
    await startCall(threadId, type)
    onClose()
  }

  const handleStartCallWithContact = async (contactId: string, contactName: string, contactAvatarUrl: string | undefined, type: 'audio' | 'video') => {
    const threadId = await startChatWithMembers([{
      id: contactId,
      name: contactName,
      avatarUrl: contactAvatarUrl
    }], { participant_ids: [contactId] })

    if (threadId) {
      await startCall(threadId, type)
    }
    onClose()
  }

  const title = mode === 'chat' ? 'Messenger' : 'Calls'
  const subtitle = mode === 'chat' ? 'Recent messages and active contacts' : 'Start an audio or video call'

  return (
    <div
      ref={dropdownRef}
      className="absolute sm:right-0 -right-6 mt-3 w-65 sm:w-80 max-w-[90vw] sm:max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-2xl p-3 sm:p-4 z-[120] transform -translate-x-0 sm:translate-x-0"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{title}</h4>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          Close
        </button>
      </div>

      {mode === 'call' ? (
        // Call mode: Show latest calls (Facebook-style) then contacts
        <div className="space-y-4 max-h-64 sm:max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {sortedRecentCalls.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recent</p>
              <div className="space-y-2 sm:space-y-3">
                {sortedRecentCalls.map((call) => (
                  <div
                    key={call.thread_id}
                    className="flex items-center justify-between rounded-lg border border-transparent hover:border-gray-200 py-2 transition-colors"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                      <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                        {call.avatarUrl ? (
                          <img
                            src={call.avatarUrl}
                            alt={call.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-xs sm:text-sm">
                            {call.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <Circle
                          className={`w-2.5 h-2.5 absolute bottom-0 right-0 ${statusColor[(presence[call.id] || 'offline') as PresenceStatus]}`}
                          fill="currentColor"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{call.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                          {' · '}
                          {call.call_type === 'video' ? 'Video call' : 'Voice call'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        onClick={() => handleStartCall(call.thread_id, 'audio')}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-green-100 hover:text-green-600 transition-colors"
                        title="Start voice call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStartCall(call.thread_id, 'video')}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-purple-100 hover:text-purple-600 transition-colors"
                        title="Start video call"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {sortedRecentCalls.length > 0 ? 'Contacts' : 'Start a call'}
            </p>
            {availableContacts.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">
                No contacts available.
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {availableContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between rounded-lg border border-transparent hover:border-gray-200 py-2 transition-colors"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="relative w-8 h-8 sm:w-10 sm:h-10">
                        {contact.avatarUrl ? (
                          <img
                            src={contact.avatarUrl}
                            alt={contact.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-xs sm:text-sm">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <Circle
                          className={`w-2.5 h-2.5 absolute bottom-0 right-0 ${statusColor[contact.status]}`}
                          fill="currentColor"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
                        <p className="text-xs text-gray-500">{contact.status === 'online' ? 'Active now' : contact.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleStartCallWithContact(contact.id, contact.name, contact.avatarUrl || undefined, 'audio')}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-green-100 hover:text-green-600 transition-colors"
                        title="Start voice call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStartCallWithContact(contact.id, contact.name, contact.avatarUrl || undefined, 'video')}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-purple-100 hover:text-purple-600 transition-colors"
                        title="Start video call"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Chat mode: Show existing threads
        sortedThreads.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">
            No conversations yet. Start a chat from the feed or contacts.
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-80 overflow-y-auto  custom-scrollbar scrollbar-hide">
            {sortedThreads.map((thread) => {
              const otherParticipants = thread.participants.filter(
                (participant: ChatParticipant) => participant.id !== currentUser?.id
              )
              const primary = otherParticipants[0] ?? thread.participants[0]
              const status = presence[primary?.id ?? ''] || 'offline'
              const lastActive = thread.last_message_at

              return (
                <div
                  key={thread.id}
                  className="flex items-center justify-between rounded-lg border border-transparent hover:border-gray-200  py-2 transition-colors"
                >
                  <button
                    onClick={() => handleOpenThread(thread.id)}
                    className="flex items-center space-x-2 sm:space-x-3 text-left"
                  >
                    <div className="relative w-8 h-8 sm:w-10 sm:h-10">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-xs sm:text-sm">
                        {(primary?.name || thread.name).charAt(0).toUpperCase()}
                      </div>
                      <Circle
                        className={`w-2.5 h-2.5 absolute bottom-0 right-0 ${statusColor[status as PresenceStatus]}`}
                        fill="currentColor"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {primary?.name || thread.name || 'Conversation'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {thread.last_message_preview
                          ? thread.last_message_preview
                          : `${otherParticipants.length} participant${otherParticipants.length !== 1 ? 's' : ''}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {lastActive && new Date(lastActive).getTime() > 0
                          ? formatDistanceToNow(new Date(lastActive), { addSuffix: true })
                          : 'No recent activity'}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleOpenThread(thread.id)}
                    className="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-primary-100 hover:text-primary-700 transition-colors"
                    title="Open chat"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

export default ChatDropdown


