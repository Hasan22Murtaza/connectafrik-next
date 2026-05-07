import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { format, isToday, isYesterday, isThisYear } from 'date-fns'
import { ChevronDown, Loader2, Pin, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { ChatParticipant } from '@/shared/types/chat'
import { supabaseMessagingService, ChatThread } from '@/features/chat/services/supabaseMessagingService'
import { ChatDropdownShimmer } from '@/shared/components/ui/ShimmerLoaders'

const PAGE_SIZE = 40

function formatThreadListTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const t = d.getTime()
  if (Number.isNaN(t) || t <= 0) return ''
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Yesterday'
  if (isThisYear(d)) return format(d, 'MMM d')
  return format(d, 'MMM d, yyyy')
}

interface ChatDropdownProps {
  onClose: () => void
}

type ChatDropdownThreadRowProps = {
  thread: ChatThread
  currentUser: { id: string } | null | undefined
  onOpen: (threadId: string) => void
  subdued?: boolean
}

const ChatDropdownThreadRow: React.FC<ChatDropdownThreadRowProps> = ({
  thread,
  currentUser,
  onOpen,
  subdued,
}) => {
  const otherParticipants = thread.participants.filter(
    (participant: ChatParticipant) => participant.id !== currentUser?.id
  )
  const primary = otherParticipants[0] ?? thread.participants[0]
  const lastActive = thread.last_message_at
  const isGroup =
    thread.type === 'group' ||
    Boolean(thread.group_id) ||
    otherParticipants.length > 1 ||
    Boolean((thread as any).isGroup)
  const threadDisplayName = isGroup && thread.name ? thread.name : primary?.name || thread.name || 'Conversation'
  const listAvatarUrl = isGroup && thread.banner_url ? thread.banner_url : primary?.avatarUrl
  const unread = typeof thread.unread_count === 'number' ? thread.unread_count : 0
  const timeLabel = formatThreadListTime(lastActive)
  const preview =
    thread.last_message_preview ||
    `${otherParticipants.length} participant${otherParticipants.length !== 1 ? 's' : ''}`

  return (
    <button
      type="button"
      onClick={() => onOpen(thread.id)}
      className={`flex w-full items-start gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-gray-50 ${
        subdued ? 'opacity-70' : ''
      }`}
    >
      <div className="relative h-12 w-12 shrink-0">
        {listAvatarUrl ? (
          <img
            src={listAvatarUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-base font-semibold text-primary-700">
            {threadDisplayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1 text-[15px] font-medium leading-tight text-gray-900">
            {thread.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden /> : null}
            <span className="truncate">{threadDisplayName}</span>
          </p>
          {timeLabel ? (
            <span
              className={`shrink-0 text-xs tabular-nums ${
                unread > 0 ? 'text-primary-600' : 'text-gray-400'
              }`}
            >
              {timeLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-gray-500">
            {subdued ? <span className="text-gray-400">Archived · </span> : null}
            {preview}
          </p>
          {unread > 0 ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 px-1 text-[11px] font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

const ChatDropdown: React.FC<ChatDropdownProps> = ({ onClose }) => {
  const router = useRouter()
  const { openThread, currentUser, threads: contextThreads } = useProductionChat()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [threadsLoadingMore, setThreadsLoadingMore] = useState(false)
  const [threadsHasMore, setThreadsHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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
      if (!currentUser) {
        setThreadsLoading(false)
        return
      }
      setThreadsLoading(true)
      try {
        const userThreads = await supabaseMessagingService.getUserThreads(
          { id: currentUser.id, name: currentUser.name || '' },
          { limit: PAGE_SIZE, page: 0 }
        )
        setThreads(userThreads)
        setThreadsHasMore(userThreads.length >= PAGE_SIZE)
      } finally {
        setThreadsLoading(false)
      }
    }
    loadThreads()
  }, [currentUser])

  const loadMoreThreads = useCallback(async () => {
    if (!currentUser || threadsLoadingMore || !threadsHasMore) return
    setThreadsLoadingMore(true)
    try {
      const moreThreads = await supabaseMessagingService.getUserThreads(
        { id: currentUser.id, name: currentUser.name || '' },
        { limit: PAGE_SIZE, page: Math.floor(threads.length / PAGE_SIZE) }
      )
      if (moreThreads.length < PAGE_SIZE) setThreadsHasMore(false)
      setThreads(prev => {
        const existingIds = new Set(prev.map(t => t.id))
        const deduped = moreThreads.filter(t => !existingIds.has(t.id))
        return [...prev, ...deduped]
      })
    } finally {
      setThreadsLoadingMore(false)
    }
  }, [currentUser, threads.length, threadsLoadingMore, threadsHasMore])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      if (scrollHeight - scrollTop - clientHeight < 80) {
        loadMoreThreads()
      }
    },
    [loadMoreThreads]
  )

  const mergedThreads = useMemo(() => {
    const map = new Map<string, ChatThread>()
    for (const t of threads) {
      map.set(t.id, t)
    }
    for (const t of contextThreads) {
      map.set(t.id, t)
    }
    return Array.from(map.values())
  }, [threads, contextThreads])

  const sortedThreads = useMemo(() => {
    return [...mergedThreads].sort((a, b) => {
      const pinA = a.pinned ? 1 : 0
      const pinB = b.pinned ? 1 : 0
      if (pinA !== pinB) return pinB - pinA
      if (pinA && pinB) {
        const tsA = a.pinned_at ? new Date(a.pinned_at).getTime() : 0
        const tsB = b.pinned_at ? new Date(b.pinned_at).getTime() : 0
        if (tsA !== tsB) return tsB - tsA
      }
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return dateB - dateA
    })
  }, [mergedThreads])

  const activeThreads = useMemo(
    () => sortedThreads.filter((t) => !t.archived),
    [sortedThreads]
  )

  const archivedThreads = useMemo(
    () => sortedThreads.filter((t) => t.archived === true),
    [sortedThreads]
  )

  const [archivedExpanded, setArchivedExpanded] = useState(false)

  const query = search.trim().toLowerCase()
  const filterThread = useCallback(
    (t: ChatThread) => {
      if (!query) return true
      const others = t.participants.filter((p: ChatParticipant) => p.id !== currentUser?.id)
      const primary = others[0] ?? t.participants[0]
      const isGroup =
        t.type === 'group' || Boolean(t.group_id) || others.length > 1 || Boolean((t as any).isGroup)
      const name =
        isGroup && t.name ? t.name : primary?.name || t.name || ''
      const preview = (t.last_message_preview || '').toLowerCase()
      return name.toLowerCase().includes(query) || preview.includes(query)
    },
    [query, currentUser?.id]
  )

  const filteredActive = useMemo(
    () => activeThreads.filter(filterThread),
    [activeThreads, filterThread]
  )
  const filteredArchived = useMemo(
    () => archivedThreads.filter(filterThread),
    [archivedThreads, filterThread]
  )

  const handleOpenThread = async (threadId: string) => {
    openThread(threadId)
    router.push(`/chat/${threadId}`)
    onClose()
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute sm:right-0 -right-6 z-[120] mt-3 w-65 max-w-[90vw] translate-x-0 transform rounded-xl border border-gray-200 bg-white p-3 shadow-2xl sm:w-80 sm:max-w-[90vw] sm:translate-x-0 sm:p-4"
    >
      <div className="border-b border-gray-100 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-lg font-semibold text-gray-900">Chats</h4>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Close
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 outline-none ring-0 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
            aria-label="Search chats"
          />
        </div>
      </div>

      {threadsLoading ? (
        <ChatDropdownShimmer mode="chat" count={5} />
      ) : mergedThreads.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">
          No conversations yet. Start a chat from the feed or contacts.
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="custom-scrollbar max-h-[min(70vh,22rem)] overflow-y-auto pt-1 sm:max-h-[min(70vh,24rem)]"
        >
          {filteredActive.length === 0 && filteredArchived.length === 0 && query ? (
            <p className="py-6 text-center text-sm text-gray-500">No chats match your search.</p>
          ) : null}
          {activeThreads.length === 0 && archivedThreads.length > 0 && !query && (
            <p className="pb-2 text-xs text-gray-500">
              No active chats — open <span className="font-medium text-gray-700">Archived</span> below.
            </p>
          )}
          <div className="divide-y divide-gray-100">
            {filteredActive.map((thread) => (
              <ChatDropdownThreadRow
                key={thread.id}
                thread={thread}
                currentUser={currentUser}
                onOpen={handleOpenThread}
              />
            ))}
          </div>
          {archivedThreads.length > 0 && (
            <div className="mt-1 border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => setArchivedExpanded((e) => !e)}
                className="mb-1 flex w-full items-center gap-1 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-700"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${archivedExpanded ? '' : '-rotate-90'}`}
                />
                Archived ({archivedThreads.length})
              </button>
              {archivedExpanded &&
                filteredArchived.map((thread) => (
                  <ChatDropdownThreadRow
                    key={thread.id}
                    thread={thread}
                    currentUser={currentUser}
                    onOpen={handleOpenThread}
                    subdued
                  />
                ))}
            </div>
          )}
          {threadsLoadingMore && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ChatDropdown
