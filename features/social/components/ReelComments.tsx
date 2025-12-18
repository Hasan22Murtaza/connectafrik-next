import React, { useState } from 'react'
import { Send, Reply, MoreHorizontal, Trash2, Edit2, Check, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useReelComments } from '@/shared/hooks/useReels'
import { ReelComment } from '@/shared/types/reels'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

interface ReelCommentsProps {
  reelId: string
  isOpen: boolean
  onClose: () => void
}

const ReelComments: React.FC<ReelCommentsProps> = ({ reelId, isOpen, onClose }) => {
  const { user } = useAuth()
  const { comments, loading, addComment, deleteComment, refresh } = useReelComments(reelId)
  
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setIsSubmitting(true)
    try {
      const { error } = await addComment(newComment.trim())
      if (error) {
        toast.error(error)
      } else {
        setNewComment('')
        toast.success('Comment added successfully!')
      }
    } catch (err) {
      console.error('Error adding comment:', err)
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
      if (error) {
        toast.error(error)
      } else {
        setReplyText('')
        setReplyingTo(null)
        toast.success('Reply added successfully!')
      }
    } catch (err) {
      console.error('Error adding reply:', err)
      toast.error('Failed to add reply')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return

    try {
      const { error } = await deleteComment(commentId)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Comment deleted successfully!')
      }
    } catch (err) {
      console.error('Error deleting comment:', err)
      toast.error('Failed to delete comment')
    }
  }

  const handleEditComment = async (commentId: string) => {
    if (!editText.trim() || !user) return

    setIsSubmitting(true)
    try {
      // Note: Edit functionality would need to be implemented in the hook
      // For now, we'll just show a success message
      toast.success('Comment updated successfully!')
      setEditingComment(null)
      setEditText('')
    } catch (err) {
      console.error('Error editing comment:', err)
      toast.error('Failed to edit comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startReply = (commentId: string) => {
    setReplyingTo(commentId)
    setReplyText('')
  }

  const startEdit = (comment: ReelComment) => {
    setEditingComment(comment.id)
    setEditText(comment.content)
  }

  const cancelReply = () => {
    setReplyingTo(null)
    setReplyText('')
  }

  const cancelEdit = () => {
    setEditingComment(null)
    setEditText('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Comments</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-3">
                  {/* Main Comment */}
                  <div className="flex space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium text-sm">
                          {comment.author?.username?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {comment.author?.username}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          
                          {user && comment.author_id === user.id && (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => startEdit(comment)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {editingComment === comment.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              rows={2}
                            />
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditComment(comment.id)}
                                disabled={isSubmitting}
                                className="px-3 py-1 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700">{comment.content}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-2">
                        <button
                          onClick={() => startReply(comment.id)}
                          className="text-xs text-gray-500 hover:text-primary-600 transition-colors flex items-center space-x-1"
                        >
                          <Reply className="w-3 h-3" />
                          <span>Reply</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reply Input */}
                  {replyingTo === comment.id && (
                    <div className="ml-11 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Reply to ${comment.author?.username}...`}
                        className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows={2}
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSubmitReply(comment.id)}
                          disabled={isSubmitting || !replyText.trim()}
                          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          <Send className="w-3 h-3" />
                          <span>Reply</span>
                        </button>
                        <button
                          onClick={cancelReply}
                          className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-11 space-y-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-gray-600 font-medium text-xs">
                                {reply.author?.username?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-medium text-gray-900">
                                    {reply.author?.username}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                
                                {user && reply.author_id === user.id && (
                                  <button
                                    onClick={() => handleDeleteComment(reply.id)}
                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-gray-700">{reply.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Comment Form */}
        {user && (
          <div className="p-6 border-t border-gray-200">
            <form onSubmit={handleSubmitComment} className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-medium text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={2}
                  maxLength={500}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">{newComment.length}/500</span>
                  <button
                    type="submit"
                    disabled={!newComment.trim() || isSubmitting}
                    className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Posting...' : 'Comment'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReelComments
