'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, Edit, Eye, Smile } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { GroupPost } from '@/shared/hooks/useGroupPosts'
import GroupPostCommentsSection from '@/features/groups/components/GroupPostCommentsSection'
import { useGroupPostReactions, GroupReactionGroup } from '@/shared/hooks/useGroupPostReactions'
import ReactionTooltip from '@/features/social/components/ReactionTooltip'
import toast from 'react-hot-toast'
import { PiShareFat } from 'react-icons/pi'
import { quickReactions, getReactionEmoji } from '@/shared/utils/reactionUtils'

interface GroupPostCardProps {
  post: GroupPost
  onLike: () => void
  onComment: () => void
  onShare: () => void
  onDelete?: () => void
  onEdit?: (title: string, content: string) => void
  onView?: () => void
  onEmojiReaction?: (postId: string, emoji: string) => void
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
  onEmojiReaction,
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
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null)
  const closeTimeout = useRef<NodeJS.Timeout | null>(null)

  // Fetch reactions with user data
  const {
    reactions,
    loading: reactionsLoading,
    refetch: refetchReactions,
  } = useGroupPostReactions(post.id)

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

  const handleReactHover = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
    setShowReactionPicker(true)
  }

  const handleReactLeave = () => {
    closeTimeout.current = setTimeout(() => {
      setShowReactionPicker(false)
    }, 300)
  }

  // Get all reaction groups sorted by count
  const getReactionGroups = () => {
    const groups: GroupReactionGroup[] = []
    Object.keys(reactions).forEach((key) => {
      if (key !== 'totalCount') {
        const reaction = reactions[key]
        if (reaction && typeof reaction === 'object' && 'count' in reaction && reaction.count > 0) {
          groups.push(reaction as GroupReactionGroup)
        }
      }
    })
    return groups.sort((a, b) => b.count - a.count)
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

      {/* Engagement Stats & Actions */}
      <div>
        {/* Stats Row - Facebook style */}
        <div className="flex items-center justify-between px-1 py-2">
          {/* Left: Reaction emoji circles + total count */}
          <div className="flex items-center gap-1.5">
            {getReactionGroups().length > 0 && (
              <div className="flex items-center gap-1 cursor-pointer group">
                <div className="flex items-center -space-x-1.5">
                  {getReactionGroups()
                    .slice(0, 3)
                    .map((group) => (
                      <div
                        key={group.type}
                        className="relative z-10"
                        onMouseEnter={() => setHoveredReaction(group.type)}
                        onMouseLeave={() => setHoveredReaction(null)}
                      >
                        <span className="inline-flex items-center justify-center w-[22px] h-[22px] text-sm rounded-full border-2 border-white shadow-sm bg-gray-50 cursor-pointer">
                          {getReactionEmoji(group.type)}
                        </span>
                        <ReactionTooltip
                          users={group.users || []}
                          isVisible={hoveredReaction === group.type}
                        />
                      </div>
                    ))}
                </div>
                {reactions.totalCount > 0 && (
                  <span className="text-[15px] text-gray-500 group-hover:underline">
                    {reactions.totalCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: counts with icons (FB style) */}
          <div className="flex items-center gap-3 text-gray-500">
            {post.comments_count > 0 && (
              <span
                className="flex items-center gap-1 text-[15px] hover:underline cursor-pointer"
                onClick={() => onToggleComments ? onToggleComments() : onComment()}
              >
                {post.comments_count}
                <MessageCircle className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons - Facebook style */}
        <div className="flex items-stretch border-t border-gray-200">
          {/* Like button with hover emoji picker */}
          <div className="relative flex-1">
            <button
              onMouseEnter={handleReactHover}
              onMouseLeave={handleReactLeave}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 cursor-pointer rounded-sm"
              aria-label="Like post"
            >
              <Smile className="w-5 h-5" />
              <span className="text-[15px] font-semibold">Like</span>
            </button>

            {showReactionPicker && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
                onMouseEnter={handleReactHover}
                onMouseLeave={handleReactLeave}
              >
                <div className="bg-white rounded-full shadow-xl border border-gray-100 px-2 py-1.5">
                  <div className="flex items-center gap-0.5">
                    {quickReactions.slice(0, 6).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onEmojiReaction?.(post.id, emoji)
                          setShowReactionPicker(false)
                        }}
                        className="w-9 h-9 text-xl hover:scale-[1.4] hover:-translate-y-1.5 transition-all duration-200 cursor-pointer flex items-center justify-center rounded-full"
                      >
                        <span className="emoji">{emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onToggleComments || onComment}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 cursor-pointer rounded-sm"
            aria-label="Comment on post"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[15px] font-semibold">Comment</span>
          </button>

          <button
            onClick={onShare}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 cursor-pointer rounded-sm"
            aria-label="Share post"
          >
            <PiShareFat className="w-5 h-5" />
            <span className="text-[15px] font-semibold">Share</span>
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
