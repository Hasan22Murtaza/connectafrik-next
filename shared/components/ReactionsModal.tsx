'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ReactionIcon from './ReactionIcon'

export interface ReactionsModalUser {
  id: string
  full_name?: string
  username?: string
  avatar_url?: string | null
}

export interface ReactionsModalGroup {
  type: string
  count: number
  users: ReactionsModalUser[]
}

export interface ReactionsModalProps {
  isOpen: boolean
  onClose: () => void
  reactionGroups: ReactionsModalGroup[]
  onUserClick?: (username: string) => void
  postId?: string
  /** Table to query: 'post_reactions' or 'group_post_reactions'. Defaults to 'post_reactions'. */
  reactionsTable?: string
  /** Column name for the post ID in the reactions table. Defaults to 'post_id'. */
  postIdColumn?: string
}

const PAGE_SIZE = 20

const ReactionsModal: React.FC<ReactionsModalProps> = ({
  isOpen,
  onClose,
  reactionGroups,
  onUserClick,
  postId,
  reactionsTable = 'post_reactions',
  postIdColumn = 'post_id',
}) => {
  const [activeTab, setActiveTab] = useState<string>('all')
  const [paginatedUsers, setPaginatedUsers] = useState<Array<ReactionsModalUser & { reaction_type: string }>>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevTabRef = useRef(activeTab)
  const prevOpenRef = useRef(isOpen)

  const totalCount = useMemo(() => {
    if (activeTab === 'all') {
      return reactionGroups.reduce((sum, g) => sum + g.count, 0)
    }
    return reactionGroups.find((g) => g.type === activeTab)?.count ?? 0
  }, [activeTab, reactionGroups])

  const fetchPage = useCallback(async (tab: string, pageOffset: number, replace: boolean) => {
    if (!postId) return
    setLoading(true)
    try {
      let query = supabase
        .from(reactionsTable)
        .select('user_id, reaction_type, created_at')
        .eq(postIdColumn, postId)
        .order('created_at', { ascending: false })

      if (tab !== 'all') {
        query = query.eq('reaction_type', tab)
      }

      query = query.range(pageOffset, pageOffset + PAGE_SIZE - 1)

      const { data: reactionsData, error } = await query
      if (error) throw error

      const userIds = [...new Set((reactionsData || []).map((r: any) => r.user_id))]
      let profiles: Record<string, ReactionsModalUser> = {}
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds)
        if (profilesData) {
          profilesData.forEach((p: any) => { profiles[p.id] = p })
        }
      }

      const newUsers = (reactionsData || [])
        .filter((r: any) => profiles[r.user_id])
        .map((r: any) => ({
          ...profiles[r.user_id],
          reaction_type: r.reaction_type,
        }))

      if (replace) {
        setPaginatedUsers(newUsers)
      } else {
        setPaginatedUsers((prev) => {
          const existingIds = new Set(prev.map((u) => u.id + u.reaction_type))
          const unique = newUsers.filter((u: any) => !existingIds.has(u.id + u.reaction_type))
          return [...prev, ...unique]
        })
      }

      setHasMore((reactionsData?.length ?? 0) >= PAGE_SIZE)
      setOffset(pageOffset + PAGE_SIZE)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [postId, reactionsTable, postIdColumn])

  useEffect(() => {
    if (isOpen && postId && (!prevOpenRef.current || activeTab !== prevTabRef.current)) {
      setPaginatedUsers([])
      setOffset(0)
      setHasMore(true)
      fetchPage(activeTab, 0, true)
    }
    prevTabRef.current = activeTab
    prevOpenRef.current = isOpen
  }, [isOpen, activeTab, postId, fetchPage])

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('all')
      setPaginatedUsers([])
      setOffset(0)
      setHasMore(true)
    }
  }, [isOpen])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el || loading || !hasMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      fetchPage(activeTab, offset, false)
    }
  }, [loading, hasMore, activeTab, offset, fetchPage])

  // Build the user-to-reaction map from paginated data
  const userReactionMap = useMemo(() => {
    const map = new Map<string, string>()
    paginatedUsers.forEach((u) => {
      if (!map.has(u.id)) map.set(u.id, u.reaction_type)
    })
    return map
  }, [paginatedUsers])

  // Deduplicate users (a user could appear twice if they have multiple reaction types, though unlikely)
  const displayUsers = useMemo(() => {
    const seen = new Set<string>()
    return paginatedUsers.filter((u) => {
      if (seen.has(u.id)) return false
      seen.add(u.id)
      return true
    })
  }, [paginatedUsers])

  // Fallback: if no postId, use the static data from reactionGroups
  const fallbackUsers = useMemo(() => {
    if (activeTab === 'all') {
      const seen = new Set<string>()
      const all: ReactionsModalUser[] = []
      reactionGroups.forEach((group) => {
        group.users.forEach((u) => {
          if (!seen.has(u.id)) {
            seen.add(u.id)
            all.push(u)
          }
        })
      })
      return all
    }
    return reactionGroups.find((g) => g.type === activeTab)?.users || []
  }, [activeTab, reactionGroups])

  const fallbackReactionMap = useMemo(() => {
    const map = new Map<string, string>()
    reactionGroups.forEach((group) => {
      group.users.forEach((u) => {
        if (!map.has(u.id)) map.set(u.id, group.type)
      })
    })
    return map
  }, [reactionGroups])

  const usePaginated = !!postId
  const users = usePaginated ? displayUsers : fallbackUsers
  const reactionMap = usePaginated ? userReactionMap : fallbackReactionMap

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:w-[480px] sm:rounded-xl rounded-t-xl shadow-2xl flex flex-col overflow-hidden h-[70vh] sm:h-[540px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs header */}
        <div className="flex items-center border-b border-gray-200 px-2 min-h-[52px] shrink-0">
          <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2.5 text-[15px] font-semibold whitespace-nowrap border-b-[3px] transition-colors ${
                activeTab === 'all'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {reactionGroups.map((group) => (
              <button
                key={group.type}
                onClick={() => setActiveTab(group.type)}
                className={`flex items-center gap-1.5 px-3 py-2.5 whitespace-nowrap border-b-[3px] transition-colors ${
                  activeTab === group.type
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:bg-gray-50'
                }`}
              >
                <ReactionIcon type={group.type} size={20} />
                <span className="text-[15px] font-semibold">{group.count}</span>
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Users list */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="overflow-y-auto flex-1 min-h-0"
        >
          {users.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-500">
              No reactions yet
            </div>
          ) : (
            <>
              {users.map((user) => {
                const reactionType = reactionMap.get(user.id)
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      if (user.username && onUserClick) {
                        onUserClick(user.username)
                      }
                      onClose()
                    }}
                  >
                    <div className="relative shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name || user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-semibold text-sm">
                            {(user.full_name || user.username || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {reactionType && (
                        <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-[1px]">
                          <ReactionIcon type={reactionType} size={16} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[15px] text-gray-900 truncate">
                        {user.full_name || user.username}
                      </div>
                      {user.username && (
                        <div className="text-[13px] text-gray-500 truncate">
                          @{user.username}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {loading && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                </div>
              )}

              {!loading && usePaginated && !hasMore && users.length > 0 && users.length < totalCount && (
                <div className="text-center text-[13px] text-gray-400 py-3">
                  All reactions loaded
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReactionsModal
