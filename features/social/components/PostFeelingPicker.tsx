'use client'

import React, { useMemo, useState } from 'react'
import { ArrowLeft, Plus, Search, X } from '@/shared/icons'
import {
  POST_FEELING_PRESETS,
  feelingSubtitle,
} from '@/features/social/constants/postFeelings'
import type { PostFeeling } from '@/features/social/utils/postFeeling'

interface PostFeelingPickerProps {
  initial?: PostFeeling | null
  onDone: (feeling: PostFeeling | null) => void
  onClose: () => void
}

const PostFeelingPicker: React.FC<PostFeelingPickerProps> = ({
  initial,
  onDone,
  onClose,
}) => {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PostFeeling | null>(initial ?? null)
  const [creating, setCreating] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customEmoji, setCustomEmoji] = useState('😊')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return POST_FEELING_PRESETS
    return POST_FEELING_PRESETS.filter(
      (f) => f.label.toLowerCase().includes(q) || f.emoji.includes(q)
    )
  }, [query])

  const selectFeeling = (feeling: PostFeeling) => {
    setSelected(feeling)
  }

  const handleCreate = () => {
    const label = customLabel.trim()
    if (!label) return
    const feeling = { label, emoji: customEmoji.trim() || '😊' }
    setSelected(feeling)
    setCreating(false)
    setCustomLabel('')
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
          How are you feeling?
        </h2>
      </div>

      <div className="px-4 py-3 border-b border-border-subtle shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search feelings"
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
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--african-orange)] hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Create your own feeling
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-secondary/40 p-2">
            <input
              type="text"
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value.slice(0, 4))}
              className="w-12 shrink-0 rounded-lg border border-border bg-surface px-1 py-2 text-center text-lg"
              aria-label="Emoji"
            />
            <input
              type="text"
              placeholder="Feeling name"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value.slice(0, 40))}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              autoFocus
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!customLabel.trim()}
              className="shrink-0 rounded-lg bg-[var(--african-orange)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-28">
        {selected ? (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-2">
            <p className="text-sm font-medium text-content">
              Selected: {feelingSubtitle(selected.label, selected.emoji)}
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="p-1 rounded-full text-content-tertiary hover:text-red-500 hover:bg-surface"
              aria-label="Clear feeling"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {filtered.map((feeling) => {
          const active =
            selected?.label.toLowerCase() === feeling.label.toLowerCase() &&
            selected?.emoji === feeling.emoji
          return (
            <button
              key={feeling.id}
              type="button"
              onClick={() => selectFeeling({ label: feeling.label, emoji: feeling.emoji })}
              className={`w-full flex items-center gap-3 rounded-xl border bg-surface px-3 py-3 text-left shadow-sm transition-colors hover:bg-surface-hover ${
                active ? 'border-[var(--african-orange)] ring-1 ring-orange-200' : 'border-border'
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-2xl">
                {feeling.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-content">{feeling.label}</span>
                <span className="block text-xs text-content-tertiary">
                  {feelingSubtitle(feeling.label, feeling.emoji)}
                </span>
              </span>
            </button>
          )
        })}

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-content-tertiary">
            No feelings match “{query}”
          </div>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => onDone(selected)}
          className="w-full rounded-xl bg-[var(--african-orange)] py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--african-orange-dark)]"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export default PostFeelingPicker
