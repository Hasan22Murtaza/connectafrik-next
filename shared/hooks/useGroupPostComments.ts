import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export interface GroupPostComment {
  id: string
  group_post_id: string
  author_id: string
  content: string
  parent_id: string | null
  likes_count: number
  created_at: string
  updated_at: string
  author?: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    country: string | null
  }
  replies?: GroupPostComment[]
  isLiked?: boolean
}

export const useGroupPostComments = (groupPostId: string) => {
  const { user } = useAuth()
  const [comments, setComments] = useState<GroupPostComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    if (!groupPostId) return

    try {
      setLoading(true)
      setError(null)

      // Fetch all comments for this group post
      const { data: commentsData, error: commentsError } = await supabase
        .from('group_post_comments')
        .select('*')
        .eq('group_post_id', groupPostId)
        .is('parent_id', null)
        .order('created_at', { ascending: true })

      if (commentsError) throw commentsError

      if (!commentsData || commentsData.length === 0) {
        setComments([])
        setLoading(false)
        return
      }

      // Fetch author profiles
      const authorIds = [...new Set(commentsData.map(c => c.author_id))]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, country')
        .in('id', authorIds)

      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.id, profile])
      )

      // Fetch replies for each comment
      const commentIds = commentsData.map(c => c.id)
      const { data: repliesData } = await supabase
        .from('group_post_comments')
        .select('*')
        .in('parent_id', commentIds)
        .order('created_at', { ascending: true })

      // Fetch reply author profiles
      if (repliesData && repliesData.length > 0) {
        const replyAuthorIds = [...new Set(repliesData.map(r => r.author_id))]
        const { data: replyProfilesData } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, country')
          .in('id', replyAuthorIds)

        replyProfilesData?.forEach(profile => {
          profilesMap.set(profile.id, profile)
        })
      }

      // Check which comments the current user has liked
      let likesData: any[] = []
      if (user) {
        const allCommentIds = [
          ...commentsData.map(c => c.id),
          ...(repliesData || []).map(r => r.id)
        ]
        
        if (allCommentIds.length > 0) {
          const { data } = await supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', user.id)
            .in('comment_id', allCommentIds)

          if (data) {
            likesData = data
          }
        }
      }

      // Organize comments with replies
      const commentsWithReplies = commentsData.map(comment => {
        const commentReplies = (repliesData || [])
          .filter(reply => reply.parent_id === comment.id)
          .map(reply => ({
            ...reply,
            author: profilesMap.get(reply.author_id) || {
              id: reply.author_id,
              username: 'Unknown',
              full_name: 'Unknown User',
              avatar_url: null,
              country: null
            },
            isLiked: likesData.some(like => like.comment_id === reply.id),
            replies: []
          }))

        return {
          ...comment,
          author: profilesMap.get(comment.author_id) || {
            id: comment.author_id,
            username: 'Unknown',
            full_name: 'Unknown User',
            avatar_url: null,
            country: null
          },
          replies: commentReplies,
          isLiked: likesData.some(like => like.comment_id === comment.id)
        }
      })

      setComments(commentsWithReplies)
    } catch (err: any) {
      console.error('Error fetching group post comments:', err)
      setError(err.message)
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [groupPostId, user?.id])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const addComment = async (content: string, parentId?: string) => {
    if (!user) {
      toast.error('You must be logged in to comment')
      return { error: 'Not authenticated' }
    }

    if (!content.trim()) {
      toast.error('Comment cannot be empty')
      return { error: 'Empty comment' }
    }

    try {
      const { data, error } = await supabase
        .from('group_post_comments')
        .insert({
          group_post_id: groupPostId,
          author_id: user.id,
          content: content.trim(),
          parent_id: parentId || null,
          likes_count: 0
        })
        .select('*')
        .single()

      if (error) throw error

      // Fetch author profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, country')
        .eq('id', user.id)
        .single()

      const newComment: GroupPostComment = {
        ...data,
        author: profileData || {
          id: user.id,
          username: 'Unknown',
          full_name: 'Unknown User',
          avatar_url: null,
          country: null
        },
        replies: [],
        isLiked: false
      }

      // Update comments count on the post
      try {
        const { error: rpcError } = await supabase.rpc('increment', {
          table_name: 'group_posts',
          column_name: 'comments_count',
          row_id: groupPostId,
          increment_value: 1
        })
        
        if (rpcError) {
          // Fallback if RPC doesn't exist
          const { data: postData } = await supabase
            .from('group_posts')
            .select('comments_count')
            .eq('id', groupPostId)
            .single()
            
          if (postData) {
            await supabase
              .from('group_posts')
              .update({ comments_count: (postData.comments_count || 0) + 1 })
              .eq('id', groupPostId)
          }
        }
      } catch (rpcErr) {
        // Fallback if RPC doesn't exist
        const { data: postData } = await supabase
          .from('group_posts')
          .select('comments_count')
          .eq('id', groupPostId)
          .single()
          
        if (postData) {
          await supabase
            .from('group_posts')
            .update({ comments_count: (postData.comments_count || 0) + 1 })
            .eq('id', groupPostId)
        }
      }

      if (parentId) {
        // Add as reply to parent comment
        setComments(prev => prev.map(comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment]
            }
          }
          return comment
        }))
      } else {
        // Add as top-level comment
        setComments(prev => [...prev, newComment])
      }

      toast.success('Comment posted!')
      return { error: null }
    } catch (err: any) {
      console.error('Error adding comment:', err)
      toast.error(err.message || 'Failed to post comment')
      return { error: err.message || 'Failed to post comment' }
    }
  }

  const toggleLike = async (commentId: string) => {
    if (!user) {
      toast.error('You must be logged in to like comments')
      return
    }

    try {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .single()

      if (existingLike) {
        // Unlike
        await supabase
          .from('comment_likes')
          .delete()
          .eq('id', existingLike.id)

        setComments(prev => updateCommentLikes(prev, commentId, -1, false))
      } else {
        // Like
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: user.id
          })

        setComments(prev => updateCommentLikes(prev, commentId, 1, true))
      }
    } catch (err: any) {
      console.error('Error toggling like:', err)
      toast.error('Failed to update like')
    }
  }

  const updateCommentLikes = (
    comments: GroupPostComment[],
    commentId: string,
    increment: number,
    isLiked: boolean
  ): GroupPostComment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          likes_count: Math.max(0, comment.likes_count + increment),
          isLiked
        }
      }
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentLikes(comment.replies, commentId, increment, isLiked)
        }
      }
      return comment
    })
  }

  const deleteComment = async (commentId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('group_post_comments')
        .delete()
        .eq('id', commentId)
        .eq('author_id', user.id)

      if (error) throw error

      // Update comments count on the post
      try {
        const { error: rpcError } = await supabase.rpc('increment', {
          table_name: 'group_posts',
          column_name: 'comments_count',
          row_id: groupPostId,
          increment_value: -1
        })
        
        if (rpcError) {
          // Fallback if RPC doesn't exist
          const { data: postData } = await supabase
            .from('group_posts')
            .select('comments_count')
            .eq('id', groupPostId)
            .single()
            
          if (postData) {
            await supabase
              .from('group_posts')
              .update({ comments_count: Math.max(0, (postData.comments_count || 0) - 1) })
              .eq('id', groupPostId)
          }
        }
      } catch (rpcErr) {
        // Fallback if RPC doesn't exist
        const { data: postData } = await supabase
          .from('group_posts')
          .select('comments_count')
          .eq('id', groupPostId)
          .single()
          
        if (postData) {
          await supabase
            .from('group_posts')
            .update({ comments_count: Math.max(0, (postData.comments_count || 0) - 1) })
            .eq('id', groupPostId)
        }
      }

      setComments(prev => prev.filter(c => c.id !== commentId).map(comment => ({
        ...comment,
        replies: comment.replies?.filter(r => r.id !== commentId)
      })))

      toast.success('Comment deleted')
    } catch (err: any) {
      console.error('Error deleting comment:', err)
      toast.error(err.message || 'Failed to delete comment')
    }
  }

  return {
    comments,
    loading,
    error,
    addComment,
    toggleLike,
    deleteComment,
    refetch: fetchComments
  }
}

