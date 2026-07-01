'use client'

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  ChevronDown,
  Globe,
  Hash,
  Lock,
  Settings2,
  Smile,
  Tag,
  X,
} from 'lucide-react'
import {
  MAX_REEL_DESCRIPTION_LENGTH,
  MAX_REEL_TAGS,
  MAX_REEL_TITLE_LENGTH,
  REEL_ASPECT_RATIOS,
  REEL_CATEGORIES,
  ReelCategory,
} from '@/shared/types/reels'

const EmojiPicker = dynamic(() => import('@/shared/components/ui/EmojiPicker'), { ssr: false })

interface DetailsFormProps {
  title: string
  setTitle: (value: string) => void
  description: string
  setDescription: (value: string) => void
  category: ReelCategory
  setCategory: (value: ReelCategory) => void
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:3'
  setAspectRatio: (value: '9:16' | '16:9' | '1:1' | '4:3') => void
  tags: string[]
  newTag: string
  setNewTag: (value: string) => void
  addTag: () => void
  removeTag: (tag: string) => void
  isPublic: boolean
  setIsPublic: (value: boolean) => void
  showAdvanced: boolean
  setShowAdvanced: (value: boolean) => void
  showEmojiPicker: boolean
  setShowEmojiPicker: (value: boolean) => void
  videoFile: File | null
  videoDuration: number
  formatTime: (seconds: number) => string
  formatFileSize: (bytes: number) => string
  onInsertHashtag: (tag: string) => void
  onInsertEmoji: (emoji: string) => void
}

const POPULAR_HASHTAGS = ['africa', 'connectafrik', 'viral', 'fyp', 'trending', 'reels']

