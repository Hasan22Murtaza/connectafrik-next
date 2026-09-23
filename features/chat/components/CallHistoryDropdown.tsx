'use client'

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, Phone, Video, Loader2, X } from '@/shared/icons'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { ChatParticipant } from '@/shared/types/chat'
import {
  supabaseMessagingService,
  ChatThread,
  RecentCallEntry,
  RecentCallParticipant,
} from '@/features/chat/services/supabaseMessagingService'
import { CHAT_THREAD_MARKED_READ_EVENT } from '@/features/chat/threadReadEvents'
import { ChatDropdownShimmer } from '@/shared/components/ui/ShimmerLoaders'

const PAGE_SIZE = 10

type EnrichedCall = RecentCallEntry & {
  name: string
  avatarUrl?: string
  id: string
  isGroup: boolean
  displayParticipants: RecentCallParticipant[]
  otherParticipants: RecentCallParticipant[]
}

function formatCallHistoryTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) {
    return formatDistanceToNow(d, { addSuffix: true })
  }
  if (isToday(d)) return `Today, ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Yesterday, ${format(d, 'HH:mm')}`
  return format(d, 'MMM d, HH:mm')
}

function callEventLabel(call: EnrichedCall): string {
  const time = format(new Date(call.created_at), 'HH:mm')
  const kind = call.call_type === 'video' ? 'video call' : 'voice call'
  const dir = call.call_direction ?? 'incoming'
  if (dir === 'outgoing') return `Outgoing ${kind} at ${time}`
  if (dir === 'missed') return `Missed ${kind} at ${time}`
  return `Incoming ${kind} at ${time}`
}

function daySectionLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d, yyyy')
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
    size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
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
      className={`${sizeClass} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold shrink-0`}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

