import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { getReactionTypeFromEmoji } from '@/shared/utils/reactionUtils'
import { trackEvent } from '@/features/social/services/engagementTracking'
import toast from 'react-hot-toast'

interface UseEmojiReactionOptions {
  eventName?: string
  onLikesCountChange?: (postId: string, delta: number) => void
  trackEngagement?: boolean
  reactionEndpoint?: (postId: string) => string
}

interface ReactionResponse {
  action: 'added' | 'updated' | 'removed'
  reaction_type: string
}

export function useEmojiReaction(options: UseEmojiReactionOptions = {}) {
  const { user } = useAuth()

  const {
    eventName = 'reaction-updated',
    onLikesCountChange,
    trackEngagement = false,
    reactionEndpoint,
  } = options

  const handleEmojiReaction = useCallback(async (postId: string, emoji: string) => {
    try {
      if (!user) {
        toast.error('Please sign in to react')
        return
      }

      const reactionType = getReactionTypeFromEmoji(emoji)
      const endpoint = reactionEndpoint?.(postId) ?? `/api/posts/${postId}/reaction`
      const response = await apiClient.post<ReactionResponse>(
        endpoint,
        { reaction_type: reactionType }
      )

      if (response.action === 'removed') {
        onLikesCountChange?.(postId, -1)
        toast.success('Reaction removed')
      } else if (response.action === 'updated') {
        toast.success('Reaction updated')
      } else if (response.action === 'added') {
        onLikesCountChange?.(postId, 1)
        if (trackEngagement && user.id) {
          trackEvent.like(user.id, postId)
        }
        toast.success('Reaction saved!')
      }

      window.dispatchEvent(new CustomEvent(eventName, { detail: { postId } }))
    } catch (error: any) {
      console.error('Error handling emoji reaction:', error)
      toast.error('Something went wrong')
    }
  }, [user, eventName, onLikesCountChange, trackEngagement, reactionEndpoint])

  return handleEmojiReaction
}
