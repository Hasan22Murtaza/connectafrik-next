import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
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

export const useGroupPostComments = (groupId: string, groupPostId: string) => {
  const { user } = useAuth()
  const [comments, setComments] = useState<GroupPostComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    if (!groupPostId || !groupId) return

    try {
      setLoading(true)
      setError(null)

      const res = await apiClient.get<{ data: GroupPostComment[] }>(
        `/api/groups/${groupId}/posts/${groupPostId}/comments`
      )
      const commentsData = res.data || []

      setComments(
        commentsData.map((c: GroupPostComment) => ({
          ...c,
          author: c.author ?? {
            id: c.author_id,
            username: 'Unknown',
            full_name: 'Unknown User',
            avatar_url: null,
            country: null
          },
          replies: (c.replies || []).map((r: GroupPostComment) => ({
            ...r,
            author: r.author ?? {
              id: r.author_id,
              username: 'Unknown',
              full_name: 'Unknown User',
              avatar_url: null,
              country: null
            },
            replies: []
          }))
        }))
      )
    } catch (err: any) {
      console.error('Error fetching group post comments:', err)
      setError(err.message)
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [groupId, groupPostId, user?.id])

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
      const res = await apiClient.post<{ data: GroupPostComment }>(
        `/api/groups/${groupId}/posts/${groupPostId}/comments`,
        { content: content.trim(), parent_id: parentId || null }
      )

      const newComment: GroupPostComment = {
        ...res.data,
        author: res.data.author ?? {
          id: user.id,
          username: 'Unknown',
          full_name: 'Unknown User',
          avatar_url: null,
          country: null
        },
        replies: [],
        isLiked: false
      }

      if (parentId) {
        setComments(prev =>
          prev.map(comment =>
            comment.id === parentId
              ? { ...comment, replies: [...(comment.replies || []), newComment] }
              : comment
          )
        )
      } else {
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

  const updateCommentLikes = (
    commentsList: GroupPostComment[],
    commentId: string,
    increment: number,
    isLiked: boolean
  ): GroupPostComment[] => {
    return commentsList.map(comment => {
      if (comment.id === commentId) {
        return { ...comment, likes_count: Math.max(0, comment.likes_count + increment), isLiked }
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

  const toggleLike = async (commentId: string) => {
    if (!user) {
      toast.error('You must be logged in to like comments')
      return
    }

    try {
      const res = await apiClient.post<{ liked: boolean }>(
        `/api/groups/${groupId}/posts/${groupPostId}/comments/${commentId}/like`
      )

      setComments(prev =>
        updateCommentLikes(prev, commentId, res.liked ? 1 : -1, res.liked)
      )
    } catch (err: any) {
      console.error('Error toggling like:', err)
      toast.error('Failed to update like')
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!user) return

    try {
      await apiClient.delete(`/api/groups/${groupId}/posts/${groupPostId}/comments/${commentId}`)

      setComments(prev =>
        prev
          .filter(c => c.id !== commentId)
          .map(comment => ({
            ...comment,
            replies: comment.replies?.filter(r => r.id !== commentId)
          }))
      )

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
