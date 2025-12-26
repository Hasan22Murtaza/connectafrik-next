import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { notificationService } from '@/shared/services/notificationService'


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

const COMMENT_MEDIA_BUCKET = 'post-images'

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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (postId) {
      fetchComments()
    }
  }, [postId, user])

  const fetchComments = async () => {
    try {
      setLoading(true)
      
      // Fetch comments with author details
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!comments_author_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            country,
            is_verified
          )
        `)
        .eq('post_id', postId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (commentsError) throw commentsError

      // Check which comments the current user has liked
      let likesData: any[] = []
      if (user && commentsData?.length > 0) {
        const { data, error: likesError } = await supabase
          .from('likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentsData.map(c => c.id))

        if (!likesError) {
          likesData = data || []
        }
      }

      // Fetch comment reactions
      let reactionsData: any[] = []
      if (commentsData?.length > 0) {
        const { data, error: reactionsError } = await supabase
          .from('comment_reactions')
          .select('comment_id, emoji, user_id')
          .in('comment_id', commentsData.map(c => c.id))

        if (!reactionsError) {
          reactionsData = data || []
        }
      }

      // Process reactions into the format we need
      const processedComments = commentsData?.map(comment => {
        const commentReactions = reactionsData.filter(r => r.comment_id === comment.id)
        const reactionCounts: { [emoji: string]: { count: number, user_reacted: boolean } } = {}

        commentReactions.forEach(reaction => {
          if (!reactionCounts[reaction.emoji]) {
            reactionCounts[reaction.emoji] = { count: 0, user_reacted: false }
          }
          reactionCounts[reaction.emoji].count++
          if (user && reaction.user_id === user.id) {
            reactionCounts[reaction.emoji].user_reacted = true
          }
        })

        const reactions: CommentReaction[] = Object.entries(reactionCounts).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          user_reacted: data.user_reacted
        })).sort((a, b) => b.count - a.count)

        const { text: parsedText, attachments } = parseCommentContent(comment.content)

        return {
          ...comment,
          content: parsedText,
          raw_content: comment.content,
          attachments,
          isLiked: likesData.some(like => like.comment_id === comment.id),
          reactions
        }
      }) || []

      // Organize comments into threaded structure
      const organizedComments = organizeComments(processedComments)
      setComments(organizedComments)

    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const organizeComments = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>()
    const rootComments: Comment[] = []

    // First pass: create map and initialize replies arrays
    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] })
    })

    // Second pass: organize into threads
    flatComments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!
      
      if (comment.parent_id) {
        // This is a reply
        const parent = commentMap.get(comment.parent_id)
        if (parent) {
          parent.replies = parent.replies || []
          parent.replies.push(commentWithReplies)
        }
      } else {
        // This is a root comment
        rootComments.push(commentWithReplies)
      }
    })

    return rootComments
  }

  const addComment = async (input: string | NewCommentPayload, parentId?: string): Promise<{ error: string | null }> => {
    try {
      if (!user) throw new Error('User must be authenticated')
      if (!postId) throw new Error('No post selected')

      const normalized = normalizeNewCommentPayload(input)
      const textContent = sanitizeCommentText(normalized.text)

      const preparedAttachments = await processNewAttachments(normalized.attachments, user.id)
      if (!textContent && preparedAttachments.length === 0) {
        throw new Error('Comment cannot be empty')
      }

      const attachmentsForSerialization: CommentAttachment[] = preparedAttachments.map(attachment => ({
        id: generateLocalId(),
        type: attachment.type,
        url: attachment.url,
        value: attachment.value
      }))

      const serializedContent = serializeCommentContent({
        text: textContent,
        attachments: attachmentsForSerialization
      })

      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content: serializedContent,
          parent_id: parentId || null
        })
        .select(`
          *,
          author:profiles!comments_author_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            country,
            is_verified
          )
        `)
        .single()

      if (error) throw error

      const parsed = parseCommentContent(data.content)

      const newComment: Comment = {
        ...data,
        content: parsed.text,
        raw_content: data.content,
        attachments: parsed.attachments,
        isLiked: false,
        reactions: [],
        replies: []
      }

      if (parentId) {
        setComments(prev => addReplyToComments(prev, parentId, newComment))
      } else {
        setComments(prev => [...prev, newComment])
      }

      // Send push notification to post author (if not the current user)
      try {
        // Fetch post to get author_id
        const { data: postData } = await supabase
          .from('posts')
          .select('author_id, title, content')
          .eq('id', postId)
          .single()

        if (postData && postData.author_id !== user.id) {
          const actorName = user.user_metadata?.full_name || user.email || 'Someone'
          const postTitle = postData.title || postData.content?.substring(0, 50) || 'your post'
          await notificationService.sendPostInteractionNotification(
            postData.author_id,
            actorName,
            'comment',
            postTitle
          )
        }
      } catch (notificationError) {
        // Don't fail the comment if notification fails
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

      if (comment.isLiked) {
        // Unlike the comment
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('comment_id', commentId)

        if (error) throw error

        setComments(prev => updateCommentLikes(prev, commentId, false, -1))
      } else {
        // Like the comment
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            comment_id: commentId
          })

        if (error) throw error

        setComments(prev => updateCommentLikes(prev, commentId, true, 1))
      }
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

  const updateCommentLikes = (comments: Comment[], commentId: string, isLiked: boolean, likeDelta: number): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          isLiked,
          likes_count: comment.likes_count + likeDelta
        }
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentLikes(comment.replies, commentId, isLiked, likeDelta)
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
      const attachments = normalized.attachments ?? []

      if (!textContent && attachments.length === 0) {
        throw new Error('Comment cannot be empty')
      }

      const attachmentsWithIds: CommentAttachment[] = attachments.map(attachment => ({
        ...attachment,
        id: attachment.id ?? generateLocalId()
      }))

      const serializedContent = serializeCommentContent({
        text: textContent,
        attachments: attachmentsWithIds
      })

      const { error } = await supabase
        .from('comments')
        .update({
          content: serializedContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .eq('author_id', user.id)

      if (error) throw error

      setComments(prev => updateCommentContent(prev, commentId, {
        text: textContent,
        attachments: attachmentsWithIds,
        raw: serializedContent
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
    error,
    addComment,
    toggleCommentLike,
    toggleCommentReaction,
    deleteComment,
    updateComment,
    refetch: fetchComments
  }
}