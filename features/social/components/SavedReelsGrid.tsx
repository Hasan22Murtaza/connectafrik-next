'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useMembers } from '@/shared/hooks/useMembers'
import { useDeleteReel } from '@/shared/hooks/useReels'
import { trackEvent } from '@/features/social/services/engagementTracking'
import { sendNotification } from '@/shared/services/notificationService'
import { Reel } from '@/shared/types/reels'
import { ReelCard } from './ReelCard'
import MemoryShortsSlide from './MemoryShortsSlide'
import ReelComments from './ReelComments'
import ShareModal from './ShareModal'
import toast from 'react-hot-toast'

type Props = {
  reels: Reel[]
  onReelDeleted?: (reelId: string) => void
}

/**
 * Full-screen vertical feed overlay that reuses the exact reels-page slide
 * design (MemoryShortsSlide) so saved reels look identical to the reels page.
 */
const SavedReelsFeedOverlay: React.FC<{
  reels: Reel[]
  startReelId: string
  onClose: () => void
  onReelDeleted?: (reelId: string) => void
}> = ({ reels, startReelId, onClose, onReelDeleted }) => {
  const { user } = useAuth()
  const { members } = useMembers()
  const { deleteReel } = useDeleteReel()

  const scrollRef = useRef<HTMLDivElement>(null)
  const intersectionRatiosRef = useRef<Map<string, number>>(new Map())
  const [activeReelId, setActiveReelId] = useState<string>(startReelId)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [shareState, setShareState] = useState<{ open: boolean; reelId: string | null }>({
    open: false,
    reelId: null,
  })

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const el = root.querySelector(`[data-reel-id="${startReelId}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'start' })
  }, [startReelId])

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
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        }
        if (bestId && bestRatio >= 0.55) setActiveReelId(bestId)
      },
      { root, threshold: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1] }
    )
    root.querySelectorAll('[data-memory-slide]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [reels])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const activeIndex = useMemo(() => {
    const i = reels.findIndex((r) => r.id === activeReelId)
    return i >= 0 ? i : 0
  }, [reels, activeReelId])

  const shouldLoadMedia = useCallback((index: number) => Math.abs(activeIndex - index) <= 1, [activeIndex])

  const handleLikeTracked = useCallback(
    (reelId: string) => {
      if (user?.id) trackEvent.like(user.id, reelId, 'reel')
    },
    [user?.id]
  )

  const handleDelete = useCallback(
    async (reelId: string) => {
      if (!window.confirm('Delete this memory? This action cannot be undone.')) return
      const { success, error } = await deleteReel(reelId)
      if (success) {
        toast.success('Memory deleted')
        onReelDeleted?.(reelId)
      } else {
        toast.error(error || 'Failed to delete memory')
      }
    },
    [deleteReel, onReelDeleted]
  )

  const shareUrl = useMemo(() => {
    if (!shareState.reelId) return ''
    if (typeof window === 'undefined') return `/memories/${shareState.reelId}`
    return `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/memories/${shareState.reelId}`
  }, [shareState.reelId])

  const handleSendToMembers = useCallback(
    async (memberIds: string[], message: string) => {
      if (!memberIds.length) {
        toast.success('No members selected')
        return
      }
      const senderName = user?.user_metadata?.full_name || user?.email || 'Someone'
      const reelId = shareState.reelId
      const results = await Promise.allSettled(
        memberIds.map((memberId) =>
          sendNotification({
            user_id: memberId,
            title: 'Memory Shared With You',
            body: message
              ? `${senderName} shared a memory with you: "${message}"`
              : `${senderName} shared a memory with you`,
            notification_type: 'post_share',
            data: {
              type: 'reel_share',
              reel_id: reelId || '',
              sender_id: user?.id || '',
              sender_name: senderName,
              message,
              url: `/memories/${reelId}`,
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
    [user, shareState.reelId]
  )

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        ref={scrollRef}
        className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch] snap-y snap-mandatory"
        style={{ scrollSnapStop: 'always' } as React.CSSProperties}
      >
        {reels.map((reel, index) => (
          <MemoryShortsSlide
            key={reel.id}
            reel={reel}
            isActive={activeReelId === reel.id}
            loadMedia={shouldLoadMedia(index)}
            onLikeTracked={handleLikeTracked}
            onComment={() => setShowCommentsFor(reel.id)}
            onShare={() => setShareState({ open: true, reelId: reel.id })}
            isOwner={!!user?.id && user.id === reel.author_id}
            onEdit={() => toast('Open the reel on the Memories page to edit.')}
            onDelete={() => handleDelete(reel.id)}
          />
        ))}
      </div>

      {showCommentsFor && (
        <ReelComments reelId={showCommentsFor} isOpen={!!showCommentsFor} onClose={() => setShowCommentsFor(null)} />
      )}

      {shareState.reelId && (
        <ShareModal
          isOpen={shareState.open}
          onClose={() => setShareState({ open: false, reelId: null })}
          postUrl={shareUrl}
          postId={shareState.reelId}
          members={members}
          onSendToMembers={handleSendToMembers}
        />
      )}
    </div>
  )
}

export const SavedReelsGrid: React.FC<Props> = ({ reels, onReelDeleted }) => {
  const [startReelId, setStartReelId] = useState<string | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5 xl:grid-cols-6">
        {reels.map((reel) => (
          <ReelCard key={reel.id} reel={reel} onClick={() => setStartReelId(reel.id)} />
        ))}
      </div>

      {startReelId && (
        <SavedReelsFeedOverlay
          reels={reels}
          startReelId={startReelId}
          onClose={() => setStartReelId(null)}
          onReelDeleted={(id) => {
            onReelDeleted?.(id)
            setStartReelId(null)
          }}
        />
      )}
    </>
  )
}

export default SavedReelsGrid
