'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  Clock,
  Pencil,
  Trash2,
  X,
  Tag,
  Globe,
  Lock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
} from '@/shared/icons'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useReels, useUpdateReel, useDeleteReel } from '@/shared/hooks/useReels'
import { useMembers } from '@/shared/hooks/useMembers'
import ReelShortsSlide from '@/features/social/components/ReelShortsSlide'
import ShareModal from '@/features/social/components/ShareModal'
import ReelComments from '@/features/social/components/ReelComments'
import { ReelsNav } from '@/features/social/components/ReelsNav'
import { trackEvent } from '@/features/social/services/engagementTracking'
import { sendNotification } from '@/shared/services/notificationService'
import {
  REEL_CATEGORIES,
  MAX_REEL_TITLE_LENGTH,
  MAX_REEL_DESCRIPTION_LENGTH,
  MAX_REEL_TAGS,
} from '@/shared/types/reels'
import { Reel, ReelCategory, ReelFeedType } from '@/shared/types/reels'
import toast from 'react-hot-toast'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

type Props = {
  feed: ReelFeedType
  enabled?: boolean
  category?: ReelCategory
  exploreBackHref?: string
  startReelId?: string | null
  listBackLabel?: string
}

export function ReelsVerticalFeed({
  feed,
  enabled = true,
  category,
  exploreBackHref,
  startReelId,
  listBackLabel = 'Back',
}: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [shareModalState, setShareModalState] = useState<{ open: boolean; reelId: string | null }>({
    open: false,
    reelId: null,
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [commentsPanelEl, setCommentsPanelEl] = useState<HTMLDivElement | null>(null)
  const intersectionRatiosRef = useRef<Map<string, number>>(new Map())
  const [activeReelId, setActiveReelId] = useState<string | null>(null)

  const [editingReel, setEditingReel] = useState<Reel | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState<string>('entertainment')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editNewTag, setEditNewTag] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(true)

  const reelFilters = useMemo(() => {
    const f: { feed: ReelFeedType; category?: ReelCategory } = { feed }
    if (feed === 'explore' && category) f.category = category
    return f
  }, [feed, category])

  const sortOptions = useMemo(
    () =>
      feed === 'foryou'
        ? ({ field: 'engagement_score' as const, order: 'desc' as const })
        : ({ field: 'created_at' as const, order: 'desc' as const }),
    [feed]
  )

  const reelsEnabled = useMemo(() => {
    if (!enabled) return false
    if (feed === 'following' && !user?.id) return false
    if (feed === 'mine' && !user?.id) return false
    return true
  }, [enabled, feed, user?.id])

  const { reels, loading, error, hasMore, loadMore, refresh } = useReels(reelFilters, sortOptions, {
    enabled: reelsEnabled,
  })
  const { updateReel, loading: updating } = useUpdateReel()
  const { deleteReel, loading: deleting } = useDeleteReel()
  const { members } = useMembers()
  const memoizedMembers = useMemo(() => members, [members])
  const { confirm, dialog } = useConfirmDialog()

  const activeShareReel = useMemo(
    () => (shareModalState.reelId ? reels.find((reel) => reel.id === shareModalState.reelId) : null),
    [reels, shareModalState.reelId]
  )
  const activeCommentsReel = useMemo(
    () => (showCommentsFor ? reels.find((reel) => reel.id === showCommentsFor) : null),
    [reels, showCommentsFor]
  )
  const shareUrl = useMemo(() => {
    if (!shareModalState.reelId) return ''
    if (typeof window === 'undefined') return `/reels/${shareModalState.reelId}`
    return `${process.env.NEXT_PUBLIC_APP_URL}/reels/${shareModalState.reelId}`
  }, [shareModalState.reelId])

  const activeIndex = useMemo(() => {
    if (!activeReelId) return 0
    const i = reels.findIndex((r) => r.id === activeReelId)
    return i >= 0 ? i : 0
  }, [reels, activeReelId])

  useEffect(() => {
    intersectionRatiosRef.current = new Map()
  }, [reels])

  useEffect(() => {
    if (reels.length === 0) return
    if (startReelId && reels.some((r) => r.id === startReelId)) {
      setActiveReelId(startReelId)
      return
    }
    setActiveReelId((prev) => prev ?? reels[0].id)
  }, [reels, startReelId])

  useEffect(() => {
    if (!startReelId || reels.length === 0) return
    const root = scrollRef.current
    if (!root) return
    const slide = root.querySelector(`[data-reel-id="${startReelId}"]`) as HTMLElement | null
    if (!slide) return
    slide.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [reels, startReelId])

  useEffect(() => {
    if (activeReelId && reels.length > 0 && !reels.some((r) => r.id === activeReelId)) {
      setActiveReelId(reels[0].id)
    }
  }, [reels, activeReelId])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || reels.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.reelId
          if (id) intersectionRatiosRef.current.set(id, entry.intersectionRatio)
        }
        let bestId: string | null = null
        let bestRatio = 0
        for (const [id, ratio] of intersectionRatiosRef.current) {
          if (!reels.some((r) => r.id === id)) continue
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        }
        if (bestId && bestRatio >= 0.55) {
          setActiveReelId(bestId)
        }
      },
      { root, threshold: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1] }
    )

    root.querySelectorAll('[data-reel-slide]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [reels])

  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel || !hasMore) return

    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries
        if (e?.isIntersecting && !loading) loadMore()
      },
      { root, rootMargin: '400px 0px' }
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasMore, loading, loadMore, reels.length])

  const handleLikeTracked = useCallback(
    (reelId: string) => {
      if (user?.id) trackEvent.like(user.id, reelId, 'reel')
    },
    [user?.id]
  )

  const handleCommentOpen = useCallback((reelId: string) => {
    setShowCommentsFor(reelId)
  }, [])

  const handleShare = useCallback((reelId: string) => {
    setShareModalState({ open: true, reelId })
  }, [])

  const handleDelete = useCallback(
    async (reelId: string) => {
      const confirmed = await confirm({
        title: 'Delete Reel',
        message: 'Are you sure you want to delete this reel? This action cannot be undone.',
        confirmLabel: 'Delete',
      })
      if (!confirmed) {
        return
      }
      const { success, error: deleteError } = await deleteReel(reelId)
      if (success) {
        toast.success('Reel deleted successfully')
        refresh()
      } else {
        toast.error(deleteError || 'Failed to delete reel')
      }
    },
    [deleteReel, refresh, confirm]
  )

  const openEditModal = useCallback((reel: Reel) => {
    setEditingReel(reel)
    setEditTitle(reel.title)
    setEditDescription(reel.description || '')
    setEditCategory(reel.category)
    setEditTags(reel.tags || [])
    setEditIsPublic(reel.is_public)
    setEditNewTag('')
  }, [])

  const closeEditModal = useCallback(() => {
    setEditingReel(null)
    setEditTitle('')
    setEditDescription('')
    setEditCategory('entertainment')
    setEditTags([])
    setEditNewTag('')
    setEditIsPublic(true)
  }, [])

  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!editingReel) return
      if (!editTitle.trim()) {
        toast.error('Title is required')
        return
      }
      const { data, error: updateError } = await updateReel(editingReel.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory,
        tags: editTags,
        is_public: editIsPublic,
      })
      if (data) {
        toast.success('Reel updated successfully')
        closeEditModal()
        refresh()
      } else {
        toast.error(updateError || 'Failed to update reel')
      }
    },
    [editingReel, editTitle, editDescription, editCategory, editTags, editIsPublic, updateReel, closeEditModal, refresh]
  )

  const addEditTag = useCallback(() => {
    if (editNewTag.trim() && editTags.length < MAX_REEL_TAGS) {
      const tag = editNewTag.trim().toLowerCase()
      if (!editTags.includes(tag)) {
        setEditTags([...editTags, tag])
        setEditNewTag('')
      }
    }
  }, [editNewTag, editTags])

  const removeEditTag = useCallback(
    (tagToRemove: string) => {
      setEditTags(editTags.filter((tag) => tag !== tagToRemove))
    },
    [editTags]
  )

  const handleSendToMembers = useCallback(
    async (memberIds: string[], message: string) => {
      if (!memberIds.length) {
        toast.success('No members selected')
        return
      }
      const senderName = user?.user_metadata?.full_name || user?.email || 'Someone'
      const reelId = shareModalState.reelId
      const results = await Promise.allSettled(
        memberIds.map((memberId) =>
          sendNotification({
            user_id: memberId,
            title: 'Reel Shared With You',
            body: message
              ? `${senderName} shared a reel with you: "${message}"`
              : `${senderName} shared a reel with you`,
            notification_type: 'post_share',
            data: {
              type: 'reel_share',
              reel_id: reelId || '',
              sender_id: user?.id || '',
              sender_name: senderName,
              message,
              url: `/reels/${reelId}`,
            },
          })
        )
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
      if (succeeded > 0) {
        toast.success(`Shared with ${succeeded} member${succeeded === 1 ? '' : 's'}`)
      } else {
        toast.error('Failed to send notifications')
      }
    },
    [user, shareModalState.reelId]
  )

  const shouldLoadMedia = useCallback(
    (index: number) => {
      if (reels.length === 0) return false
      if (!activeReelId) return index <= 1
      return Math.abs(activeIndex - index) <= 1
    },
    [reels.length, activeReelId, activeIndex]
  )

  const emptyCopy = useMemo(() => {
    if (feed === 'following') {
      return {
        title: 'No reels from people you follow',
        subtitle: 'Follow creators to see their reels here.',
      }
    }
    if (feed === 'mine') {
      return {
        title: 'You have not posted any reels yet',
        subtitle: 'Upload your first full-screen reel.',
      }
    }
    return {
      title: 'No reels yet',
      subtitle: 'Create your first full-screen reel.',
    }
  }, [feed])

  if (!reelsEnabled) {
    const title = feed === 'following' ? 'Following' : 'My videos'
    const subtitle =
      feed === 'following'
        ? 'Sign in to see reels from creators you follow.'
        : 'Sign in to manage and watch your own reels.'
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4  px-6 text-center lg:min-h-[calc(100dvh-4.5rem)]">
        <h2 className="text-lg font-semibold text-content">{title}</h2>
        <p className="max-w-sm text-sm text-content-secondary">{subtitle}</p>
        <Link href="/signin" className="btn-primary inline-flex rounded-full px-8 py-2.5 text-sm font-semibold">
          Log in
        </Link>
      </div>
    )
  }

  if (loading && reels.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center bg-white text-content lg:min-h-[calc(100dvh-4.5rem)]">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--african-orange)]"
          aria-hidden
        />
        <p className="mt-4 text-sm text-content-secondary">Loading reels…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center bg-white px-6 text-center text-content lg:min-h-[calc(100dvh-4.5rem)]">
        <Clock className="mb-4 h-14 w-14 text-content-tertiary" />
        <h2 className="text-lg font-semibold">Couldn’t load reels</h2>
        <p className="mt-2 text-sm text-content-secondary">{error}</p>
        <button type="button" onClick={refresh} className="btn-primary mt-6">
          Try again
        </button>
      </div>
    )
  }

  if (reels.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-white px-6 pb-10 pt-16 text-center text-content lg:static lg:z-auto lg:min-h-[calc(100dvh-4.5rem)] lg:pb-6 lg:pt-0">
        <div className="fixed bottom-0 left-0 right-0 z-[46] border-t border-border bg-white/95 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 lg:hidden">
          <div className="mx-auto max-w-lg">
            <ReelsNav variant="video-bottom" />
          </div>
        </div>
        <Clock className="mb-4 h-14 w-14 text-content-tertiary" />
        <h2 className="text-lg font-semibold">{emptyCopy.title}</h2>
        <p className="mt-2 text-sm text-content-secondary">{emptyCopy.subtitle}</p>
        <Link href="/reels/create" className="btn-primary mt-6 inline-flex items-center gap-2 rounded-full">
          <Plus className="h-5 w-5" />
          Create reel
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-white lg:static lg:z-auto lg:min-h-[calc(100dvh-4.5rem)]">
        <div className="fixed bottom-0 left-0 right-0 z-[46] border-t border-border bg-white/95 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 lg:hidden">
          <div className="mx-auto max-w-lg">
            <ReelsNav variant="video-bottom" />
          </div>
        </div>

        <div className="lg:flex lg:min-h-[calc(100dvh-4.5rem)]">
          <div className="relative min-w-0 flex-1 bg-white">
            {exploreBackHref && (
              <button
                type="button"
                onClick={() => router.push(exploreBackHref)}
                className="absolute left-3 top-14 z-30 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-2 text-sm font-medium text-content shadow-sm ring-1 ring-border backdrop-blur-md transition hover:bg-surface sm:top-16 lg:left-6 lg:top-6"
              >
                <ChevronLeft className="h-4 w-4" />
                {listBackLabel}
              </button>
            )}

            <div
              className={`absolute top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 lg:flex ${
                showCommentsFor ? 'right-6' : 'right-4'
              }`}
            >
              <button
                type="button"
                aria-label="Previous reel"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-content-secondary shadow-sm transition hover:bg-surface-secondary"
                onClick={() => {
                  const el = scrollRef.current
                  if (!el) return
                  el.scrollBy({ top: -el.clientHeight, behavior: 'smooth' })
                }}
              >
                <ChevronUp className="h-6 w-6" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                aria-label="Next reel"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-content-secondary shadow-sm transition hover:bg-surface-secondary"
                onClick={() => {
                  const el = scrollRef.current
                  if (!el) return
                  el.scrollBy({ top: el.clientHeight, behavior: 'smooth' })
                }}
              >
                <ChevronDown className="h-6 w-6" strokeWidth={1.75} />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth bg-white [-webkit-overflow-scrolling:touch] snap-y snap-mandatory pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-14 sm:pt-16 lg:h-[calc(100dvh-4.5rem)] lg:pb-0 lg:pt-0"
              style={{ scrollSnapStop: 'always' } as React.CSSProperties}
            >
              {reels.map((reel, index) => (
                <ReelShortsSlide
                  key={reel.id}
                  reel={reel}
                  isActive={activeReelId === reel.id}
                  loadMedia={shouldLoadMedia(index)}
                  onLikeTracked={handleLikeTracked}
                  onComment={() => handleCommentOpen(reel.id)}
                  onShare={() => handleShare(reel.id)}
                  isOwner={!!user?.id && user.id === reel.author_id}
                  onEdit={() => openEditModal(reel)}
                  onDelete={() => handleDelete(reel.id)}
                />
              ))}

              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="flex h-24 w-full shrink-0 snap-start items-center justify-center bg-white"
                  aria-hidden
                >
                  {loading && (
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-[var(--african-orange)]" />
                  )}
                </div>
              )}
            </div>
          </div>

          {showCommentsFor && (
            <div
              ref={setCommentsPanelEl}
              className="hidden h-[calc(100dvh-4.5rem)] w-[min(420px,32vw)] shrink-0 border-l border-border bg-surface lg:block"
              aria-label="Comments panel"
            />
          )}
        </div>
      </div>

      {showCommentsFor && (
        <ReelComments
          reelId={showCommentsFor}
          isOpen={!!showCommentsFor}
          onClose={() => setShowCommentsFor(null)}
          commentsCount={activeCommentsReel?.comments_count}
          desktopContainer={commentsPanelEl}
          inlineDesktopPanel
        />
      )}

      {activeShareReel && (
        <ShareModal
          isOpen={shareModalState.open}
          onClose={() => setShareModalState({ open: false, reelId: null })}
          postUrl={shareUrl}
          postId={activeShareReel.id}
          members={memoizedMembers}
          onSendToMembers={handleSendToMembers}
        />
      )}

      {editingReel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-2xl">
            <div className="flex items-center justify-between bg-primary-600 px-5 py-4">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-white" />
                <h2 className="text-lg font-semibold text-white">Edit Reel</h2>
              </div>
              <button type="button" onClick={closeEditModal} className="text-white/80 transition-colors hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="max-h-[calc(90vh-4rem)] space-y-5 overflow-y-auto p-5">
              {editingReel.thumbnail_url && (
                <div className="flex justify-center">
                  <img
                    src={editingReel.thumbnail_url}
                    alt={editingReel.title}
                    className="h-44 w-32 rounded-lg border border-border object-cover"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Give your reel a title..."
                  className="input-field"
                  maxLength={MAX_REEL_TITLE_LENGTH}
                  required
                />
                <div className="mt-1 text-right text-xs text-content-tertiary">
                  {editTitle.length}/{MAX_REEL_TITLE_LENGTH}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Tell people what this reel is about..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm text-content placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                  maxLength={MAX_REEL_DESCRIPTION_LENGTH}
                ></textarea>
                <div className="mt-1 text-right text-xs text-content-tertiary">
                  {editDescription.length}/{MAX_REEL_DESCRIPTION_LENGTH}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as ReelCategory)}
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
                <label className="mb-1.5 block text-sm font-medium text-content">Tags</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editNewTag}
                      onChange={(e) => setEditNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addEditTag()
                        }
                      }}
                      placeholder="Add a tag..."
                      className="input-field flex-1"
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onClick={addEditTag}
                      disabled={!editNewTag.trim() || editTags.length >= MAX_REEL_TAGS}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  {editTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {editTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-xs text-content"
                        >
                          <Tag className="h-3 w-3" />
                          <span>{tag}</span>
                          <button type="button" onClick={() => removeEditTag(tag)} className="text-content-tertiary hover:text-gray-600">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-content-tertiary">
                    {editTags.length}/{MAX_REEL_TAGS} tags
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Privacy</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={editIsPublic}
                      onChange={() => setEditIsPublic(true)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <Globe className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-content">Public</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={!editIsPublic}
                      onChange={() => setEditIsPublic(false)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <Lock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-content">Private</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const confirmed = await confirm({
                        title: 'Delete Reel',
                        message: 'Are you sure you want to delete this reel? This action cannot be undone.',
                        confirmLabel: 'Delete',
                      })
                      if (!confirmed) return
                      const { success } = await deleteReel(editingReel.id)
                      if (success) {
                        toast.success('Reel deleted successfully')
                        closeEditModal()
                        refresh()
                      } else {
                        toast.error('Failed to delete reel')
                      }
                    })()
                  }}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-content transition-colors hover:bg-surface-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || !editTitle.trim()}
                    className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {dialog}
    </>
  )
}