export function DetailsForm({
  title,
  setTitle,
  description,
  setDescription,
  category,
  setCategory,
  aspectRatio,
  setAspectRatio,
  tags,
  newTag,
  setNewTag,
  addTag,
  removeTag,
  isPublic,
  setIsPublic,
  showAdvanced,
  setShowAdvanced,
  showEmojiPicker,
  setShowEmojiPicker,
  videoFile,
  videoDuration,
  formatTime,
  formatFileSize,
  onInsertHashtag,
  onInsertEmoji,
}: DetailsFormProps) {
  const categoryHashtags = useMemo(
    () =>
      REEL_CATEGORIES.filter((c) => c.value !== 'other')
        .slice(0, 6)
        .map((c) => c.value),
    []
  )

  const handleEmojiSelect = (emoji: string) => {
    onInsertEmoji(emoji)
    setShowEmojiPicker(false)
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <section
        aria-labelledby="caption-heading"
        className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
      >
        <h2 id="caption-heading" className="text-base font-semibold text-content">
          Details
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="memory-title" className="mb-1.5 block text-sm font-medium text-content">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="memory-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your memory a catchy title…"
              className="input-field"
              maxLength={MAX_REEL_TITLE_LENGTH}
              required
              aria-describedby="title-counter"
            />
            <p id="title-counter" className="mt-1 text-right text-xs text-content-secondary">
              {title.length}/{MAX_REEL_TITLE_LENGTH}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="memory-description" className="text-sm font-medium text-content">
                Description
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
                  aria-expanded={showEmojiPicker}
                  aria-controls="description-emoji-picker"
                >
                  <Smile className="h-4 w-4" aria-hidden />
                  Emoji
                </button>
                {showEmojiPicker && (
                  <div id="description-emoji-picker">
                    <EmojiPicker
                      isOpen={showEmojiPicker}
                      onClose={() => setShowEmojiPicker(false)}
                      onEmojiSelect={handleEmojiSelect}
                      variant="compact"
                    />
                  </div>
                )}
              </div>
            </div>
            <textarea
              id="memory-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what your memory is about… Use #hashtags to reach more viewers"
              rows={4}
              className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm text-content placeholder:text-content-tertiary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--african-orange)] sm:text-base"
              maxLength={MAX_REEL_DESCRIPTION_LENGTH}
              aria-describedby="description-counter hashtag-suggestions"
            />
            <p id="description-counter" className="mt-1 text-right text-xs text-content-secondary">
              {description.length}/{MAX_REEL_DESCRIPTION_LENGTH}
            </p>

            <div id="hashtag-suggestions" className="mt-3">
              <p className="mb-2 flex items-center gap-1 text-xs font-medium text-content-secondary">
                <Hash className="h-3.5 w-3.5" aria-hidden />
                Suggested hashtags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...POPULAR_HASHTAGS, ...categoryHashtags]
                  .filter((tag, i, arr) => arr.indexOf(tag) === i)
                  .slice(0, 8)
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onInsertHashtag(tag)}
                      className="rounded-full bg-surface-canvas px-2.5 py-1 text-xs font-medium text-content-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--african-orange)_12%,var(--surface-canvas))] hover:text-content"
                    >
                      #{tag}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-content">Who can view this?</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Privacy">
              <label
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition-all ${
                  isPublic
                    ? 'border-[var(--african-orange)] bg-[color-mix(in_srgb,var(--african-orange)_8%,var(--surface))]'
                    : 'border-border hover:bg-surface-canvas'
                }`}
              >
                <input
                  type="radio"
                  name="privacy"
                  checked={isPublic}
                  onChange={() => setIsPublic(true)}
                  className="sr-only"
                />
                <Globe className="h-4 w-4 text-content-secondary" aria-hidden />
                <span className="text-sm font-medium text-content">Public</span>
              </label>

              <label
                className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition-all ${
                  !isPublic
                    ? 'border-[var(--african-orange)] bg-[color-mix(in_srgb,var(--african-orange)_8%,var(--surface))]'
                    : 'border-border hover:bg-surface-canvas'
                }`}
              >
                <input
                  type="radio"
                  name="privacy"
                  checked={!isPublic}
                  onChange={() => setIsPublic(false)}
                  className="sr-only"
                />
                <Lock className="h-4 w-4 text-content-secondary" aria-hidden />
                <span className="text-sm font-medium text-content">Private</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
          aria-expanded={showAdvanced}
          aria-controls="advanced-settings-panel"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-content-secondary" aria-hidden />
            <span className="text-sm font-semibold text-content sm:text-base">More options</span>
            {tags.length > 0 && (
              <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-medium text-content-secondary">
                {tags.length} tag{tags.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <ChevronDown
            className={`h-5 w-5 text-content-secondary transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {showAdvanced && (
          <div id="advanced-settings-panel" className="space-y-4 border-t border-border px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <div>
              <label htmlFor="memory-tag" className="mb-1.5 block text-sm font-medium text-content">
                Tags <span className="font-normal text-content-secondary">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="memory-tag"
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Add a tag…"
                  className="input-field flex-1"
                  maxLength={20}
                />
                <button
                  type="button"
                  onClick={addTag}
                  disabled={!newTag.trim() || tags.length >= MAX_REEL_TAGS}
                  className="btn-secondary shrink-0 px-3 text-sm disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-xs text-content"
                    >
                      <Tag className="h-3 w-3 text-content-secondary" aria-hidden />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-content-secondary hover:text-content"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-content-secondary">{tags.length}/{MAX_REEL_TAGS} tags</p>
            </div>

            <div>
              <label htmlFor="memory-category" className="mb-1.5 block text-sm font-medium text-content">
                Category
              </label>
              <select
                id="memory-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ReelCategory)}
                className="input-field"
              >
                {REEL_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-content">Aspect ratio</p>
              <div className="grid grid-cols-2 gap-2">
                {REEL_ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.value}
                    type="button"
                    onClick={() => setAspectRatio(ratio.value as '9:16' | '16:9' | '1:1' | '4:3')}
                    className={`rounded-xl border p-2.5 text-left text-xs font-medium transition-all sm:text-sm ${
                      aspectRatio === ratio.value
                        ? 'border-[var(--african-orange)] bg-[color-mix(in_srgb,var(--african-orange)_10%,var(--surface))] text-[var(--african-orange-dark)] ring-1 ring-[color-mix(in_srgb,var(--african-orange)_30%,transparent)]'
                        : 'border-border text-content-secondary hover:border-border-subtle hover:bg-surface-canvas'
                    }`}
                    aria-pressed={aspectRatio === ratio.value}
                  >
                    <span className="mr-1">{ratio.icon}</span>
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            {videoFile && (
              <div className="rounded-xl bg-surface-canvas p-3 sm:p-4">
                <h3 className="mb-2 text-sm font-medium text-content">File information</h3>
                <dl className="space-y-1.5 text-xs text-content-secondary sm:text-sm">
                  <div className="flex justify-between gap-3">
                    <dt>File</dt>
                    <dd className="truncate font-medium text-content">{videoFile.name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Size</dt>
                    <dd className="font-medium text-content">{formatFileSize(videoFile.size)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Duration</dt>
                    <dd className="font-medium text-content">{formatTime(videoDuration)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Type</dt>
                    <dd className="font-medium text-content">{videoFile.type || 'video'}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