/**
 * WhatsApp-style split circle: one avatar ring showing up to 2 other users' DPs.
 */
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
  const sizeClass = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const textClass = size === 'lg' ? 'text-sm' : size === 'sm' ? 'text-[9px]' : 'text-xs'
  const visible = participants.slice(0, 2)

  if (visible.length === 0) {
    return (
      <ParticipantAvatar
        name={fallbackName || '?'}
        avatarUrl={fallbackAvatarUrl}
        size={size}
      />
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
      className={`${sizeClass} rounded-full overflow-hidden shrink-0 flex border border-border bg-primary-100`}
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
              className={`flex h-full w-full items-center justify-center font-semibold text-primary-700 ${textClass}`}
            >
              {(p.name || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export interface CallHistoryDropdownProps {
  onClose: () => void
}

/**
 * Header calls menu: WhatsApp-style chronological log with Call info + participants.
 */
function CallHistoryDropdown({ onClose }: CallHistoryDropdownProps) {
  const { startCall, currentUser, threads: contextThreads } = useProductionChat()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [recentCallEntries, setRecentCallEntries] = useState<RecentCallEntry[]>([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [recentCallsLoading, setRecentCallsLoading] = useState(true)
  const [callsLoadingMore, setCallsLoadingMore] = useState(false)
  const [callsHasMore, setCallsHasMore] = useState(true)
  const [callsPage, setCallsPage] = useState(0)
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMarkedRead = (event: Event) => {
      const tid = (event as CustomEvent<{ threadId?: string }>).detail?.threadId
      if (!tid) return
      setThreads((prev) => prev.map((t) => (t.id === tid ? { ...t, unread_count: 0 } : t)))
    }
    window.addEventListener(CHAT_THREAD_MARKED_READ_EVENT, onMarkedRead as EventListener)
    return () =>
      window.removeEventListener(CHAT_THREAD_MARKED_READ_EVENT, onMarkedRead as EventListener)
  }, [])

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
        const { threads: userThreads } = await supabaseMessagingService.getUserThreads(
          { id: currentUser.id, name: currentUser.name || '' },
          { limit: PAGE_SIZE, page: 0 }
        )
        setThreads(userThreads)
      } finally {
        setThreadsLoading(false)
      }
    }
    loadThreads()
  }, [currentUser])

  useEffect(() => {
    const loadRecentCalls = async () => {
      if (!currentUser?.id) {
        setRecentCallsLoading(false)
        return
      }
      setRecentCallsLoading(true)
      try {
        const entries = await supabaseMessagingService.getRecentCalls(currentUser.id, PAGE_SIZE, 0)
        setRecentCallEntries(entries)
        setCallsPage(0)
        setCallsHasMore(entries.length >= PAGE_SIZE)
      } finally {
        setRecentCallsLoading(false)
      }
    }
    loadRecentCalls()
  }, [currentUser?.id])

  const loadMoreCalls = useCallback(async () => {
    if (!currentUser?.id || callsLoadingMore || !callsHasMore) return
    setCallsLoadingMore(true)
    try {
      const nextPage = callsPage + 1
      const moreCalls = await supabaseMessagingService.getRecentCalls(currentUser.id, PAGE_SIZE, nextPage)
      if (moreCalls.length < PAGE_SIZE) setCallsHasMore(false)
      setRecentCallEntries(prev => {
        const existingIds = new Set(prev.map(c => c.session_id))
        const deduped = moreCalls.filter(c => !existingIds.has(c.session_id))
        return [...prev, ...deduped]
      })
      setCallsPage(nextPage)
    } finally {
      setCallsLoadingMore(false)
    }
  }, [currentUser?.id, callsLoadingMore, callsHasMore, callsPage])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      if (scrollHeight - scrollTop - clientHeight < 80 && callsHasMore) {
        loadMoreCalls()
      }
    },
    [loadMoreCalls, callsHasMore]
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

  const sortedRecentCalls = useMemo((): EnrichedCall[] => {
    return recentCallEntries
      .map(entry => {
        const thread = mergedThreads.find(t => t.id === entry.thread_id)
        const otherParticipants = thread
          ? thread.participants.filter((p: ChatParticipant) => p.id !== currentUser?.id)
          : []
        const primary = otherParticipants[0] ?? (thread ? thread.participants[0] : null)
        const multiFromApi =
          (entry.participants?.filter(p => !p.is_self && p.id !== currentUser?.id).length ?? 0) > 1
        const isGroup = thread
          ? thread.type === 'group' ||
            Boolean(thread.group_id) ||
            otherParticipants.length > 1 ||
            Boolean((thread as any).isGroup) ||
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
            }))

        const othersForDisplay = apiParticipants.filter(p => !p.is_self && p.id !== currentUser?.id)
        const useMultiPartyTitle = othersForDisplay.length >= 2
        const multiPartyTitle = useMultiPartyTitle
          ? othersForDisplay
              .slice(0, 2)
              .map(p => p.name)
              .join(' & ') + (othersForDisplay.length > 2 ? ` +${othersForDisplay.length - 2}` : '')
          : null

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
          id: primary?.id || fallbackId,
          isGroup: isGroup || useMultiPartyTitle,
          displayParticipants: apiParticipants,
          otherParticipants: othersForDisplay,
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [recentCallEntries, mergedThreads, currentUser?.id])

  const selectedCall = useMemo(
    () => sortedRecentCalls.find(c => c.session_id === selectedCallId) ?? null,
    [sortedRecentCalls, selectedCallId]
  )

  const handleStartCall = async (
    threadId: string,
    type: 'audio' | 'video',
    targetUserId?: string,
    targetUserName?: string,
    targetUserAvatarUrl?: string
  ) => {
    try {
      await startCall(threadId, type, targetUserId, targetUserName, targetUserAvatarUrl)
      onClose()
    } catch {
      /* startCall shows toast */
    }
  }

  const listLoading = recentCallsLoading || threadsLoading

  if (selectedCall) {
    const dir = selectedCall.call_direction ?? 'incoming'
    const missed = dir === 'missed'
    const ArrowIcon = dir === 'outgoing' ? ArrowUpRight : ArrowDownLeft
    const arrowClass = dir === 'outgoing' || dir === 'incoming' ? 'text-emerald-600' : 'text-red-500'
    const participants = selectedCall.displayParticipants
    const others = selectedCall.otherParticipants

    return (
      <div
        ref={dropdownRef}
        className="absolute sm:right-0 -right-6 mt-3 w-72 sm:w-80 max-w-[90vw] bg-surface border border-border rounded-xl shadow-2xl p-3 sm:p-4 z-[120]"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-content">Call info</h4>
          <button
            type="button"
            onClick={() => setSelectedCallId(null)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-content-secondary hover:bg-surface-secondary transition-colors"
            aria-label="Back to call history"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 sm:max-h-96 overflow-y-auto pr-1 custom-scrollbar">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <SplitCircleAvatar
              participants={others}
              size="lg"
              fallbackName={selectedCall.name}
              fallbackAvatarUrl={selectedCall.avatarUrl}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-content truncate">{selectedCall.name}</p>
              {others.length > 0 && (
                <p className="text-xs text-content-secondary">
                  {others.length + (participants.some(p => p.is_self) ? 1 : 0)} participants
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleStartCall(
                    selectedCall.thread_id,
                    'video',
                    selectedCall.id,
                    selectedCall.name,
                    selectedCall.avatarUrl
                  )
                }
                className="w-8 h-8 flex items-center justify-center bg-surface-secondary text-content-secondary rounded-full hover:bg-green-100 hover:text-green-600 transition-colors"
                title="Start video call"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  handleStartCall(
                    selectedCall.thread_id,
                    'audio',
                    selectedCall.id,
                    selectedCall.name,
                    selectedCall.avatarUrl
                  )
                }
                className="w-8 h-8 flex items-center justify-center bg-surface-secondary text-content-secondary rounded-full hover:bg-green-100 hover:text-green-600 transition-colors"
                title="Start voice call"
              >
                <Phone className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="py-3 border-b border-border">
            <p className="text-xs font-medium text-content-tertiary mb-2">
              {daySectionLabel(selectedCall.created_at)}
            </p>
            <div className="flex items-start gap-2 min-w-0">
              <ArrowIcon className={`w-4 h-4 mt-0.5 shrink-0 ${arrowClass}`} aria-hidden />
              <p className={`text-sm ${missed ? 'text-red-600' : 'text-content'}`}>
                {callEventLabel(selectedCall)}
              </p>
            </div>
          </div>

          <div className="pt-3">
            <p className="text-xs font-medium text-content-tertiary mb-2">Participants</p>
            {participants.length === 0 ? (
              <p className="text-sm text-content-secondary py-2">No participants found.</p>
            ) : (
              <ul className="space-y-1">
                {participants.map(p => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2.5 rounded-lg px-1 py-1.5"
                  >
                    <ParticipantAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-content truncate">
                        {p.is_self ? 'You' : p.name}
                      </p>
                      {p.joined === false ? (
                        <p className="text-xs text-content-secondary">Invited</p>
                      ) : (
                        <p className="text-xs text-content-secondary">Joined</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute sm:right-0 -right-6 mt-3 w-65 sm:w-80 max-w-[90vw] sm:max-w-[90vw] bg-surface border border-border rounded-xl shadow-2xl p-3 sm:p-4 z-[120] transform -translate-x-0 sm:translate-x-0"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-content">Calls</h4>
          <p className="text-xs text-content-secondary">Call history</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          Close
        </button>
      </div>

      <div
        className="max-h-64 sm:max-h-80 overflow-y-auto pr-1 custom-scrollbar"
        onScroll={handleScroll}
      >
        {listLoading ? (
          <ChatDropdownShimmer mode="call" count={5} />
        ) : sortedRecentCalls.length === 0 ? (
          <div className="py-8 text-center text-sm text-content-secondary">No calls yet.</div>
        ) : (
          <>
            <div className="space-y-1 sm:space-y-2">
              {sortedRecentCalls.map(call => {
                const dir = call.call_direction ?? 'incoming'
                const missed = dir === 'missed'
                const ArrowIcon = dir === 'outgoing' ? ArrowUpRight : ArrowDownLeft
                const arrowClass =
                  dir === 'outgoing' || dir === 'incoming' ? 'text-emerald-600' : 'text-red-500'
                return (
                  <div
                    key={call.session_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCallId(call.session_id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedCallId(call.session_id)
                      }
                    }}
                    className="group flex items-center justify-between rounded-lg hover:bg-gray-50 p-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                      <SplitCircleAvatar
                        participants={call.otherParticipants}
                        size="md"
                        fallbackName={call.name}
                        fallbackAvatarUrl={call.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold text-gray-700 group-hover:text-gray-900 ${missed ? 'text-red-600' : 'text-content'}`}>
                          {call.name}
                        </p>
                        <p className="text-xs text-content-secondary flex items-center gap-1.5 min-w-0">
                          <ArrowIcon className={`w-3.5 h-3.5 shrink-0 ${arrowClass}`} aria-hidden />
                          <span className="truncate">{formatCallHistoryTime(call.created_at)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          handleStartCall(call.thread_id, call.call_type, call.id, call.name, call.avatarUrl)
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-surface-secondary text-content-secondary rounded-full hover:bg-green-100 hover:text-green-600 transition-colors"
                        title={call.call_type === 'video' ? 'Start video call' : 'Start voice call'}
                      >
                        {call.call_type === 'video' ? (
                          <Video className="w-4 h-4" />
                        ) : (
                          <Phone className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {callsLoadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-content-tertiary" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CallHistoryDropdown
