'use client'

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { format, isToday, isYesterday, isThisWeek } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Phone,
  Video,
  Loader2,
  ArrowLeft,
  Search,
  X,
  MessageCircle,
  MoreVertical,
  UserRoundPlus,
  ChevronDown,
} from '@/shared/icons'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { useHeaderInboxCounts } from '@/shared/hooks/useHeaderInboxCounts'
import { ChatParticipant } from '@/shared/types/chat'
import {
  supabaseMessagingService,
  ChatThread,
  RecentCallEntry,
  RecentCallParticipant,
} from '@/features/chat/services/supabaseMessagingService'
import { CHAT_THREAD_MARKED_READ_EVENT } from '@/features/chat/threadReadEvents'
import { ChatDropdownShimmer } from '@/shared/components/ui/ShimmerLoaders'
import { CH } from '@/features/chat/constants/chatLayout'
import Link from 'next/link'

const PAGE_SIZE = 20

type EnrichedCall = RecentCallEntry & {
  name: string
  avatarUrl?: string
  id: string
  isGroup: boolean
  displayParticipants: RecentCallParticipant[]
  otherParticipants: RecentCallParticipant[]
  groupKey: string
}

type CallContactGroup = {
  key: string
  name: string
  isGroup: boolean
  avatarUrl?: string
  otherParticipants: RecentCallParticipant[]
  displayParticipants: RecentCallParticipant[]
  calls: EnrichedCall[]
  latest: EnrichedCall
  threadId: string
  contactId?: string
}

function directionWord(dir?: EnrichedCall['call_direction']) {
  if (dir === 'outgoing') return 'Outgoing'
  if (dir === 'missed') return 'Missed'
  return 'Incoming'
}

function formatListDay(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, 'EEEE')
  return format(d, 'dd/MM/yyyy')
}

function daySectionLabel(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, 'EEEE')
  return format(d, 'MMM d, yyyy')
}

function callEventLabel(call: EnrichedCall) {
  const time = format(new Date(call.created_at), 'HH:mm')
  const kind = call.call_type === 'video' ? 'video call' : 'voice call'
  const dir = call.call_direction ?? 'incoming'
  if (dir === 'outgoing') return `Outgoing ${kind} at ${time}`
  if (dir === 'missed') return `Missed ${kind} at ${time}`
  return `Incoming ${kind} at ${time}`
}

function formatDuration(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return ''
  const s = Math.floor(seconds)
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (rem === 0) return `${m} minute${m === 1 ? '' : 's'}`
  return `${m} minute${m === 1 ? '' : 's'} ${rem} second${rem === 1 ? '' : 's'}`
}

function ParticipantAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass =
    size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm'
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-primary-100 text-orange-500 flex items-center justify-center font-semibold shrink-0`}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function SplitCircleAvatar({
  participants,
  size = 'md',
  fallbackName,
  fallbackAvatarUrl,
}: {
  participants: RecentCallParticipant[]
  size?: 'sm' | 'md' | 'lg'
  fallbackName?: string
  fallbackAvatarUrl?: string | null
}) {
  const sizeClass = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'
  const textClass = size === 'lg' ? 'text-sm' : size === 'sm' ? 'text-[9px]' : 'text-xs'
  const visible = participants.slice(0, 2)

  if (visible.length === 0) {
    return (
      <ParticipantAvatar name={fallbackName || '?'} avatarUrl={fallbackAvatarUrl} size={size} />
    )
  }
  if (visible.length === 1) {
    return (
      <ParticipantAvatar
        name={visible[0].name || fallbackName || '?'}
        avatarUrl={visible[0].avatar_url || fallbackAvatarUrl}
        size={size}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden shrink-0 flex border border-border-subtle bg-primary-100`}
      aria-hidden
    >
      {visible.map((p, index) => (
        <div
          key={p.id || `${p.name}-${index}`}
          className="relative h-full w-1/2 overflow-hidden"
          style={index === 1 ? { borderLeft: '1px solid rgba(255,255,255,0.85)' } : undefined}
        >
          {p.avatar_url ? (
            <img
              src={p.avatar_url}
              alt=""
              className="absolute inset-0 h-full w-[200%] max-w-none object-cover"
              style={{ left: index === 0 ? '0%' : '-100%' }}
            />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center font-semibold text-orange-500 ${textClass}`}
            >
              {(p.name || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function ParticipantMenu({
  participant,
  onVideo,
  onAudio,
  onMessage,
  busy,
}: {
  participant: RecentCallParticipant
  onVideo: () => void
  onAudio: () => void
  onMessage: () => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-content-tertiary hover:bg-surface-secondary disabled:opacity-50"
        aria-label={`More actions for ${participant.name}`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content hover:bg-surface"
            onClick={() => {
              setOpen(false)
              onMessage()
            }}
          >
            <MessageCircle className="h-4 w-4" /> Message
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content hover:bg-surface"
            onClick={() => {
              setOpen(false)
              onVideo()
            }}
          >
            <Video className="h-4 w-4" /> Video call
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content hover:bg-surface"
            onClick={() => {
              setOpen(false)
              onAudio()
            }}
          >
            <Phone className="h-4 w-4" /> Voice call
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * WhatsApp-style Calls page: contact list + call info card (1:1 and group).
 */
export default function CallsPageView() {
  const router = useRouter()
  const {
    startCall,
    startChatWithMembers,
    currentUser,
    threads: contextThreads,
    callHistoryThreads: threads,
    setCallHistoryThreads: setThreads,
    recentCallEntries,
    setRecentCallEntries,
  } = useProductionChat()
  const { markCallsViewed } = useHeaderInboxCounts()

  const [recentCallsLoading, setRecentCallsLoading] = useState(
    recentCallEntries.length === 0
  )
  const [callsLoadingMore, setCallsLoadingMore] = useState(false)
  const [callsHasMore, setCallsHasMore] = useState(true)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
  const [startingCallKey, setStartingCallKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'audio' | 'video'>('all')
  const recentCallEntriesRef = useRef(recentCallEntries)
  recentCallEntriesRef.current = recentCallEntries
  const listScrollRef = useRef<HTMLDivElement>(null)
  const callsPageRef = useRef(0)
  const callsHasMoreRef = useRef(true)
  const callsLoadingMoreRef = useRef(false)
  const initialLoadDoneRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    markCallsViewed()
  }, [markCallsViewed])

  useEffect(() => {
    const onMarkedRead = (event: Event) => {
      const tid = (event as CustomEvent<{ threadId?: string }>).detail?.threadId
      if (!tid) return
      setThreads((prev) => prev.map((t) => (t.id === tid ? { ...t, unread_count: 0 } : t)))
    }
    window.addEventListener(CHAT_THREAD_MARKED_READ_EVENT, onMarkedRead as EventListener)
    return () =>
      window.removeEventListener(CHAT_THREAD_MARKED_READ_EVENT, onMarkedRead as EventListener)
  }, [setThreads])

  useEffect(() => {
    const loadThreads = async () => {
      if (!currentUser) return
      const { threads: userThreads } = await supabaseMessagingService.getUserThreads(
        { id: currentUser.id, name: currentUser.name || '' },
        { limit: PAGE_SIZE, page: 0 }
      )
      setThreads((prev) => {
        const byId = new Map(prev.map((thread) => [thread.id, thread]))
        for (const thread of userThreads) {
          byId.set(thread.id, { ...byId.get(thread.id), ...thread })
        }
        return [...byId.values()]
      })
    }
    loadThreads()
  }, [currentUser, setThreads])

  const mergeCallEntries = useCallback(
    (incoming: RecentCallEntry[]) => {
      setRecentCallEntries((prev) => {
        const byId = new Map(prev.map((entry) => [entry.session_id, entry]))
        for (const entry of incoming) {
          byId.set(entry.session_id, { ...byId.get(entry.session_id), ...entry })
        }
        return [...byId.values()].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      })
    },
    [setRecentCallEntries]
  )

  const loadMoreCalls = useCallback(async () => {
    if (!currentUser?.id || callsLoadingMoreRef.current || !callsHasMoreRef.current) {
      return false
    }
    callsLoadingMoreRef.current = true
    setCallsLoadingMore(true)
    try {
      const nextPage = callsPageRef.current + 1
      const { entries, hasMore } = await supabaseMessagingService.getRecentCalls(
        currentUser.id,
        PAGE_SIZE,
        nextPage,
        { type: typeFilter, search: debouncedSearch || undefined }
      )
      const existingIds = new Set(recentCallEntriesRef.current.map((c) => c.session_id))
      const deduped = entries.filter((c) => !existingIds.has(c.session_id))
      if (deduped.length > 0) mergeCallEntries(deduped)
      // Stop if API says so, or this page added nothing new (avoid infinite loops).
      const nextHasMore = hasMore && deduped.length > 0
      callsHasMoreRef.current = nextHasMore
      setCallsHasMore(nextHasMore)
      callsPageRef.current = nextPage
      return nextHasMore
    } finally {
      callsLoadingMoreRef.current = false
      setCallsLoadingMore(false)
    }
  }, [currentUser?.id, mergeCallEntries, typeFilter, debouncedSearch])

  useEffect(() => {
    let cancelled = false
    const loadRecentCalls = async () => {
      if (!currentUser?.id) {
        setRecentCallsLoading(false)
        return
      }
      setRecentCallsLoading(true)
      initialLoadDoneRef.current = false
      setSelectedGroupKey(null)
      setRecentCallEntries([])
      try {
        const { entries, hasMore } = await supabaseMessagingService.getRecentCalls(
          currentUser.id,
          PAGE_SIZE,
          0,
          { type: typeFilter, search: debouncedSearch || undefined }
        )
        if (cancelled) return
        setRecentCallEntries(
          [...entries].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        )
        callsHasMoreRef.current = hasMore
        setCallsHasMore(hasMore)
        callsPageRef.current = 0
        initialLoadDoneRef.current = true
      } finally {
        if (!cancelled) setRecentCallsLoading(false)
      }
    }
    loadRecentCalls()
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, setRecentCallEntries, typeFilter, debouncedSearch])

  // When contacts are grouped, the list often fits on one screen — keep fetching
  // until the list overflows or there are no more pages.
  useEffect(() => {
    if (recentCallsLoading || !initialLoadDoneRef.current) return
    if (!callsHasMore || callsLoadingMore) return

    const el = listScrollRef.current
    if (!el) return

    const needsMore = el.scrollHeight <= el.clientHeight + 8
    if (needsMore) {
      void loadMoreCalls()
    }
  }, [
    recentCallsLoading,
    callsHasMore,
    callsLoadingMore,
    recentCallEntries.length,
    loadMoreCalls,
  ])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      if (scrollHeight - scrollTop - clientHeight < 120 && callsHasMoreRef.current) {
        void loadMoreCalls()
      }
    },
    [loadMoreCalls]
  )

  const mergedThreads = useMemo(() => {
    const map = new Map<string, ChatThread>()
    for (const t of threads) map.set(t.id, t)
    for (const t of contextThreads) map.set(t.id, t)
    return Array.from(map.values())
  }, [threads, contextThreads])

  const sortedRecentCalls = useMemo((): EnrichedCall[] => {
    return recentCallEntries
      .map((entry) => {
        const thread = mergedThreads.find((t) => t.id === entry.thread_id)
        const otherParticipants = thread
          ? thread.participants.filter((p: ChatParticipant) => p.id !== currentUser?.id)
          : []
        const primary = otherParticipants[0] ?? (thread ? thread.participants[0] : null)
        const multiFromApi =
          (entry.participants?.filter((p) => !p.is_self && p.id !== currentUser?.id).length ??
            0) > 1
        const isGroup = thread
          ? thread.type === 'group' ||
            Boolean(thread.group_id) ||
            otherParticipants.length > 1 ||
            Boolean((thread as { isGroup?: boolean }).isGroup) ||
            entry.metadata?.isGroupCall === true ||
            entry.metadata?.isGroupCall === 'true' ||
            multiFromApi
          : entry.thread_type === 'group' ||
            entry.metadata?.isGroupCall === true ||
            entry.metadata?.isGroupCall === 'true' ||
            multiFromApi

        const fallbackName = entry.contact_name || entry.thread_name || 'Unknown'
        const fallbackId = entry.contact_id || entry.thread_id

        const apiParticipants = entry.participants?.length
          ? entry.participants
          : otherParticipants.map((p: ChatParticipant) => ({
              id: p.id,
              name: p.name || 'Unknown',
              avatar_url: p.avatarUrl || null,
              joined: true,
              is_self: p.id === currentUser?.id,
              is_friend: false,
            }))

        const othersForDisplay = apiParticipants.filter(
          (p) => !p.is_self && p.id !== currentUser?.id
        )
        const useMultiPartyTitle = othersForDisplay.length >= 2
        const multiPartyTitle = useMultiPartyTitle
          ? `${othersForDisplay[0]?.name || 'Unknown'}${
              othersForDisplay.length > 1
                ? ` & ${othersForDisplay.length - 1} other${
                    othersForDisplay.length - 1 === 1 ? '' : 's'
                  }`
                : ''
            }`
          : null

        const groupIsMulti = isGroup || useMultiPartyTitle
        const groupKey = groupIsMulti
          ? `group:${entry.thread_id}`
          : `dm:${entry.contact_id || primary?.id || entry.thread_id}`

        return {
          ...entry,
          name: useMultiPartyTitle
            ? multiPartyTitle || fallbackName
            : isGroup && (thread?.name || entry.thread_name) && thread?.type === 'group'
              ? thread?.name || entry.thread_name || fallbackName
              : primary?.name || thread?.name || fallbackName,
          avatarUrl:
            othersForDisplay[0]?.avatar_url ||
            primary?.avatarUrl ||
            entry.contact_avatar_url ||
            undefined,
          id: primary?.id || fallbackId || '',
          isGroup: groupIsMulti,
          displayParticipants: apiParticipants,
          otherParticipants: othersForDisplay,
          groupKey,
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [recentCallEntries, mergedThreads, currentUser?.id])

  const contactGroups = useMemo((): CallContactGroup[] => {
    const map = new Map<string, CallContactGroup>()
    for (const call of sortedRecentCalls) {
      const existing = map.get(call.groupKey)
      if (existing) {
        existing.calls.push(call)
        continue
      }
      map.set(call.groupKey, {
        key: call.groupKey,
        name: call.name,
        isGroup: call.isGroup,
        avatarUrl: call.avatarUrl,
        otherParticipants: call.otherParticipants,
        displayParticipants: call.displayParticipants,
        calls: [call],
        latest: call,
        threadId: call.thread_id,
        contactId: call.contact_id || call.id,
      })
    }
    return [...map.values()].sort(
      (a, b) =>
        new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime()
    )
  }, [sortedRecentCalls])

  const filteredGroups = contactGroups

  const selectedGroup = useMemo(
    () => filteredGroups.find((g) => g.key === selectedGroupKey) ?? null,
    [filteredGroups, selectedGroupKey]
  )

  const selectedCallsByDay = useMemo(() => {
    if (!selectedGroup) return [] as { label: string; calls: EnrichedCall[] }[]
    const sections: { label: string; calls: EnrichedCall[] }[] = []
    for (const call of selectedGroup.calls) {
      const label = daySectionLabel(call.created_at)
      const last = sections[sections.length - 1]
      if (last && last.label === label) last.calls.push(call)
      else sections.push({ label, calls: [call] })
    }
    return sections
  }, [selectedGroup])

  const handleStartCall = async (
    threadId: string,
    type: 'audio' | 'video',
    targetUserId?: string,
    targetUserName?: string,
    targetUserAvatarUrl?: string,
    options?: { forceGroupCall?: boolean }
  ) => {
    const lockKey = `${threadId}:${type}:${targetUserId || 'group'}`
    if (startingCallKey) return
    setStartingCallKey(lockKey)
    try {
      await startCall(threadId, type, targetUserId, targetUserName, targetUserAvatarUrl, options)
    } catch {
      /* startCall shows toast */
    } finally {
      setStartingCallKey(null)
    }
  }

  const handleStartOneToOneCall = async (
    participant: RecentCallParticipant,
    type: 'audio' | 'video'
  ) => {
    if (!participant.id || participant.is_self || startingCallKey) return
    const lockKey = `1to1:${participant.id}:${type}`
    setStartingCallKey(lockKey)
    try {
      const chatParticipant: ChatParticipant = {
        id: participant.id,
        name: participant.name || 'Unknown',
        avatarUrl: participant.avatar_url || undefined,
      }
      const threadId = await startChatWithMembers([chatParticipant], {
        participant_ids: [chatParticipant.id],
        openInDock: true,
      })
      if (!threadId) return
      await startCall(
        threadId,
        type,
        chatParticipant.id,
        chatParticipant.name,
        chatParticipant.avatarUrl
      )
    } catch {
      /* toast from startCall */
    } finally {
      setStartingCallKey(null)
    }
  }

  const openChatWithParticipant = async (participant: RecentCallParticipant) => {
    if (!participant.id || participant.is_self) return
    const chatParticipant: ChatParticipant = {
      id: participant.id,
      name: participant.name || 'Unknown',
      avatarUrl: participant.avatar_url || undefined,
    }
    const threadId = await startChatWithMembers([chatParticipant], {
      participant_ids: [chatParticipant.id],
      openInDock: false,
    })
    if (threadId) router.push(`/chat/${encodeURIComponent(threadId)}`)
  }

  const listLoading = recentCallsLoading && recentCallEntries.length === 0

  const callList = (
    <div className="flex h-full w-full max-w-sm flex-col bg-white sm:max-w-none sm:w-[360px] lg:w-[380px]">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h1 className="text-xl font-semibold text-content">Calls</h1>
        <Link
          href="/friends"
          className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary hover:bg-surface"
          title="New call"
          aria-label="New call"
        >
          <UserRoundPlus className="h-5 w-5" />
        </Link>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or username"
            className="w-full rounded-full border-0 bg-surface py-2 pl-9 pr-9 text-sm text-content placeholder:text-content-secondary outline-none ring-1 ring-border-subtle focus:ring-primary-300"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-content-tertiary transition hover:bg-surface-hover hover:text-content"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'audio', label: 'Audio' },
              { key: 'video', label: 'Video' },
            ] as const
          ).map((chip) => {
            const active = typeFilter === chip.key
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setTypeFilter(chip.key)}
                className={`inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                    : 'border border-border text-content-secondary hover:bg-surface-hover'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        ref={listScrollRef}
        className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2 pb-2"
        onScroll={handleScroll}
      >
        {listLoading ? (
          <div className="px-2 py-2">
            <ChatDropdownShimmer mode="call" count={8} />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Phone className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-content">
              {debouncedSearch || typeFilter !== 'all' ? 'No matching calls' : 'No calls yet'}
            </p>
            <p className="mt-1 text-xs text-content-secondary">
              {debouncedSearch || typeFilter !== 'all'
                ? 'Try a different name, username, or call type.'
                : 'Your call history will show up here.'}
            </p>
          </div>
        ) : (
          <>
            {filteredGroups.map((group) => {
              const dir = group.latest.call_direction ?? 'incoming'
              const missed = dir === 'missed'
              const ArrowIcon = dir === 'outgoing' ? ArrowUpRight : ArrowDownLeft
              const arrowClass =
                dir === 'outgoing' || dir === 'incoming' ? 'text-emerald-600' : 'text-red-500'
              const isActive = selectedGroupKey === group.key
              const count = group.calls.length
              const dirLabel = `${directionWord(dir)}${count > 1 ? ` (${count})` : ''}`

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setSelectedGroupKey(group.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                    isActive ? 'bg-[#f0f2f5]' : 'hover:bg-surface'
                  }`}
                >
                  <SplitCircleAvatar
                    participants={group.otherParticipants}
                    size="md"
                    fallbackName={group.name}
                    fallbackAvatarUrl={group.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`truncate text-[15px] font-medium ${
                          missed ? 'text-red-600' : 'text-content'
                        }`}
                      >
                        {group.name}
                      </p>
                      <span className="shrink-0 text-[11px] text-content-tertiary">
                        {formatListDay(group.latest.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px] text-content-secondary">
                      <ArrowIcon className={`h-3.5 w-3.5 shrink-0 ${arrowClass}`} aria-hidden />
                      <span className="truncate">{dirLabel}</span>
                      {isActive && (
                        <ChevronDown className="ml-0.5 h-3.5 w-3.5 shrink-0 text-content-tertiary" />
                      )}
                    </p>
                  </div>
                </button>
              )
            })}
            {callsLoadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-content-tertiary" />
              </div>
            )}
            {!callsLoadingMore && callsHasMore && (
              <div className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={() => void loadMoreCalls()}
                  className="rounded-full px-4 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  const detailPane = selectedGroup ? (
    <div className="flex h-full w-full flex-col bg-[#f0f2f5]">
      <div className="flex items-center justify-between bg-white px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedGroupKey(null)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-content-secondary hover:bg-surface sm:hidden"
            aria-label="Back to calls"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-[15px] font-semibold text-content">Call info</h2>
        </div>
        <button
          type="button"
          onClick={() => setSelectedGroupKey(null)}
          className="hidden h-8 w-8 items-center justify-center rounded-full text-content-secondary hover:bg-surface sm:flex"
          aria-label="Close call info"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4">
        <div className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border-subtle bg-white shadow-sm">
          {/* Contact / group header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <SplitCircleAvatar
              participants={selectedGroup.otherParticipants}
              size="lg"
              fallbackName={selectedGroup.name}
              fallbackAvatarUrl={selectedGroup.avatarUrl}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-content">{selectedGroup.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {!selectedGroup.isGroup && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedGroup.threadId) {
                      router.push(`/chat/${encodeURIComponent(selectedGroup.threadId)}`)
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary hover:bg-surface"
                  title="Message"
                  aria-label="Message"
                >
                  <MessageCircle className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(startingCallKey)}
                onClick={() =>
                  handleStartCall(
                    selectedGroup.threadId,
                    'video',
                    selectedGroup.isGroup ? undefined : selectedGroup.contactId,
                    selectedGroup.isGroup ? undefined : selectedGroup.name,
                    selectedGroup.isGroup ? undefined : selectedGroup.avatarUrl,
                    selectedGroup.isGroup ? { forceGroupCall: true } : undefined
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary hover:bg-surface disabled:opacity-50"
                title="Video call"
                aria-label="Video call"
              >
                <Video className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={Boolean(startingCallKey)}
                onClick={() =>
                  handleStartCall(
                    selectedGroup.threadId,
                    'audio',
                    selectedGroup.isGroup ? undefined : selectedGroup.contactId,
                    selectedGroup.isGroup ? undefined : selectedGroup.name,
                    selectedGroup.isGroup ? undefined : selectedGroup.avatarUrl,
                    selectedGroup.isGroup ? { forceGroupCall: true } : undefined
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary hover:bg-surface disabled:opacity-50"
                title="Voice call"
                aria-label="Voice call"
              >
                <Phone className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="border-t border-border-subtle px-4 py-3">
            {selectedCallsByDay.map((section) => (
              <div key={section.label} className="mb-3 last:mb-0">
                <p className="mb-1.5 text-[12px] font-medium text-content-tertiary">
                  {section.label}
                </p>
                <ul className="space-y-2">
                  {section.calls.map((call) => {
                    const missed = call.call_direction === 'missed'
                    const duration = formatDuration(call.duration_seconds)
                    return (
                      <li
                        key={call.session_id}
                        className="flex items-start gap-2.5 text-[13px]"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-content-secondary">
                          {call.call_type === 'video' ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <Phone className="h-4 w-4" />
                          )}
                        </span>
                        <span
                          className={`min-w-0 flex-1 leading-snug ${
                            missed ? 'text-red-600' : 'text-content'
                          }`}
                        >
                          {callEventLabel(call)}
                        </span>
                        {duration ? (
                          <span className="shrink-0 text-content-tertiary">{duration}</span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          {selectedGroup.isGroup && (
            <div className="border-t border-border-subtle px-4 py-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-content-tertiary">
                Participants
              </p>
              <ul className="space-y-1">
                {selectedGroup.displayParticipants.map((p) => {
                  const isSelf = Boolean(p.is_self) || p.id === currentUser?.id
                  const busy =
                    startingCallKey === `1to1:${p.id}:video` ||
                    startingCallKey === `1to1:${p.id}:audio`
                  return (
                    <li key={p.id} className="flex items-center gap-2.5 rounded-lg py-1.5">
                      <ParticipantAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-content">
                          {isSelf ? 'You' : p.name}
                        </p>
                        <p className="text-[11px] text-content-secondary">
                          {p.joined === false ? 'Invited' : 'Joined'}
                        </p>
                      </div>
                      {!isSelf && (
                        <ParticipantMenu
                          participant={p}
                          busy={busy}
                          onVideo={() => handleStartOneToOneCall(p, 'video')}
                          onAudio={() => handleStartOneToOneCall(p, 'audio')}
                          onMessage={() => openChatWithParticipant(p)}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#f0f2f5] px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-content-secondary shadow-sm">
        <Phone className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="mt-3 text-base font-semibold text-content">Calls</p>
      <p className="mt-1 max-w-[16rem] text-center text-xs text-content-secondary">
        Select a call to see details.
      </p>
    </div>
  )

  return (
    <div className={`${CH.pageShell} !border-0`}>
      <div
        className={`h-full shrink-0 ${
          selectedGroupKey ? 'hidden sm:flex' : 'flex'
        }`}
      >
        {callList}
      </div>

      <main
        className={`min-w-0 flex-1 ${
          selectedGroupKey ? 'flex' : 'hidden sm:flex'
        }`}
      >
        {detailPane}
      </main>
    </div>
  )
}
