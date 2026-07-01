'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AtSign, ChevronDown, Heart, MessageCircle, Reply, Send, Smile, Trash2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useReelComments } from '@/shared/hooks/useReels'
import { ReelComment } from '@/shared/types/reels'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

interface ReelCommentsProps {
  reelId: string
  isOpen: boolean
  onClose: () => void
  commentsCount?: number
  /** When set, desktop panel renders inside this element (inline layout). */
  desktopContainer?: HTMLElement | null
  /** Use inline desktop panel slot instead of fixed right overlay. */
  inlineDesktopPanel?: boolean
}

function CommentAvatar({
  author,
  size = 'md',
}: {
  author?: { username?: string; full_name?: string; avatar_url?: string }
  size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const displayName = author?.full_name || author?.username
  const ring = 'ring-1 ring-border/60'

  if (author?.avatar_url) {
    return (
      <img
        src={author.avatar_url}
        alt={displayName ?? ''}
        className={`${dim} shrink-0 rounded-full object-cover ${ring}`}
      />
    )
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-tertiary to-surface-secondary font-semibold text-content-secondary ${text} ${ring}`}
    >
      {(displayName ?? '?').charAt(0).toUpperCase()}
    </div>
  )
}

function useReelCommentsLogic(reelId: string, isOpen: boolean) {
  const { user } = useAuth()
  const { comments, loading, addComment, deleteComment, toggleCommentLike } = useReelComments(reelId, isOpen)

  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const userAvatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.profile_image as string | undefined)

  const getCommentAuthor = useCallback(
    (comment: ReelComment) => comment.author ?? comment.profiles,
    []
  )

  const isOwnComment = useCallback(
    (comment: ReelComment) => {
      if (!user) return false
      return (comment.user_id || comment.author_id) === user.id
    },
    [user]
  )

  useEffect(() => {
    if (!isOpen) {
      setNewComment('')
      setReplyingTo(null)
      setReplyText('')
      setExpandedReplies(new Set())
    }
  }, [isOpen])

  const handleSubmitComment = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newComment.trim() || !user) return

    setIsSubmitting(true)
    try {
      const { error } = await addComment(newComment.trim())
      if (error) toast.error(error)
      else setNewComment('')
    } catch {
      toast.error('Failed to add comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim() || !user) return

    setIsSubmitting(true)
    try {
      const { error } = await addComment(replyText.trim(), parentId)
      if (error) toast.error(error)
      else {
        setReplyText('')
        setReplyingTo(null)
        setExpandedReplies((prev) => new Set(prev).add(parentId))
      }
    } catch {
      toast.error('Failed to add reply')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return
    const { error } = await deleteComment(commentId)
    if (error) toast.error(error)
  }

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      toast.error('Please sign in to like comments')
      return
    }
    const { error } = await toggleCommentLike(commentId)
    if (error) toast.error(error)
  }

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  return {
    user,
    userAvatarUrl,
    comments,
    loading,
    newComment,
    setNewComment,
    replyingTo,
    setReplyingTo,
    replyText,
    setReplyText,
    expandedReplies,
    isSubmitting,
    getCommentAuthor,
    isOwnComment,
    handleSubmitComment,
    handleSubmitReply,
    handleDeleteComment,
    handleLikeComment,
    toggleReplies,
  }
}

type CommentsLogic = ReturnType<typeof useReelCommentsLogic>

function CommentRow({
  comment,
  logic,
  isReply = false,
}: {
  comment: ReelComment
  logic: CommentsLogic
  isReply?: boolean
}) {
  const author = logic.getCommentAuthor(comment)
  const {
    isOwnComment,
    handleLikeComment,
    handleDeleteComment,
    replyingTo,
    setReplyingTo,
    replyText,
    setReplyText,
    handleSubmitReply,
    isSubmitting,
    expandedReplies,
    toggleReplies,
  } = logic

  const replyCount = comment.replies?.length ?? comment.replies_count ?? 0
  const showReplies = expandedReplies.has(comment.id)

  const displayName = author?.full_name || author?.username || 'user'
  const likeCount = comment.likes_count || 0
  const contentIndent = isReply ? 'ml-10' : 'ml-[3.25rem]'

  return (
    <div className={isReply ? 'ml-10' : ''}>
      <div className="group flex gap-3 py-2">
        <div className="shrink-0 self-start">
          <CommentAvatar author={author} size={isReply ? 'sm' : 'md'} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight text-content">{displayName}</p>
          <p className="mt-1 text-sm leading-relaxed text-content break-words whitespace-pre-wrap">
            {comment.content}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs text-content-tertiary">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {!isReply && (
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(comment.id)
                  setReplyText('')
                }}
                className="text-xs font-semibold text-content-secondary transition hover:text-primary-600"
              >
                Reply
              </button>
            )}
            {isOwnComment(comment) && (
              <button
                type="button"
                onClick={() => handleDeleteComment(comment.id)}
                className="rounded p-0.5 text-content-tertiary transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleLikeComment(comment.id)}
          className="flex shrink-0 flex-col items-center gap-0.5 self-start pt-1 text-content-tertiary transition hover:text-red-500"
          aria-label="Like comment"
        >
          <Heart className={`h-[18px] w-[18px] ${likeCount > 0 ? 'fill-red-500 text-red-500' : ''}`} />
          {likeCount > 0 && (
            <span className="text-[11px] font-medium tabular-nums text-content-secondary">{likeCount}</span>
          )}
        </button>
      </div>

      {replyingTo === comment.id && (
        <div className={`${contentIndent} mb-2 flex gap-2.5`}>
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmitReply(comment.id)
              if (e.key === 'Escape') setReplyingTo(null)
            }}
            placeholder={`Reply to ${displayName}...`}
            className="flex-1 rounded-2xl border border-border bg-surface-canvas px-4 py-2.5 text-sm text-content placeholder:text-content-tertiary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleSubmitReply(comment.id)}
            disabled={isSubmitting || !replyText.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isReply && replyCount > 0 && !showReplies && (
        <button
          type="button"
          onClick={() => toggleReplies(comment.id)}
          className={`${contentIndent} mb-1 flex items-center gap-1.5 text-xs font-semibold text-content-secondary transition hover:text-content`}
        >
          <Reply className="h-3.5 w-3.5 rotate-180" />
          View {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}

      {!isReply && showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="mt-1 space-y-1 border-l-2 border-border/50 pl-2">
          {comment.replies.map((reply) => (
            <CommentRow key={reply.id} comment={reply} logic={logic} isReply />
          ))}
          <button
            type="button"
            onClick={() => toggleReplies(comment.id)}
            className={`${contentIndent} flex items-center gap-1.5 py-1 text-xs font-semibold text-content-secondary transition hover:text-content`}
          >
            Hide replies
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>
      )}
    </div>
  )
}

function CommentsList({
  logic,
  loading,
  comments,
}: {
  logic: CommentsLogic
  loading: boolean
  comments: ReelComment[]
}) {
  if (loading && comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary-600" />
        <p className="mt-3 text-sm text-content-secondary">Loading comments…</p>
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-secondary">
          <MessageCircle className="h-7 w-7 text-content-tertiary" />
        </div>
        <p className="text-sm font-medium text-content">No comments yet</p>
        <p className="mt-1 text-xs text-content-secondary">Start the conversation</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/40">
      {comments.map((comment) => (
        <CommentRow key={comment.id} comment={comment} logic={logic} />
      ))}
    </div>
  )
}

function CommentComposer({ logic }: { logic: CommentsLogic }) {
  const { user, userAvatarUrl, newComment, setNewComment, handleSubmitComment, isSubmitting } = logic

  if (!user) {
    return (
      <div className="shrink-0 border-t border-border bg-surface-secondary/50 px-4 py-4 text-center text-sm text-content-secondary">
        Sign in to comment
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmitComment(e)
        }}
        className="flex items-start gap-3"
      >
        <div className="shrink-0 pt-1">
          <CommentAvatar
            author={{
              username: user.email?.split('@')[0],
              avatar_url: userAvatarUrl,
            }}
            size="sm"
          />
        </div>
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add comment..."
            maxLength={500}
            className="w-full rounded-2xl border border-border bg-surface-canvas py-2.5 pl-4 pr-[4.5rem] text-sm text-content placeholder:text-content-tertiary transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <AtSign className="h-4 w-4 text-content-tertiary" aria-hidden />
            <Smile className="h-4 w-4 text-content-tertiary" aria-hidden />
          </div>
        </div>
        {newComment.trim() && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50"
            aria-label="Post comment"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  )
}

function CommentsBody({
  logic,
  commentsCount,
  onClose,
  variant,
}: {
  logic: CommentsLogic
  commentsCount?: number
  onClose: () => void
  variant: 'sheet' | 'panel'
}) {
  const { comments, loading } = logic
  const displayCount = commentsCount ?? comments.length
  const countLabel = `${displayCount.toLocaleString()} ${displayCount === 1 ? 'comment' : 'comments'}`

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div
        className={`relative flex shrink-0 items-center border-b border-border px-4 ${
          variant === 'sheet' ? 'justify-center py-3.5' : 'justify-between py-4'
        }`}
      >
        {variant === 'panel' ? (
          <div>
            <h2 className="text-lg font-bold tracking-tight text-content">Comments</h2>
            <p className="mt-0.5 text-xs text-content-secondary">{countLabel}</p>
          </div>
        ) : (
          <p className="text-sm font-semibold text-content">{countLabel}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-secondary hover:text-content ${
            variant === 'sheet' ? 'absolute right-3 top-1/2 -translate-y-1/2' : ''
          }`}
          aria-label="Close comments"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
        <CommentsList logic={logic} loading={loading} comments={comments} />
      </div>

      <CommentComposer logic={logic} />
    </div>
  )
}

