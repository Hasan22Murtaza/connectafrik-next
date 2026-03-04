
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Send, Trash2, Flag, Smile, Edit2, Check, X, Loader2, CheckCircle } from 'lucide-react'
import { useComments, Comment, CommentAttachment, CommentAttachmentInput, UpdateCommentPayload } from '@/shared/hooks/useComments'
import { useAuth } from '@/contexts/AuthContext'
import EmojiPicker from '@/shared/components/ui/EmojiPicker'
import toast from 'react-hot-toast'
import type { User } from '@supabase/supabase-js'

interface CommentsSectionProps {
  postId: string
  isOpen: boolean
  onClose: () => void
  /** When false, composer is hidden and message shown (e.g. post owner turned off comments). Default true. */
  canComment?: boolean
}

type ComposerAttachment =
  | { id: string; type: 'image'; file: File; previewUrl: string }
  | { id: string; type: 'gif'; url: string }
  | { id: string; type: 'sticker'; value: string }

const MAX_IMAGE_ATTACHMENTS = 4
const MAX_REPLY_DEPTH = 5

const createLocalId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const getUserDisplayName = (user: User | null): string => {
  if (!user) return 'ConnectAfrik member'

  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
  if (fullName.trim().length > 0) {
    return fullName.trim()
  }

  if (user.email) {
    const emailName = user.email.split('@')[0]
    if (emailName) {
      return emailName
    }
  }

  return 'ConnectAfrik member'
}

const getUserInitial = (user: User | null): string => {
  const displayName = getUserDisplayName(user)
  return displayName.charAt(0).toUpperCase() || 'C'
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ postId, isOpen, onClose, canComment = true }) => {
  const { user } = useAuth()
  const {
    comments,
    loading,
    isLoadingMore,
    hasNextPage,
    addComment,
    loadMoreComments,
    toggleCommentLike,
    toggleCommentReaction,
    deleteComment,
    updateComment
  } = useComments(postId)

  const [newComment, setNewComment] = useState('')
  const [draftAttachments, setDraftAttachments] = useState<ComposerAttachment[]>([])
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false)
  const [isReplySubmitting, setIsReplySubmitting] = useState(false)
  const [isComposerEmojiOpen, setIsComposerEmojiOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const draftAttachmentsRef = useRef<ComposerAttachment[]>([])
  const commentInputRef = useRef<HTMLInputElement | null>(null)

  const commenterInitial = useMemo(() => getUserInitial(user), [user])

  const composerHasContent = newComment.trim().length > 0 || draftAttachments.length > 0

  const revokePreview = useCallback((attachment: ComposerAttachment) => {
    if (attachment.type === 'image') {
      URL.revokeObjectURL(attachment.previewUrl)
    }
  }, [])

  useEffect(() => {
    draftAttachmentsRef.current = draftAttachments
  }, [draftAttachments])

  const resetComposer = useCallback(() => {
    draftAttachmentsRef.current.forEach(revokePreview)
    setDraftAttachments([])
    setNewComment('')
    setIsComposerEmojiOpen(false)
  }, [revokePreview])

  useEffect(() => () => {
    draftAttachmentsRef.current.forEach(revokePreview)
  }, [revokePreview])

  useEffect(() => {
    if (!isOpen) {
      resetComposer()
      setReplyingTo(null)
      setReplyContent('')
    }
  }, [isOpen, resetComposer])

  // Auto-focus comment input when section opens
  useEffect(() => {
    if (isOpen && commentInputRef.current) {
      setTimeout(() => commentInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleEmojiSelect = (emoji: string) => {
    setNewComment(prev => `${prev}${emoji}`)
    setIsComposerEmojiOpen(false)
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const existingImageCount = draftAttachments.filter(attachment => attachment.type === 'image').length
    const availableSlots = MAX_IMAGE_ATTACHMENTS - existingImageCount

    if (availableSlots <= 0) {
      toast.error(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} images per comment.`)
      event.target.value = ''
      return
    }

    const selectedFiles = Array.from(files).slice(0, availableSlots)
    if (selectedFiles.length < files.length) {
      toast.error(`Only ${MAX_IMAGE_ATTACHMENTS} images can be attached per comment.`)
    }

    const newAttachments: ComposerAttachment[] = selectedFiles.map(file => ({
      id: createLocalId(),
      type: 'image',
      file,
      previewUrl: URL.createObjectURL(file)
    }))

    setDraftAttachments(prev => [...prev, ...newAttachments])
    event.target.value = ''
  }

  const handleRemoveAttachment = (attachmentId: string) => {
    setDraftAttachments(prev => {
      const target = prev.find(item => item.id === attachmentId)
      if (target) revokePreview(target)
      return prev.filter(item => item.id !== attachmentId)
    })
  }

  const handleSubmitComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!composerHasContent) return

    setIsCommentSubmitting(true)
    try {
      const attachmentPayload = draftAttachments
        .map<CommentAttachmentInput | null>((attachment) => {
          if (attachment.type === 'image') return { type: 'image', file: attachment.file }
          if (attachment.type === 'gif') return { type: 'gif', url: attachment.url }
          if (attachment.type === 'sticker') return { type: 'sticker', value: attachment.value }
          return null
        })
        .filter((attachment): attachment is CommentAttachmentInput => Boolean(attachment))

      const { error } = await addComment({ text: newComment, attachments: attachmentPayload })
      if (error) {
        toast.error(error)
      } else {
        resetComposer()
      }
    } catch {
      toast.error('Failed to post comment.')
    } finally {
      setIsCommentSubmitting(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && composerHasContent) {
      event.preventDefault()
      handleSubmitComment(event as unknown as React.FormEvent)
    }
  }

  const handleReplyToggle = (commentId: string) => {
    setReplyContent('')
    setReplyingTo(prev => (prev === commentId ? null : commentId))
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) return

    setIsReplySubmitting(true)
    try {
      const { error } = await addComment({ text: replyContent.trim() }, parentId)
      if (error) {
        toast.error(error)
      } else {
        setReplyContent('')
        setReplyingTo(null)
      }
    } catch {
      toast.error('Failed to post reply.')
    } finally {
      setIsReplySubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await deleteComment(commentId)
    if (error) {
      toast.error(error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="w-full">
      {/* Comments list */}
      <div className="space-y-1 px-3 pt-2 pb-1">
        {loading ? (
          <div className="py-4 text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </div>
        ) : comments.length === 0 && !canComment ? (
          <p className="py-3 text-center text-xs text-gray-400">Comments are turned off for this post.</p>
        ) : comments.length === 0 ? (
          <p className="py-3 text-center text-xs text-gray-400">Be the first to comment</p>
        ) : (
          <>
            {comments.map(comment => (
              <FBCommentItem
                key={comment.id}
                comment={comment}
                onLike={toggleCommentLike}
                onEmojiReact={toggleCommentReaction}
                onReplyToggle={handleReplyToggle}
                onDelete={handleDeleteComment}
                onUpdate={updateComment}
                replyingTo={replyingTo}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                onSubmitReply={handleSubmitReply}
                isReplySubmitting={isReplySubmitting}
                currentUser={user}
              />
            ))}
            {hasNextPage && (
              <div className="py-2 text-center">
                <button
                  type="button"
                  onClick={loadMoreComments}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingMore && <Loader2 className="h-3 w-3 animate-spin" />}
                  {isLoadingMore ? 'Loading...' : 'Load more comments'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Comment composer - Facebook style */}
      {user && canComment && (
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600 flex-shrink-0">
            {commenterInitial}
          </div>

          {/* Input bubble */}
          <form onSubmit={handleSubmitComment} className="relative flex flex-1 items-center">
            <input
              ref={commentInputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment..."
              className="w-full rounded-full bg-gray-100 py-2 pl-4 pr-16 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200"
              maxLength={1000}
            />
            <div className="absolute right-2 flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsComposerEmojiOpen(prev => !prev)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  aria-label="Insert emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <EmojiPicker
                  isOpen={isComposerEmojiOpen}
                  onEmojiSelect={handleEmojiSelect}
                  onClose={() => setIsComposerEmojiOpen(false)}
                  variant="compact"
                />
              </div>
              {composerHasContent && (
                <button
                  type="submit"
                  disabled={isCommentSubmitting}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50"
                  aria-label="Post comment"
                >
                  {isCommentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              )}
            </div>
          </form>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>
      )}

      {user && !canComment && (
        <p className="px-3 py-2 text-center text-xs text-gray-400">Comments are turned off for this post.</p>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────── */
/*  Facebook-style Comment Item                   */
/* ────────────────────────────────────────────── */

interface FBCommentItemProps {
  comment: Comment
  onLike: (commentId: string) => void
  onEmojiReact: (commentId: string, emoji: string) => void
  onReplyToggle: (commentId: string) => void
  onDelete: (commentId: string) => void
  onUpdate: (commentId: string, payload: UpdateCommentPayload | string) => Promise<{ error: string | null }>
  replyingTo: string | null
  replyContent: string
  setReplyContent: React.Dispatch<React.SetStateAction<string>>
  onSubmitReply: (parentId: string) => void
  isReplySubmitting: boolean
  currentUser: User | null
  depth?: number
}

const FBCommentItem: React.FC<FBCommentItemProps> = ({
  comment,
  onLike,
  onEmojiReact,
  onReplyToggle,
  onDelete,
  onUpdate,
  replyingTo,
  replyContent,
  setReplyContent,
  onSubmitReply,
  isReplySubmitting,
  currentUser,
  depth = 0
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [isUpdating, setIsUpdating] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isEditing) setEditContent(comment.content)
  }, [comment.content, isEditing])

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const isOwnComment = currentUser?.id === comment.author_id
  const replyAllowed = depth < MAX_REPLY_DEPTH && !comment.is_deleted

  const handleLike = () => {
    if (!comment.is_deleted) onLike(comment.id)
  }

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim()
    if (!trimmed) { toast.error('Comment cannot be empty.'); return }
    if (trimmed === comment.content) { setIsEditing(false); return }

    setIsUpdating(true)
    try {
      const { error } = await onUpdate(comment.id, { text: trimmed, attachments: comment.attachments ?? [] })
      if (error) toast.error(error)
      else { setIsEditing(false) }
    } catch { toast.error('Failed to update comment.') }
    finally { setIsUpdating(false) }
  }

  const handleReplyKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && replyContent.trim()) {
      event.preventDefault()
      onSubmitReply(comment.id)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: false })
    .replace('about ', '')
    .replace('less than a minute', '1m')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ months?/, 'mo')
    .replace(/ years?/, 'y')

  // Collect reaction emojis + total count for the bubble badge
  const reactionEmojis = (comment.reactions || []).filter(r => r.count > 0)
  const totalReactions = reactionEmojis.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className={depth > 0 ? 'ml-8 mt-1' : 'mt-1'}>
      <div className="flex gap-2">
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {comment.author.avatar_url ? (
            <img
              src={comment.author.avatar_url}
              alt={comment.author.full_name}
              className={`rounded-full object-cover ${depth > 0 ? 'h-7 w-7' : 'h-8 w-8'}`}
            />
          ) : (
            <div className={`flex items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600 ${depth > 0 ? 'h-7 w-7' : 'h-8 w-8'}`}>
              {comment.author.full_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Gray bubble */}
          {isEditing ? (
            <div className="rounded-2xl bg-gray-100 px-3 py-2">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-700 outline-none"
                maxLength={1000}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit() }}
              />
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <button onClick={handleSaveEdit} disabled={isUpdating} className="text-primary-600 font-medium hover:underline disabled:opacity-50">
                  {isUpdating ? 'Saving...' : 'Save'}
                </button>
                <span className="text-gray-300">·</span>
                <button onClick={() => { setIsEditing(false); setEditContent(comment.content) }} className="text-gray-500 hover:underline">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="relative group inline-block max-w-full">
              <div className="rounded-2xl bg-gray-100 px-3 py-1.5 inline-block max-w-full">
                {/* Author name */}
                <span className="text-[13px] font-semibold text-gray-900 leading-tight">
                  {comment.author.full_name}
                  {comment.author.is_verified && (
                    <CheckCircle className="inline-block ml-0.5 h-3 w-3 text-blue-500" />
                  )}
                </span>
                {/* Comment text */}
                {comment.is_deleted ? (
                  <p className="text-[13px] italic text-gray-400 leading-snug">This comment has been deleted</p>
                ) : (
                  <p className="text-[13px] text-gray-700 leading-snug whitespace-pre-wrap break-words">{comment.content}</p>
                )}
              </div>

              {/* Reaction badge (bottom-right of bubble) */}
              {totalReactions > 0 && (
                <div className="absolute -bottom-2 right-0 flex items-center gap-0.5 rounded-full bg-white shadow-sm border border-gray-100 px-1.5 py-0.5">
                  {reactionEmojis.slice(0, 3).map(r => (
                    <span key={r.emoji} className="text-xs leading-none">{r.emoji}</span>
                  ))}
                  {totalReactions > 1 && (
                    <span className="text-[11px] text-gray-500 leading-none">{totalReactions}</span>
                  )}
                </div>
              )}

              {/* Three-dot menu on hover */}
              {!comment.is_deleted && (
                <div className="absolute -right-7 top-1 hidden group-hover:block" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(prev => !prev)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  >
                    <span className="text-sm leading-none">···</span>
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 z-10 w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      {isOwnComment ? (
                        <>
                          <button
                            onClick={() => { setIsEditing(true); setShowMenu(false) }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => { onDelete(comment.id); setShowMenu(false) }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setShowMenu(false)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <Flag className="h-3 w-3" /> Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attachments */}
          {!comment.is_deleted && <CommentAttachments attachments={comment.attachments} />}

          {/* Like · Reply · Time row */}
          {!comment.is_deleted && !isEditing && (
            <div className={`flex items-center gap-3 pl-1 text-xs ${totalReactions > 0 ? 'mt-3' : 'mt-0.5'}`}>
              <button
                onClick={handleLike}
                className={`font-semibold transition hover:underline ${comment.isLiked ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Like
              </button>
              {replyAllowed && (
                <button
                  onClick={() => onReplyToggle(comment.id)}
                  className="font-semibold text-gray-500 hover:text-gray-700 hover:underline transition"
                >
                  Reply
                </button>
              )}
              <span className="text-gray-400">{timeAgo}</span>
              {comment.likes_count > 0 && (
                <span className="text-gray-400 ml-auto">{comment.likes_count} ❤️</span>
              )}
            </div>
          )}

          {/* Reply input */}
          {replyingTo === comment.id && replyAllowed && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-500 flex-shrink-0">
                {(currentUser?.user_metadata?.full_name || currentUser?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="relative flex flex-1 items-center">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder={`Reply to ${comment.author.full_name}...`}
                  className="w-full rounded-full bg-gray-100 py-1.5 pl-3 pr-10 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-gray-200"
                  maxLength={500}
                  autoFocus
                />
                <div className="absolute right-1.5 flex items-center">
                  {replyContent.trim() && (
                    <button
                      onClick={() => onSubmitReply(comment.id)}
                      disabled={isReplySubmitting}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                    >
                      {isReplySubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Nested replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-1">
              {comment.replies.map(reply => (
                <FBCommentItem
                  key={reply.id}
                  comment={reply}
                  onLike={onLike}
                  onEmojiReact={onEmojiReact}
                  onReplyToggle={onReplyToggle}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  onSubmitReply={onSubmitReply}
                  isReplySubmitting={isReplySubmitting}
                  currentUser={currentUser}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────── */
/*  Comment Attachments                           */
/* ────────────────────────────────────────────── */

interface CommentAttachmentsProps {
  attachments?: CommentAttachment[]
}

const CommentAttachments: React.FC<CommentAttachmentsProps> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) return null

  const nodes = attachments
    .map((attachment) => {
      if (attachment.type === 'image' && attachment.url) {
        return (
          <img
            key={attachment.id}
            src={attachment.url}
            alt="Comment attachment"
            className="mt-1 max-h-40 rounded-lg object-cover"
          />
        )
      }
      if (attachment.type === 'gif' && attachment.url) {
        return (
          <img
            key={attachment.id}
            src={attachment.url}
            alt="Comment GIF"
            className="mt-1 max-h-40 rounded-lg object-cover"
          />
        )
      }
      if (attachment.type === 'sticker' && attachment.value) {
        return (
          <div key={attachment.id} className="mt-1 text-4xl">
            {attachment.value}
          </div>
        )
      }
      return null
    })
    .filter(Boolean)

  if (nodes.length === 0) return null
  return <div className="flex flex-wrap gap-1">{nodes as React.ReactNode[]}</div>
}

export default CommentsSection
