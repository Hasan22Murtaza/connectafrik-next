'use client'

import React, { useState } from 'react'
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, Edit, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { GroupPost } from '@/shared/hooks/useGroupPosts'
import GroupPostCommentsSection from '@/features/groups/components/GroupPostCommentsSection'
import toast from 'react-hot-toast'

interface GroupPostCardProps {
  post: GroupPost
  onLike: () => void
  onComment: () => void
  onShare: () => void
  onDelete?: () => void
  onEdit?: (title: string, content: string) => void
  onView?: () => void
  isPostLiked?: boolean
  showCommentsFor?: boolean
  onToggleComments?: () => void
}

const POST_TYPE_LABELS = {
  discussion: 'Discussion',
  goal_update: 'Goal Update',
  announcement: 'Announcement',
  event: 'Event',
  resource: 'Resource'
}

const POST_TYPE_COLORS = {
  discussion: 'bg-blue-100 text-blue-700',
  goal_update: 'bg-green-100 text-green-700',
  announcement: 'bg-yellow-100 text-yellow-700',
  event: 'bg-purple-100 text-purple-700',
  resource: 'bg-orange-100 text-orange-700'
}

const GroupPostCard: React.FC<GroupPostCardProps> = ({
  post,
  onLike,
  onComment,
  onShare,
  onDelete,
  onEdit,
  onView,
  isPostLiked = false,
  showCommentsFor = false,
  onToggleComments
}) => {
  const { user } = useAuth()
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(post.title)
  const [editContent, setEditContent] = useState(post.content)

  const isAuthor = user?.id === post.author_id

  const handleEdit = () => {
    if (onEdit) {
      onEdit(editTitle, editContent)
      setIsEditing(false)
    }
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this post?')) {
      onDelete?.()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            {post.author?.avatar_url ? (
              <img
                src={post.author.avatar_url}
                alt={post.author.full_name || post.author.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-gray-500 font-semibold">
                {(post.author?.full_name || post.author?.username || 'U')[0].toUpperCase()}
              </span>
            )}
          </div>

          {/* Author Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900">
                {post.author?.full_name || post.author?.username || 'Unknown'}
              </h4>
              {post.is_pinned && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Pinned</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded ${POST_TYPE_COLORS[post.post_type]}`}>
                {POST_TYPE_LABELS[post.post_type]}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Menu */}
        {isAuthor && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-500" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <button
                  onClick={() => {
                    setIsEditing(true)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    handleDelete()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-3 mb-4">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            maxLength={200}
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px] resize-none"
            maxLength={5000}
          />
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditTitle(post.title)
                setEditContent(post.content)
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>
          <p className="text-gray-700 whitespace-pre-wrap mb-4">{post.content}</p>

          {/* Media */}
          {post.media_urls && post.media_urls.length > 0 && (
            <div className={`grid gap-2 mb-4 ${
              post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            }`}>
              {post.media_urls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Post media ${index + 1}`}
                  className="w-full h-auto rounded-lg object-cover"
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="flex items-center gap-6">
          <button
            onClick={onLike}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              isPostLiked
                ? 'bg-red-50 text-red-600'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <Heart className={`w-5 h-5 ${isPostLiked ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">{post.likes_count}</span>
          </button>
          <button
            onClick={onToggleComments || onComment}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{post.comments_count}</span>
          </button>
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showCommentsFor && (
        <GroupPostCommentsSection
          groupPostId={post.id}
          isOpen={true}
          onClose={() => onToggleComments?.()}
        />
      )}
    </div>
  )
}

export default GroupPostCard