const ReelComments: React.FC<ReelCommentsProps> = ({
  reelId,
  isOpen,
  onClose,
  commentsCount,
  desktopContainer,
  inlineDesktopPanel = false,
}) => {
  const logic = useReelCommentsLogic(reelId, isOpen)
  const [mounted, setMounted] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setPortalTarget(desktopContainer ?? null)
  }, [desktopContainer])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    const mq = window.matchMedia('(max-width: 1023px)')
    const lock = () => {
      if (mq.matches) document.body.style.overflow = 'hidden'
    }
    lock()
    mq.addEventListener('change', lock)
    return () => {
      document.body.style.overflow = prev
      mq.removeEventListener('change', lock)
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const panel = <CommentsBody logic={logic} commentsCount={commentsCount} onClose={onClose} variant="panel" />
  const sheet = <CommentsBody logic={logic} commentsCount={commentsCount} onClose={onClose} variant="sheet" />

  const desktopPanel = inlineDesktopPanel ? (
    portalTarget ? (
      createPortal(<div className="flex h-full min-h-0 w-full flex-col">{panel}</div>, portalTarget)
    ) : null
  ) : (
    <div className="pointer-events-auto fixed right-0 top-[4.5rem] z-50 hidden h-[calc(100dvh-4.5rem)] w-[min(420px,32vw)] flex-col border-l border-border bg-surface shadow-xl lg:flex">
      {panel}
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-[55] flex flex-col justify-end lg:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Close comments"
          onClick={onClose}
        />
        <div className="relative flex max-h-[85dvh] min-h-[50dvh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl transition-transform duration-300 ease-out">
          {sheet}
        </div>
      </div>

      {desktopPanel}
    </>
  )
}

export default ReelComments
