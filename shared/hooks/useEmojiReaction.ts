import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { getReactionTypeFromEmoji } from '@/shared/utils/reactionUtils'
import { updateEngagementReward } from '@/features/social/services/fairnessRankingService'
import { trackEvent } from '@/features/social/services/engagementTracking'
import toast from 'react-hot-toast'

interface UseEmojiReactionOptions {
  reactionsTable?: string
  postIdColumn?: string
  postsTable?: string
  eventName?: string
  onLikesCountChange?: (postId: string, delta: number) => void
  trackEngagement?: boolean
}

interface ReactionResponse {
  action: 'added' | 'updated' | 'removed'
  reaction_type: string
}

export function useEmojiReaction(options: UseEmojiReactionOptions = {}) {
  const { user } = useAuth()

  const {
    reactionsTable = 'post_reactions',
    postIdColumn = 'post_id',
    postsTable = 'posts',
    eventName = 'reaction-updated',
    onLikesCountChange,
    trackEngagement = false,
  } = options

  const handleEmojiReaction = useCallback(async (postId: string, emoji: string) => {
    try {
      if (!user) {
        toast.error('Please sign in to react')
        return
      }

      const reactionType = getReactionTypeFromEmoji(emoji)

      // For standard post_reactions, use the API
      if (reactionsTable === 'post_reactions' && postIdColumn === 'post_id' && postsTable === 'posts') {
        const response = await apiClient.post<ReactionResponse>(
          `/api/posts/${postId}/reaction`,
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
        return
      }

      // Fallback for non-standard tables (e.g. group_post_reactions) — use Supabase directly
      const { supabase } = await import('@/lib/supabase')

      const { data: existingReaction, error: checkError } = await supabase
        .from(reactionsTable)
        .select('id, reaction_type')
        .eq(postIdColumn, postId)
        .eq('user_id', user.id)
        .single() as { data: { id: string; reaction_type: string } | null; error: any }

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing reaction:', checkError)
        toast.error('Failed to check reaction')
        return
      }

      if (existingReaction && existingReaction.reaction_type === reactionType) {
        const { error: deleteError } = await supabase
          .from(reactionsTable)
          .delete()
          .eq(postIdColumn, postId)
          .eq('user_id', user.id)
          .eq('reaction_type', reactionType)

        if (deleteError) {
          toast.error('Failed to remove reaction')
          return
        }

        const { data: currentPost } = await supabase
          .from(postsTable)
          .select('likes_count')
          .eq('id', postId)
          .single() as { data: { likes_count: number } | null; error: any }

        if (currentPost) {
          const newCount = Math.max(0, (currentPost.likes_count || 0) - 1)
          await supabase.from(postsTable).update({ likes_count: newCount } as any).eq('id', postId)
        }

        onLikesCountChange?.(postId, -1)
        toast.success('Reaction removed')
        window.dispatchEvent(new CustomEvent(eventName, { detail: { postId } }))
        return
      }

      if (existingReaction) {
        const { error: updateError } = await supabase
          .from(reactionsTable)
          .update({ reaction_type: reactionType } as any)
          .eq(postIdColumn, postId)
          .eq('user_id', user.id)

        if (updateError) {
          toast.error('Failed to update reaction')
          return
        }

        toast.success('Reaction updated')
        window.dispatchEvent(new CustomEvent(eventName, { detail: { postId } }))
        return
      }

      const { error: insertError } = await supabase
        .from(reactionsTable)
        .insert({ [postIdColumn]: postId, user_id: user.id, reaction_type: reactionType } as any)

      if (insertError) {
        toast.error('Failed to save reaction')
        return
      }

      const selectFields = trackEngagement ? 'likes_count, author_id' : 'likes_count'
      const { data: currentPost } = await supabase
        .from(postsTable)
        .select(selectFields)
        .eq('id', postId)
        .single() as { data: { likes_count: number; author_id?: string } | null; error: any }

      if (currentPost) {
        const newCount = (currentPost.likes_count || 0) + 1
        await supabase.from(postsTable).update({ likes_count: newCount } as any).eq('id', postId)

        if (trackEngagement && currentPost.author_id) {
          updateEngagementReward(currentPost.author_id, 'like')
        }
      }

      onLikesCountChange?.(postId, 1)

      if (trackEngagement && user.id) {
        trackEvent.like(user.id, postId)
      }

      toast.success('Reaction saved!')
      window.dispatchEvent(new CustomEvent(eventName, { detail: { postId } }))
    } catch (error: any) {
      console.error('Error handling emoji reaction:', error)
      toast.error('Something went wrong')
    }
  }, [user, reactionsTable, postIdColumn, postsTable, eventName, onLikesCountChange, trackEngagement])

  return handleEmojiReaction
}
