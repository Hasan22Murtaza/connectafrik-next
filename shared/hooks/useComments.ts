import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'


export type CommentAttachmentType = 'image' | 'gif' | 'sticker'

interface SerializedCommentAttachment {
  type: CommentAttachmentType
  url?: string
  value?: string
}

interface SerializedCommentPayload {
  text: string
  attachments?: SerializedCommentAttachment[]
}

export interface CommentAttachment {
  id: string
  type: CommentAttachmentType
  url?: string
  value?: string
}

export interface CommentContentPayload {
  text: string
  attachments?: CommentAttachment[]
}

export interface CommentAttachmentInput {
  type: CommentAttachmentType
  file?: File
  url?: string
  value?: string
}

export interface NewCommentPayload {
  text: string
  attachments?: CommentAttachmentInput[]
}

export interface UpdateCommentPayload {
  text: string
  attachments?: CommentAttachment[]
}
export interface CommentReaction {
  emoji: string
  count: number
  user_reacted: boolean
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  content: string
  parent_id: string | null
  thread_depth: number
  attachments?: CommentAttachment[]
  raw_content?: string
  likes_count: number
  replies_count: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  author: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    country: string | null
    is_verified: boolean
  }
  isLiked?: boolean
  reactions?: CommentReaction[]
  replies?: Comment[]
}

interface CommentsApiResponse {
  data: Comment[]
  page?: number
  pageSize?: number
  hasMore?: boolean
}

const COMMENT_MEDIA_BUCKET = 'post-images'
const COMMENTS_PAGE_SIZE = 20

const generateLocalId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const parseCommentContent = (rawContent: string): CommentContentPayload => {
  if (!rawContent) {
    return { text: '', attachments: [] }
  }

  try {
    const parsed = JSON.parse(rawContent) as SerializedCommentPayload
    if (parsed && typeof parsed.text === 'string') {
      const attachments = (parsed.attachments || [])
        .filter((attachment): attachment is SerializedCommentAttachment => Boolean(attachment?.type))
        .map((attachment) => ({
          id: generateLocalId(),
          type: attachment.type,
          url: attachment.url ?? undefined,
          value: attachment.value ?? undefined
        }))

      return {
        text: parsed.text,
        attachments
      }
    }
  } catch (error) {
    // Treat as plain text when JSON parsing fails
  }

  return { text: rawContent, attachments: [] }
}

const sanitizeCommentText = (value: string) => value.trim()

const serializeCommentContent = (payload: CommentContentPayload): string => {
  const base: SerializedCommentPayload = {
    text: sanitizeCommentText(payload.text)
  }

  const attachments = payload.attachments?.map((attachment) => {
    if (attachment.type === 'sticker') {
      return attachment.value ? { type: attachment.type, value: attachment.value } : null
    }

    return attachment.url ? { type: attachment.type, url: attachment.url } : null
  }).filter(Boolean) as SerializedCommentAttachment[] | undefined

  if (attachments && attachments.length > 0) {
    base.attachments = attachments
  }

  try {
    return JSON.stringify(base)
  } catch (error) {
    return base.text
  }
}

const normalizeNewCommentPayload = (input: string | NewCommentPayload): NewCommentPayload => {
  if (typeof input === 'string') {
    return { text: input }
  }

  return {
    text: input?.text ?? '',
    attachments: input?.attachments ?? []
  }
}

const normalizeUpdateCommentPayload = (input: string | UpdateCommentPayload): UpdateCommentPayload => {
  if (typeof input === 'string') {
    return { text: input }
  }

  return {
    text: input?.text ?? '',
    attachments: input?.attachments ?? []
  }
}

