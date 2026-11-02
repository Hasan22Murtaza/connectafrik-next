'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useReel } from '@/shared/hooks/useReels'
import { useMembers } from '@/shared/hooks/useMembers'
import ReelShortsSlide from '@/features/social/components/ReelShortsSlide'
import ShareModal from '@/features/social/components/ShareModal'
import ReelComments from '@/features/social/components/ReelComments'
import { sendNotification } from '@/shared/services/notificationService'
import toast from 'react-hot-toast'

export default function ReelDetailClient({ reelId }: { reelId: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const { reel, loading, error } = useReel(reelId)
  const [shareOpen, setShareOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const { members } = useMembers(shareOpen)

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/reels/${reelId}`
    return `${window.location.origin}/reels/${reelId}`
  }, [reelId])

  const handleSendToMembers = async (memberIds: string[], message: string) => {
    if (!memberIds.length || !reel) return
    const senderName = user?.user_metadata?.full_name || user?.email || 'Someone'
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
            reel_id: reel.id,
            sender_id: user?.id || '',
            sender_name: senderName,
            message,
            url: `/reels/${reel.id}`,
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
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  if (error || !reel) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-content">This reel isn&apos;t available</h1>
          <p className="mt-2 text-sm text-content-secondary">
            It may have been deleted, or the link may be incorrect.
          </p>
          <button type="button" onClick={() => router.push('/reels/foryou')} className="btn-primary mt-6">
            Back to Reels
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg items-center justify-center">
        <div className="h-[calc(100dvh-4rem)] w-full">
          <ReelShortsSlide
            reel={reel}
            isActive
            loadMedia
            onComment={() => setCommentsOpen(true)}
            onShare={() => setShareOpen(true)}
            isOwner={Boolean(user?.id && user.id === reel.author_id)}
            onEdit={() => undefined}
            onDelete={() => undefined}
          />
        </div>
      </div>
      {commentsOpen && (
        <ReelComments
          reelId={reel.id}
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          commentsCount={reel.comments_count}
        />
      )}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        postUrl={shareUrl}
        postId={reel.id}
        members={members}
        onSendToMembers={handleSendToMembers}
      />
    </div>
  )
}
