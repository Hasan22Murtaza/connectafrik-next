'use client'

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, Phone, Video, Loader2 } from 'lucide-react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { ChatParticipant } from '@/shared/types/chat'
import { supabaseMessagingService, ChatThread, RecentCallEntry } from '@/features/chat/services/supabaseMessagingService'
import { CHAT_THREAD_MARKED_READ_EVENT } from '@/features/chat/threadReadEvents'
import { ChatDropdownShimmer } from '@/shared/components/ui/ShimmerLoaders'

const PAGE_SIZE = 10

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

export interface CallHistoryDropdownProps {
  onClose: () => void
}

/**
 * Header calls menu: WhatsApp-style chronological log only (no contact picker).
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

  const sortedRecentCalls = useMemo(() => {
    return recentCallEntries
      .map(entry => {
        const thread = mergedThreads.find(t => t.id === entry.thread_id)
        const otherParticipants = thread
          ? thread.participants.filter((p: ChatParticipant) => p.id !== currentUser?.id)
          : []
        const primary = otherParticipants[0] ?? (thread ? thread.participants[0] : null)
        const isGroup = thread
          ? thread.type === 'group' ||
            Boolean(thread.group_id) ||
            otherParticipants.length > 1 ||
            Boolean((thread as any).isGroup)
          : entry.thread_type === 'group'
        const fallbackName = entry.contact_name || entry.thread_name || 'Unknown'
        const fallbackId = entry.contact_id || entry.thread_id
        const groupBanner = isGroup ? thread?.banner_url || entry.banner_url || undefined : undefined
        return {
          ...entry,
          name:
            isGroup && (thread?.name || entry.thread_name)
              ? thread?.name || entry.thread_name || fallbackName
              : primary?.name || thread?.name || fallbackName,
          avatarUrl: isGroup
            ? groupBanner
            : primary?.avatarUrl || entry.contact_avatar_url || undefined,
          id: primary?.id || fallbackId,
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [recentCallEntries, mergedThreads, currentUser?.id])

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

  return (
    <div
      ref={dropdownRef}
      className="absolute sm:right-0 -right-6 mt-3 w-65 sm:w-80 max-w-[90vw] sm:max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-2xl p-3 sm:p-4 z-[120] transform -translate-x-0 sm:translate-x-0"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">Calls</h4>
          <p className="text-xs text-gray-500">Call history</p>
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
          <div className="py-8 text-center text-sm text-gray-500">No calls yet.</div>
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
                    className="flex items-center justify-between rounded-lg border border-transparent hover:border-gray-200 py-2 transition-colors"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                      <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0">
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
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${missed ? 'text-red-600' : 'text-gray-900'}`}>
                          {call.name}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 min-w-0">
                          <ArrowIcon className={`w-3.5 h-3.5 shrink-0 ${arrowClass}`} aria-hidden />
                          <span className="truncate">{formatCallHistoryTime(call.created_at)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartCall(call.thread_id, call.call_type, call.id, call.name, call.avatarUrl)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-green-100 hover:text-green-600 transition-colors"
                        title="Start voice call"
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
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CallHistoryDropdown
