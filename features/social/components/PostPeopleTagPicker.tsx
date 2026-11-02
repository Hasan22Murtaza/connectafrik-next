'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Search, UserPlus, X } from '@/shared/icons'
import { friendRequestService, type Friend } from '@/features/social/services/friendRequestService'

export type TaggedPerson = {
  id: string
  username: string
  full_name: string
  avatar_url?: string | null
}

interface PostPeopleTagPickerProps {
  initial: TaggedPerson[]
  onDone: (people: TaggedPerson[]) => void
  onClose: () => void
}

const PostPeopleTagPicker: React.FC<PostPeopleTagPickerProps> = ({
  initial,
  onDone,
  onClose,
}) => {
  const [query, setQuery] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TaggedPerson[]>(initial)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const list = await friendRequestService.getFriends()
        if (!cancelled) setFriends(list)
      } catch {
        if (!cancelled) setFriends([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friends
    return friends.filter(
      (f) =>
        f.full_name?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q)
    )
  }, [friends, query])

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected])

  const toggle = (friend: Friend) => {
    setSelected((prev) => {
      if (prev.some((p) => p.id === friend.id)) {
        return prev.filter((p) => p.id !== friend.id)
      }
      return [
        ...prev,
        {
          id: friend.id,
          username: friend.username,
          full_name: friend.full_name,
          avatar_url: friend.avatar_url ?? null,
        },
      ]
    })
  }

  return (
    <div
      className="fixed inset-0 z-[10200] flex flex-col bg-surface"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-1 -ml-1 rounded-full text-content-secondary hover:bg-surface-hover transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-bold text-base sm:text-lg text-content flex-1 text-center pr-6">
          Tag people
        </h2>
      </div>

      <div className="px-4 py-3 border-b border-border-subtle shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search friends"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-10 py-2.5 text-sm rounded-full border border-border focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 bg-surface placeholder:text-content-tertiary"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-content-tertiary hover:text-content-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        {selected.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {p.full_name || p.username}
                <button
                  type="button"
                  onClick={() => setSelected((prev) => prev.filter((x) => x.id !== p.id))}
                  className="rounded-full p-0.5 hover:bg-blue-100"
                  aria-label={`Remove ${p.full_name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-content-tertiary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading friends…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-content-tertiary px-6 text-center">
            <UserPlus className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">
              {friends.length === 0
                ? 'Add friends to tag them in your posts'
                : 'No friends match your search'}
            </p>
          </div>
        ) : (
          filtered.map((friend) => {
            const active = selectedIds.has(friend.id)
            return (
              <button
                key={friend.id}
                type="button"
                onClick={() => toggle(friend)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                  active ? 'bg-blue-50/60' : ''
                }`}
              >
                {friend.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={friend.avatar_url}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-semibold text-content-secondary">
                    {(friend.full_name || friend.username || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-content truncate">
                    {friend.full_name || friend.username}
                  </p>
                  <p className="text-xs text-content-tertiary truncate">@{friend.username}</p>
                </div>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    active
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-border bg-surface'
                  }`}
                  aria-hidden
                >
                  {active ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  ) : null}
                </span>
              </button>
            )
          })
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => onDone(selected)}
          className="w-full rounded-xl bg-[var(--african-orange)] py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--african-orange-dark)]"
        >
          Done{selected.length > 0 ? ` (${selected.length})` : ''}
        </button>
      </div>
    </div>
  )
}

export default PostPeopleTagPicker
