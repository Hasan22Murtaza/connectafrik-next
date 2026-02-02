
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Heart, Reply, MoreHorizontal, Send, Trash2, Flag, Smile, Edit2, Check, X, Image as ImageIcon, Sticker, Loader2, CheckCircle } from 'lucide-react'
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

const SAMPLE_GIFS = [
  'https://media.giphy.com/media/SggILpMXO7Xt6/giphy.gif',
  'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
  'https://media.giphy.com/media/3oKIP7A5xE1Gq9zIyk/giphy.gif',
  'https://media.giphy.com/media/l0HlTy9x8FZo0XO1i/giphy.gif'
]

const STICKER_EMOJIS = ['\u{1F600}', '\u{1F60D}', '\u{1F525}', '\u{1F389}', '\u{1F64C}', '\u{1F602}', '\u{1F929}', '\u{1F44D}', '\u{1F4AF}', '\u{1F973}']

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
    addComment,
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
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false)
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const draftAttachmentsRef = useRef<ComposerAttachment[]>([])

  const commenterName = useMemo(() => getUserDisplayName(user), [user])
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
    setIsGifPickerOpen(false)
    setIsStickerPickerOpen(false)
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

  const handleEmojiSelect = (emoji: string) => {
    setNewComment(prev => `${prev}${emoji}`)
    setIsComposerEmojiOpen(false)
    setIsGifPickerOpen(false)
    setIsStickerPickerOpen(false)
  }
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

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
      if (target) {
        revokePreview(target)
      }
      return prev.filter(item => item.id !== attachmentId)
    })
  }

  const handleGifSelect = (url: string) => {
    if (!url.trim()) return
    setDraftAttachments(prev => [...prev, { id: createLocalId(), type: 'gif', url: url.trim() }])
    setIsGifPickerOpen(false)
  }

  const handleStickerSelect = (value: string) => {
    if (!value) return
    setDraftAttachments(prev => [...prev, { id: createLocalId(), type: 'sticker', value }])
    setIsStickerPickerOpen(false)
  }

  const handleSubmitComment = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!composerHasContent) {
      toast.error('Add a message or attachment before commenting.')
      return
    }

    setIsCommentSubmitting(true)
    try {
      const attachmentPayload = draftAttachments
        .map<CommentAttachmentInput | null>((attachment) => {
          if (attachment.type === 'image') {
            return { type: 'image', file: attachment.file }
          }
          if (attachment.type === 'gif') {
            return { type: 'gif', url: attachment.url }
          }
          if (attachment.type === 'sticker') {
            return { type: 'sticker', value: attachment.value }
          }
          return null
        })
        .filter((attachment): attachment is CommentAttachmentInput => Boolean(attachment))

      const { error } = await addComment({
        text: newComment,
        attachments: attachmentPayload
      })

      if (error) {
        toast.error(error)
      } else {
        toast.success('Comment posted!')
        resetComposer()
      }
    } catch (error) {
      toast.error('Failed to post comment. Please try again.')
    } finally {
      setIsCommentSubmitting(false)
    }
  }

  const handleReplyToggle = (commentId: string) => {
    setReplyContent('')
    setReplyingTo(prev => (prev === commentId ? null : commentId))
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) {
      toast.error('Reply cannot be empty.')
      return
    }

    setIsReplySubmitting(true)
    try {
      const { error } = await addComment({ text: replyContent.trim() }, parentId)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Reply posted!')
        setReplyContent('')
        setReplyingTo(null)
      }
    } catch (error) {
      toast.error('Failed to post reply.')
    } finally {
      setIsReplySubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await deleteComment(commentId)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Comment deleted.')
    }
  }

  const handleClose = () => {
    resetComposer()
    setReplyingTo(null)
    setReplyContent('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="lg:fixed lg:inset-0 lg:z-50 lg:flex lg:items-center lg:justify-center lg:bg-black/50 lg:p-4">
      <div className="relative flex max-h-[80vh] w-full lg:max-w-2xl flex-col rounded-lg  bg-white  border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 sm:p-4 p-2 bg-primary-600  ">
          <h3 className="text-lg font-semibold text-white">Comments</h3>
          <button
            onClick={handleClose}
            className=" lg:flex text-white transition  hover:text-gray-400"
            aria-label="Close comments"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
              <p className="mt-2 text-gray-500">Loading comments...</p>
            </div>
          ) : comments.length === 0 && !canComment ? (
            <div className="py-8 text-center text-gray-500">Comments are turned off for this post.</div>
          ) : comments.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No comments yet. Be the first to comment!</div>
          ) : (
            comments.map(comment => (
              <CommentItem
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
            ))
          )}
        </div>

        {user && !canComment && (
          <div className="border-t border-gray-200 p-4 text-center text-sm text-gray-500">
            Comments are turned off for this post.
          </div>
        )}
        {user && canComment && (
          <div className="border-t border-gray-200 p-4">
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                  {commenterInitial}
                </div>
                <div className="flex-1">
                  <div className="rounded-2xl bg-gray-100 px-4 py-3">
                    <textarea
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      placeholder={`Comment..`}
                      className="h-12 w-full resize-none bg-transparent text-sm text-gray-700 outline-none"
                      maxLength={1000}
                    />
                  </div>

                  {draftAttachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {draftAttachments.map((attachment) => (
                        <ComposerAttachmentPreview
                          key={attachment.id}
                          attachment={attachment}
                          onRemove={() => handleRemoveAttachment(attachment.id)}
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="relative flex items-center gap-2 text-gray-500">
                      <button
                        type="button"
                        onClick={() => setIsComposerEmojiOpen(prev => !prev)}
                        className="rounded-full p-2 transition hover:bg-gray-200"
                        aria-label="Insert emoji"
                      >
                        <Smile className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-full p-2 transition hover:bg-gray-200"
                        aria-label="Add photo"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsGifPickerOpen(prev => !prev)}
                        className="rounded-full px-2 py-1 text-xs font-semibold transition hover:bg-gray-200"
                        aria-label="Add GIF"
                      >
                        GIF
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsStickerPickerOpen(prev => !prev)}
                        className="rounded-full p-2 transition hover:bg-gray-200"
                        aria-label="Add sticker"
                      >
                        <Sticker className="h-4 w-4" />
                      </button>

                      <EmojiPicker
                        isOpen={isComposerEmojiOpen}
                        onEmojiSelect={handleEmojiSelect}
                        onClose={() => setIsComposerEmojiOpen(false)}
                        variant="compact"
                      />

                      <GifPicker
                        isOpen={isGifPickerOpen}
                        onSelect={handleGifSelect}
                        onClose={() => setIsGifPickerOpen(false)}
                      />

                      <StickerPicker
                        isOpen={isStickerPickerOpen}
                        onSelect={handleStickerSelect}
                        onClose={() => setIsStickerPickerOpen(false)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isCommentSubmitting || !composerHasContent}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Submit comment"
                    >
                      {isCommentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
interface CommentItemProps {
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

const CommentItem: React.FC<CommentItemProps> = ({
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [isUpdating, setIsUpdating] = useState(false)
  useEffect(() => {
    if (!isEditing) {
      setEditContent(comment.content)
    }
  }, [comment.content, isEditing])

  const isOwnComment = currentUser?.id === comment.author_id
  const replyAllowed = depth < MAX_REPLY_DEPTH && !comment.is_deleted

  const handleLike = () => {
    if (!comment.is_deleted) {
      onLike(comment.id)
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    onEmojiReact(comment.id, emoji)
    setShowEmojiPicker(false)
  }

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim()
    if (!trimmed) {
      toast.error('Comment cannot be empty.')
      return
    }

    if (trimmed === comment.content) {
      setIsEditing(false)
      return
    }

    setIsUpdating(true)
    try {
      const { error } = await onUpdate(comment.id, {
        text: trimmed,
        attachments: comment.attachments ?? []
      })

      if (error) {
        toast.error(error)
      } else {
        toast.success('Comment updated!')
        setIsEditing(false)
      }
    } catch (error) {
      toast.error('Failed to update comment.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(comment.content)
  }

  const handleDelete = () => {
    onDelete(comment.id)
    setShowMenu(false)
  }

  const handleReply = () => {
    onReplyToggle(comment.id)
    setShowMenu(false)
  }

  return (
    <div className={depth > 0 ? 'ml-8 border-l-2 border-gray-100 pl-4 ' : ''}>
      <div className=" flex space-x-3">
        <div className="flex-shrink-0">
          {comment.author.avatar_url ? (
            <img
              src={comment.author.avatar_url}
              alt={comment.author.full_name}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-300 text-sm font-semibold text-gray-600">
              {comment.author.full_name.charAt(0).toUpperCase()}
            </div>  
          )}
        </div>

        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-gray-900">{comment.author.full_name}</span>
            {comment.author.is_verified && (
              <span className="inline-flex items-center text-blue-500" aria-label="Verified account">
                <CheckCircle className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="text-gray-500">@{comment.author.username}</span>
            {comment.author.country && (
              <span className="text-gray-400">· {comment.author.country}</span>
            )}
            <span className="text-gray-400">· {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>

            <div className=" ml-auto">
              {!comment.is_deleted && (
                <button
                  onClick={() => setShowMenu(prev => !prev)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Comment actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              )}
              {showMenu && (
                <div className="absolute right-4 z-10 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {isOwnComment ? (
                    <>
                      <button 
                        onClick={() => {
                          setIsEditing(true)
                          setShowMenu(false)
                        }}
                        className="flex w-full items-center space-x-2 px-3 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex w-full items-center space-x-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowMenu(false)}
                      className="flex w-full items-center space-x-2 px-3 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50"
                    >
                      <Flag className="h-4 w-4" />
                      <span>Report</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="mb-4">
              <textarea
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
                className="input-field"
                rows={2}
                maxLength={1000}
              />
              <div className="mt-2 flex items-center space-x-2 text-xs">
                <button
                  onClick={handleSaveEdit}
                  disabled={isUpdating}
                  className="inline-flex items-center space-x-1 rounded bg-green-600 px-3 py-1 text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  <Check className="h-3 w-3" />
                  <span>{isUpdating ? 'Saving…' : 'Save'}</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center space-x-1 rounded bg-gray-200 px-3 py-1 text-gray-700 transition hover:bg-gray-300"
                >
                  <X className="h-3 w-3" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-2 text-sm leading-relaxed text-gray-700">
              {comment.is_deleted ? <span className="italic text-gray-500">[This comment has been deleted]</span> : comment.content}
            </p>
          )}

          {!comment.is_deleted && <CommentAttachments attachments={comment.attachments} />}

          {!comment.is_deleted && comment.reactions && comment.reactions.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              {comment.reactions.map(reaction => (
                <button
                  key={reaction.emoji}
                  onClick={() => onEmojiReact(comment.id, reaction.emoji)}
                  className={`flex items-center space-x-1 rounded-full px-2 py-1 transition ${reaction.user_reacted ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          {!comment.is_deleted && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <button
                onClick={handleLike}
                className={`flex items-center space-x-1 transition ${comment.isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
              >
                <Heart className={`h-4 w-4 ${comment.isLiked ? 'fill-current' : ''}`} />
                <span>{comment.likes_count}</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(prev => !prev)}
                  className="flex items-center space-x-1 transition hover:text-blue-500"
                >
                  <Smile className="h-4 w-4" />
                  <span>React</span>
                </button>
                <EmojiPicker
                  isOpen={showEmojiPicker}
                  onEmojiSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                  variant="compact"
                />
              </div>

              {replyAllowed && (
                <button
                  onClick={handleReply}
                  className="flex items-center space-x-1 transition hover:text-[#f97316]"
                >
                  <Reply className="h-4 w-4" />
                  <span>Reply</span>
                </button>
              )}

              {comment.replies_count > 0 && (
                <span>{comment.replies_count} {comment.replies_count === 1 ? 'reply' : 'replies'}</span>
              )}
            </div>
          )}

          {replyingTo === comment.id && replyAllowed && (
            <div className="mt-3">
              <textarea
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                className="input-field"
                rows={2}
                maxLength={500}
                placeholder={`Reply to ${comment.author.full_name}…`}
              />
              <div className="mt-2 flex items-center space-x-2">
                <button
                  onClick={() => onSubmitReply(comment.id)}
                  disabled={isReplySubmitting || !replyContent.trim()}
                  className="rounded bg-primary-600 px-3 py-1 text-sm text-white transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {isReplySubmitting ? 'Posting…' : 'Reply'}
                </button>
                <button
                  onClick={() => {
                    setReplyContent('')
                    onReplyToggle(comment.id)
                  }}
                  className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {comment.replies.map(reply => (
                <CommentItem
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
interface GifPickerProps {
  isOpen: boolean
  onSelect: (url: string) => void
  onClose: () => void
}

const GifPicker: React.FC<GifPickerProps> = ({ isOpen, onSelect, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
    >
      <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
        {SAMPLE_GIFS.map(gif => (
          <button
            key={gif}
            type="button"
            onClick={() => onSelect(gif)}
            className="overflow-hidden rounded border border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <img src={gif} alt="GIF option" className="h-24 w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

interface StickerPickerProps {
  isOpen: boolean
  onSelect: (value: string) => void
  onClose: () => void
}

const StickerPicker: React.FC<StickerPickerProps> = ({ isOpen, onSelect, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-20 z-50 mb-2 w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
    >
      <div className="grid grid-cols-4 gap-2">
        {STICKER_EMOJIS.map(sticker => (
          <button
            key={sticker}
            type="button"
            onClick={() => onSelect(sticker)}
            className="flex items-center justify-center rounded border border-transparent p-2 text-2xl transition hover:border-primary-300"
          >
            {sticker}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ComposerAttachmentPreviewProps {
  attachment: ComposerAttachment
  onRemove: () => void
}

const ComposerAttachmentPreview: React.FC<ComposerAttachmentPreviewProps> = ({ attachment, onRemove }) => {
  if (attachment.type === 'image') {
    return (
      <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200">
        <img src={attachment.previewUrl} alt="Selected attachment" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black bg-opacity-60 text-white"
          aria-label="Remove attachment"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  if (attachment.type === 'gif') {
    return (
      <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200">
        <img src={attachment.url} alt="Selected GIF" className="h-full w-full object-cover" />
        <span className="absolute left-1.5 top-1.5 rounded bg-black bg-opacity-70 px-1.5 text-xs font-semibold text-white">GIF</span>
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black bg-opacity-60 text-white"
          aria-label="Remove attachment"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex h-24 w-24 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-4xl">
      {attachment.value}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black bg-opacity-60 text-white"
        aria-label="Remove attachment"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

interface CommentAttachmentsProps {
  attachments?: CommentAttachment[]
}

const CommentAttachments: React.FC<CommentAttachmentsProps> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) {
    return null
  }

  const nodes = attachments
    .map((attachment) => {
      if (attachment.type === 'image' && attachment.url) {
        return (
          <img
            key={attachment.id}
            src={attachment.url}
            alt="Comment attachment"
            className="h-48 w-full rounded-lg object-cover"
          />
        )
      }

      if (attachment.type === 'gif' && attachment.url) {
        return (
          <img
            key={attachment.id}
            src={attachment.url}
            alt="Comment GIF"
            className="h-48 w-full rounded-lg object-cover"
          />
        )
      }

      if (attachment.type === 'sticker' && attachment.value) {
        return (
          <div
            key={attachment.id}
            className="flex h-24 w-24 items-center justify-center text-5xl"
          >
            {attachment.value}
          </div>
        )
      }

      return null
    })
    .filter(Boolean)

  if (nodes.length === 0) {
    return null
  }

  return <div className="mb-2 flex flex-wrap gap-2">{nodes as React.ReactNode[]}</div>
}

export default CommentsSection
