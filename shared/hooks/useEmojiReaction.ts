import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
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

      const { data: existingReaction, error: checkError } = await supabase
        .from(reactionsTable)
        .select('id, reaction_type')
        .eq(postIdColumn, postId)
        .eq('user_id', user.id)
        .single()

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
          console.error('Error removing reaction:', deleteError)
          toast.error('Failed to remove reaction')
          return
        }

        const { data: currentPost } = await supabase
          .from(postsTable)
          .select('likes_count')
          .eq('id', postId)
          .single()

        if (currentPost) {
          const newCount = Math.max(0, (currentPost.likes_count || 0) - 1)
          await supabase.from(postsTable).update({ likes_count: newCount }).eq('id', postId)
        }

        onLikesCountChange?.(postId, -1)
        toast.success('Reaction removed')
        window.dispatchEvent(new CustomEvent(eventName, { detail: { postId } }))
        return
      }

      if (existingReaction) {
        const { error: updateError } = await supabase
          .from(reactionsTable)
          .update({ reaction_type: reactionType })
          .eq(postIdColumn, postId)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Error updating reaction:', updateError)
          toast.error('Failed to update reaction')
          return
        }

        toast.success('Reaction updated')
        window.dispatchEvent(new CustomEvent(eventName, { detail: { postId } }))
        return
      }

      const { error: insertError } = await supabase
        .from(reactionsTable)
        .insert({ [postIdColumn]: postId, user_id: user.id, reaction_type: reactionType })

      if (insertError) {
        console.error('Error inserting reaction:', insertError)
        toast.error('Failed to save reaction')
        return
      }

      const selectFields = trackEngagement ? 'likes_count, author_id' : 'likes_count'
      const { data: currentPost } = await supabase
        .from(postsTable)
        .select(selectFields)
        .eq('id', postId)
        .single()

      if (currentPost) {
        const newCount = (currentPost.likes_count || 0) + 1
        await supabase.from(postsTable).update({ likes_count: newCount }).eq('id', postId)

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