const uploadCommentImage = async (file: File, userId: string): Promise<string> => {
  const extension = file.name.split('.').pop() || 'jpg'
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase() || `image.${extension}`
  const filePath = `comments/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeFileName}`

  const { error } = await supabase.storage.from(COMMENT_MEDIA_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  })

  if (error) {
    throw error
  }

  const { data } = supabase.storage.from(COMMENT_MEDIA_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

const processNewAttachments = async (attachments: CommentAttachmentInput[] = [], userId: string): Promise<SerializedCommentAttachment[]> => {
  const results: SerializedCommentAttachment[] = []

  for (const attachment of attachments) {
    if (attachment.type === 'image') {
      if (attachment.file) {
        const publicUrl = await uploadCommentImage(attachment.file, userId)
        results.push({ type: 'image', url: publicUrl })
      } else if (attachment.url) {
        results.push({ type: 'image', url: attachment.url })
      }
    } else if (attachment.type === 'gif') {
      if (attachment.url) {
        results.push({ type: 'gif', url: attachment.url })
      }
    } else if (attachment.type === 'sticker') {
      if (attachment.value) {
        results.push({ type: 'sticker', value: attachment.value })
      }
    }
  }

  return results
}


export const useComments = (postId: string) => {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)

  useEffect(() => {
    if (postId) {
      fetchComments()
    }
  }, [postId, user])

  const normalizeCommentTree = (comment: any): Comment => {
    const { text: parsedText, attachments } = parseCommentContent(comment.content)
    const reactions: CommentReaction[] = Array.isArray(comment.reactions)
      ? comment.reactions
      : []

    return {
      ...comment,
      content: parsedText,
      raw_content: comment.content,
      attachments,
      isLiked: Boolean(comment.isLiked),
      reactions,
      replies: Array.isArray(comment.replies)
        ? comment.replies.map((reply: any) => normalizeCommentTree(reply))
        : []
    }
  }

  const mergeComments = (existing: Comment[], incoming: Comment[]): Comment[] => {
    if (incoming.length === 0) return existing
    const existingIds = new Set(existing.map(comment => comment.id))
    const uniqueIncoming = incoming.filter(comment => !existingIds.has(comment.id))
    return [...existing, ...uniqueIncoming]
  }

  const fetchComments = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.get<CommentsApiResponse>(
        `/api/posts/${postId}/comments`,
        { page: 1, limit: COMMENTS_PAGE_SIZE }
      )
      const commentsData = response?.data || []

      const processedComments = Array.isArray(commentsData)
        ? commentsData.map(normalizeCommentTree)
        : []

      setComments(processedComments)
      setCurrentPage(response?.page || 1)
      setHasNextPage(Boolean(response?.hasMore))

    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMoreComments = async () => {
    if (!hasNextPage || isLoadingMore) return

    const nextPage = currentPage + 1
    try {
      setIsLoadingMore(true)
      setError(null)

      const response = await apiClient.get<CommentsApiResponse>(
        `/api/posts/${postId}/comments`,
        { page: nextPage, limit: COMMENTS_PAGE_SIZE }
      )

      const commentsData = response?.data || []
      const processedComments = Array.isArray(commentsData)
        ? commentsData.map(normalizeCommentTree)
        : []

      setComments(prev => mergeComments(prev, processedComments))
      setCurrentPage(response?.page || nextPage)
      setHasNextPage(Boolean(response?.hasMore))
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const addComment = async (input: string | NewCommentPayload, parentId?: string): Promise<{ error: string | null }> => {
    try {
      if (!user) throw new Error('User must be authenticated')
      if (!postId) throw new Error('No post selected')

      const normalized = normalizeNewCommentPayload(input)
      const textContent = sanitizeCommentText(normalized.text)

      if (!textContent) {
        throw new Error('Comment cannot be empty')
      }

      const response = await apiClient.post<{ data: any }>(
        `/api/posts/${postId}/comments`,
        {
          content: textContent,
          parent_id: parentId || null
        }
      )
      const data = response?.data
      if (!data) throw new Error('Failed to create comment')

      const parsed = parseCommentContent(data.content)

      const newComment: Comment = {
        ...data,
        content: parsed.text,
        raw_content: data.content,
        attachments: [],
        isLiked: false,
        reactions: [],
        replies: []
      }

      if (parentId) {
        setComments(prev => addReplyToComments(prev, parentId, newComment))
      } else {
        setComments(prev => [...prev, newComment])
      }

      return { error: null }

    } catch (error: any) {
      return { error: error.message }
    }
  }

  const addReplyToComments = (comments: Comment[], parentId: string, newReply: Comment): Comment[] => {
    return comments.map(comment => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply],
          replies_count: comment.replies_count + 1
        }
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: addReplyToComments(comment.replies, parentId, newReply)
        }
      }
      return comment
    })
  }

  const toggleCommentLike = async (commentId: string) => {
    try {
      if (!user) throw new Error('User not authenticated')

      const comment = findComment(comments, commentId)
      if (!comment) return

      const response = await apiClient.post<{ liked: boolean; likes_count: number }>(
        `/api/posts/${postId}/comments/${commentId}/like`
      )
      const wasLiked = Boolean(comment.isLiked)
      const likeDelta = response.liked === wasLiked ? 0 : (response.liked ? 1 : -1)
      setComments(prev => updateCommentLikes(prev, commentId, response.liked, likeDelta, response.likes_count))
    } catch (error: any) {
      console.error('Error toggling comment like:', error.message)
    }
  }

  const findComment = (comments: Comment[], commentId: string): Comment | null => {
    for (const comment of comments) {
      if (comment.id === commentId) return comment
      if (comment.replies) {
        const found = findComment(comment.replies, commentId)
        if (found) return found
      }
    }
    return null
  }

  const updateCommentLikes = (
    comments: Comment[],
    commentId: string,
    isLiked: boolean,
    likeDelta: number,
    exactLikesCount?: number
  ): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          isLiked,
          likes_count: typeof exactLikesCount === 'number'
            ? exactLikesCount
            : comment.likes_count + likeDelta
        }
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentLikes(comment.replies, commentId, isLiked, likeDelta, exactLikesCount)
        }
      }
      return comment
    })
  }

  const toggleCommentReaction = async (commentId: string, emoji: string) => {
    try {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .rpc('toggle_comment_reaction', {
          comment_id_param: commentId,
          emoji_param: emoji
        })

      if (error) throw error

      const result = data?.[0]
      if (result) {
        setComments(prev => updateCommentReactions(prev, commentId, emoji, result.action, result.new_count))
      }

      return { error: null }
    } catch (error: any) {
      console.error('Error toggling comment reaction:', error.message)
      return { error: error.message }
    }
  }

  const updateCommentReactions = (
    comments: Comment[], 
    commentId: string, 
    emoji: string, 
    action: string, 
    newCount: number
  ): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        const currentReactions = comment.reactions || []
        let updatedReactions: CommentReaction[]

        if (action === 'added') {
          const existingReaction = currentReactions.find(r => r.emoji === emoji)
          if (existingReaction) {
            updatedReactions = currentReactions.map(r => 
              r.emoji === emoji ? { ...r, count: newCount, user_reacted: true } : r
            )
          } else {
            updatedReactions = [...currentReactions, { emoji, count: newCount, user_reacted: true }]
          }
        } else {
          // action === 'removed'
          if (newCount === 0) {
            updatedReactions = currentReactions.filter(r => r.emoji !== emoji)
          } else {
            updatedReactions = currentReactions.map(r => 
              r.emoji === emoji ? { ...r, count: newCount, user_reacted: false } : r
            )
          }
        }

        return {
          ...comment,
          reactions: updatedReactions.sort((a, b) => b.count - a.count)
        }
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentReactions(comment.replies, commentId, emoji, action, newCount)
        }
      }
      return comment
    })
  }

  const deleteComment = async (commentId: string): Promise<{ error: string | null }> => {
    try {
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('comments')
        .update({ is_deleted: true, content: '[deleted]' })
        .eq('id', commentId)
        .eq('author_id', user.id)

      if (error) throw error

      // Update local state
      setComments(prev => updateCommentDeleted(prev, commentId))
      return { error: null }

    } catch (error: any) {
      return { error: error.message }
    }
  }

  const updateComment = async (commentId: string, input: string | UpdateCommentPayload): Promise<{ error: string | null }> => {
    try {
      if (!user) throw new Error('User not authenticated')

      const normalized = normalizeUpdateCommentPayload(input)
      const textContent = sanitizeCommentText(normalized.text)
      if (!textContent) {
        throw new Error('Comment cannot be empty')
      }

      const { error } = await supabase
        .from('comments')
        .update({
          content: textContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .eq('author_id', user.id)

      if (error) throw error

      setComments(prev => updateCommentContent(prev, commentId, {
        text: textContent,
        attachments: [],
        raw: textContent
      }))
      return { error: null }

    } catch (error: any) {
      return { error: error.message }
    }
  }

  const updateCommentContent = (comments: Comment[], commentId: string, payload: CommentContentPayload & { raw?: string }): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          content: payload.text,
          attachments: payload.attachments ?? [],
          raw_content: payload.raw ?? comment.raw_content,
          updated_at: new Date().toISOString()
        }
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentContent(comment.replies, commentId, payload)
        }
      }
      return comment
    })
  }

  const updateCommentDeleted = (comments: Comment[], commentId: string): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          is_deleted: true,
          content: '[deleted]',
          attachments: [],
          raw_content: '[deleted]'
        }
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentDeleted(comment.replies, commentId)
        }
      }
      return comment
    })
  }

  return {
    comments,
    loading,
    isLoadingMore,
    hasNextPage,
    error,
    addComment,
    loadMoreComments,
    toggleCommentLike,
    toggleCommentReaction,
    deleteComment,
    updateComment,
    refetch: fetchComments
  }
}