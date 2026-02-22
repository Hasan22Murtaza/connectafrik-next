'use client'

import React, { useState, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Send, Trash2, Smile, Loader2, Flag } from 'lucide-react'
import { useGroupPostComments, GroupPostComment } from '@/shared/hooks/useGroupPostComments'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface GroupPostCommentsSectionProps {
  groupId: string
  groupPostId: string
  isOpen: boolean
  onClose: () => void
}

const GroupPostCommentsSection: React.FC<GroupPostCommentsSectionProps> = ({
  groupId,
  groupPostId,
  isOpen,
  onClose
}) => {
  const { user } = useAuth()
  const { comments, loading, addComment, toggleLike, deleteComment } = useGroupPostComments(groupId, groupPostId)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReplySubmitting, setIsReplySubmitting] = useState(false)
  const commentInputRef = useRef<HTMLInputElement | null>(null)

  const userInitial = (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsSubmitting(true)
    const { error } = await addComment(newComment)
    if (!error) {
      setNewComment('')
    }
    setIsSubmitting(false)
  }

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
      e.preventDefault()
      handleSubmitComment(e as unknown as React.FormEvent)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) return

    setIsReplySubmitting(true)
    const { error } = await addComment(replyContent, parentId)
    if (!error) {
      setReplyContent('')
      setReplyingTo(null)
    }
    setIsReplySubmitting(false)
  }

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, parentId: string) => {
    if (e.key === 'Enter' && !e.shiftKey && replyContent.trim()) {
      e.preventDefault()
      handleSubmitReply(parentId)
    }
  }

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId)
  }

  if (!isOpen) return null

  return (
    <div className="w-full border-t border-gray-100 mt-1">
      {/* Comments list */}
      <div className="space-y-1 px-3 pt-2 pb-1">
        {loading ? (
          <div className="py-4 text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-3 text-center text-xs text-gray-400">Be the first to comment</p>
        ) : (
          comments.map(comment => (
            <FBGroupCommentItem
              key={comment.id}
              comment={comment}
              onLike={toggleLike}
              onReplyToggle={(id) => {
                setReplyContent('')
                setReplyingTo(replyingTo === id ? null : id)
              }}
              onDelete={handleDelete}
              replyingTo={replyingTo}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              onSubmitReply={handleSubmitReply}
              onReplyKeyDown={handleReplyKeyDown}
              isReplySubmitting={isReplySubmitting}
              currentUserId={user?.id}
            />
          ))
        )}
      </div>

      {/* Comment composer */}
      {user && (
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600 flex-shrink-0">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="You" className="w-full h-full rounded-full object-cover" />
            ) : (
              userInitial
            )}
          </div>
          <form onSubmit={handleSubmitComment} className="relative flex flex-1 items-center">
            <input
              ref={commentInputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleCommentKeyDown}
              placeholder="Write a comment..."
              className="w-full rounded-full bg-gray-100 py-2 pl-4 pr-12 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200"
              maxLength={1000}
              disabled={isSubmitting}
            />
            <div className="absolute right-2 flex items-center gap-1">
              {newComment.trim() && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50"
                  aria-label="Post comment"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────── */
/*  Facebook-style Group Comment Item             */
/* ────────────────────────────────────────────── */

interface FBGroupCommentItemProps {
  comment: GroupPostComment
  onLike: (commentId: string) => void
  onReplyToggle: (commentId: string) => void
  onDelete: (commentId: string) => void
  replyingTo: string | null
  replyContent: string
  setReplyContent: React.Dispatch<React.SetStateAction<string>>
  onSubmitReply: (parentId: string) => void
  onReplyKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, parentId: string) => void
  isReplySubmitting: boolean
  currentUserId?: string
  depth?: number
}

const FBGroupCommentItem: React.FC<FBGroupCommentItemProps> = ({
  comment,
  onLike,
  onReplyToggle,
  onDelete,
  replyingTo,
  replyContent,
  setReplyContent,
  onSubmitReply,
  onReplyKeyDown,
  isReplySubmitting,
  currentUserId,
  depth = 0
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const isAuthor = currentUserId === comment.author_id

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: false })
    .replace('about ', '')
    .replace('less than a minute', '1m')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ months?/, 'mo')
    .replace(/ years?/, 'y')

  return (
    <div className={depth > 0 ? 'ml-8 mt-1' : 'mt-1'}>
      <div className="flex gap-2">
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {comment.author?.avatar_url ? (
            <img
              src={comment.author.avatar_url}
              alt={comment.author.full_name || comment.author.username}
              className={`rounded-full object-cover ${depth > 0 ? 'h-7 w-7' : 'h-8 w-8'}`}
            />
          ) : (
            <div className={`flex items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600 ${depth > 0 ? 'h-7 w-7' : 'h-8 w-8'}`}>
              {(comment.author?.full_name || comment.author?.username || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Gray bubble */}
          <div className="relative group inline-block max-w-full">
            <div className="rounded-2xl bg-gray-100 px-3 py-1.5 inline-block max-w-full">
              <span className="text-[13px] font-semibold text-gray-900 leading-tight">
                {comment.author?.full_name || comment.author?.username || 'Unknown'}
              </span>
              <p className="text-[13px] text-gray-700 leading-snug whitespace-pre-wrap break-words">{comment.content}</p>
            </div>

            {/* Three-dot menu on hover */}
            {isAuthor && (
              <div className="absolute -right-7 top-1 hidden group-hover:block">
                <button
                  onClick={() => setShowMenu(prev => !prev)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                >
                  <span className="text-sm leading-none">···</span>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 z-10 w-28 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => { onDelete(comment.id); setShowMenu(false) }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Like · Reply · Time row */}
          <div className="flex items-center gap-3 pl-1 mt-0.5 text-xs">
            <button
              onClick={() => onLike(comment.id)}
              className={`font-semibold transition hover:underline ${comment.isLiked ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Like
            </button>
            {depth === 0 && (
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

          {/* Reply input */}
          {replyingTo === comment.id && depth === 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-500 flex-shrink-0">
                {(currentUserId || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="relative flex flex-1 items-center">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={(e) => onReplyKeyDown(e, comment.id)}
                  placeholder={`Reply to ${comment.author?.full_name || 'user'}...`}
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
                <FBGroupCommentItem
                  key={reply.id}
                  comment={reply}
                  onLike={onLike}
                  onReplyToggle={onReplyToggle}
                  onDelete={onDelete}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  onSubmitReply={onSubmitReply}
                  onReplyKeyDown={onReplyKeyDown}
                  isReplySubmitting={isReplySubmitting}
                  currentUserId={currentUserId}
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

export default GroupPostCommentsSection
