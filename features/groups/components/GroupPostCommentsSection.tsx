'use client'

import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Heart, Reply, MoreHorizontal, Send, Trash2, Edit2, X } from 'lucide-react'
import { useGroupPostComments, GroupPostComment } from '@/shared/hooks/useGroupPostComments'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface GroupPostCommentsSectionProps {
  groupPostId: string
  isOpen: boolean
  onClose: () => void
}

const GroupPostCommentsSection: React.FC<GroupPostCommentsSectionProps> = ({
  groupPostId,
  isOpen,
  onClose
}) => {
  const { user } = useAuth()
  const { comments, loading, addComment, toggleLike, deleteComment, refetch } = useGroupPostComments(groupPostId)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) {
      toast.error('Please enter a comment')
      return
    }

    setIsSubmitting(true)
    const { error } = await addComment(newComment)
    if (!error) {
      setNewComment('')
    }
    setIsSubmitting(false)
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) {
      toast.error('Please enter a reply')
      return
    }

    setIsSubmitting(true)
    const { error } = await addComment(replyContent, parentId)
    if (!error) {
      setReplyContent('')
      setReplyingTo(null)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (commentId: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      await deleteComment(commentId)
    }
  }

  if (!isOpen) return null

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Comments</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Comment Form */}
      {user && (
        <form onSubmit={handleSubmitComment} className="mb-4">
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="You"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-gray-500 font-semibold text-sm">
                  {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSubmitting}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onLike={() => toggleLike(comment.id)}
              onReply={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              onDelete={() => handleDelete(comment.id)}
              onSubmitReply={(content) => handleSubmitReply(comment.id)}
              replyingTo={replyingTo === comment.id}
              replyContent={replyContent}
              onReplyContentChange={setReplyContent}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CommentItemProps {
  comment: GroupPostComment
  onLike: () => void
  onReply: () => void
  onDelete: () => void
  onSubmitReply: (content: string) => void
  replyingTo: boolean
  replyContent: string
  onReplyContentChange: (content: string) => void
  currentUserId?: string
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onLike,
  onReply,
  onDelete,
  onSubmitReply,
  replyingTo,
  replyContent,
  onReplyContentChange,
  currentUserId
}) => {
  const isAuthor = currentUserId === comment.author_id

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          {comment.author?.avatar_url ? (
            <img
              src={comment.author.avatar_url}
              alt={comment.author.full_name || comment.author.username}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-gray-500 font-semibold text-sm">
              {(comment.author?.full_name || comment.author?.username || 'U')[0].toUpperCase()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="font-semibold text-sm text-gray-900">
                  {comment.author?.full_name || comment.author?.username || 'Unknown'}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              {isAuthor && (
                <button
                  onClick={onDelete}
                  className="p-1 hover:bg-gray-200 rounded text-red-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-700">{comment.content}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-1 ml-2">
            <button
              onClick={onLike}
              className={`flex items-center gap-1 text-xs ${
                comment.isLiked ? 'text-red-600' : 'text-gray-600 hover:text-red-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${comment.isLiked ? 'fill-current' : ''}`} />
              <span>{comment.likes_count}</span>
            </button>
            <button
              onClick={onReply}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-primary-600"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
          </div>

          {/* Reply Form */}
          {replyingTo && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (replyContent.trim()) {
                  onSubmitReply(replyContent)
                }
              }}
              className="mt-2 flex gap-2"
            >
              <input
                type="text"
                value={replyContent}
                onChange={(e) => onReplyContentChange(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                disabled={!replyContent.trim()}
                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 pl-4">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    {reply.author?.avatar_url ? (
                      <img
                        src={reply.author.avatar_url}
                        alt={reply.author.full_name || reply.author.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-500 font-semibold text-xs">
                        {(reply.author?.full_name || reply.author?.username || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="font-semibold text-xs text-gray-900">
                            {reply.author?.full_name || reply.author?.username || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {currentUserId === reply.author_id && (
                          <button
                            onClick={() => handleDelete(reply.id)}
                            className="p-1 hover:bg-gray-200 rounded text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-700">{reply.content}</p>
                    </div>
                    <button
                      onClick={() => toggleLike(reply.id)}
                      className={`flex items-center gap-1 text-xs mt-1 ml-2 ${
                        reply.isLiked ? 'text-red-600' : 'text-gray-600 hover:text-red-600'
                      }`}
                    >
                      <Heart className={`w-3 h-3 ${reply.isLiked ? 'fill-current' : ''}`} />
                      <span>{reply.likes_count}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GroupPostCommentsSection

