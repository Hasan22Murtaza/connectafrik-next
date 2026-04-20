'use client'

import React, { useState, useEffect } from 'react'
import { MoreHorizontal, Trash2, Edit } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { GroupPost } from '@/shared/hooks/useGroupPosts'
import GroupPostCommentsSection from '@/features/groups/components/GroupPostCommentsSection'
import { useGroupPostReactions, GroupReactionGroup, GroupPostReactionsData } from '@/shared/hooks/useGroupPostReactions'
import PostEngagement from '@/shared/components/PostEngagement'
import CreatePost, { type PostSubmitData } from '@/features/social/components/CreatePost'

interface GroupPostCardProps {
  post: GroupPost
  onLike: () => void
  onComment: () => void
  onShare: () => void
  onDelete?: () => void
  onEdit?: (data: PostSubmitData) => void
  onView?: () => void
  onEmojiReaction?: (postId: string, emoji: string) => void
  isPostLiked?: boolean
  showCommentsFor?: boolean
  onToggleComments?: () => void
  prefetchedReactions?: GroupPostReactionsData
  prefetchedReactionGroups?: GroupReactionGroup[]
  prefetchedTotalReactionCount?: number
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
  onToggleComments,
  prefetchedReactions,
  prefetchedReactionGroups,
  prefetchedTotalReactionCount
}) => {
  const { user } = useAuth()
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const postOptionsMenuId = React.useId()
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Fetch reactions with user data
  const {
    reactions
  } = useGroupPostReactions(post.group_id, post.id, {
    enabled: !prefetchedReactions && !prefetchedReactionGroups,
    initialReactions: prefetchedReactions,
  })

  const isAuthor = user?.id === post.author_id

  const handleSaveEdit = async (postData: PostSubmitData) => {
    if (!onEdit) return
    try {
      await onEdit(postData)
      setIsEditing(false)
    } catch {
      // Parent (e.g. updatePost) already surfaces error toast
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
    setShowMenu(false)
  }

  const handleDeleteConfirm = () => {
    onDelete?.()
    setShowDeleteConfirm(false)
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  const handleEditClick = () => {
    setIsEditing(true)
    setShowMenu(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Get all reaction groups sorted by count
  const getReactionGroups = () => {
    if (prefetchedReactionGroups) {
      return [...prefetchedReactionGroups].sort((a, b) => b.count - a.count)
    }

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
              <h4 className="font-semibold text-gray-900 !no-underline">
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
        {isAuthor && (onEdit || onDelete) && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-full p-2 transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1"
              aria-label="Post options"
              aria-expanded={showMenu}
              aria-haspopup="menu"
              aria-controls={postOptionsMenuId}
            >
              <MoreHorizontal className="h-5 w-5 text-gray-600" aria-hidden />
            </button>
            {showMenu && (
              <ul
                id={postOptionsMenuId}
                role="menu"
                aria-label="Your post actions"
                className="absolute right-0 top-full z-50 mt-1 m-0 w-[min(100vw-2rem,20rem)] list-none rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
              >
                {onEdit && (
                  <li role="none" className="list-none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleEditClick}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-100 focus:outline-none focus-visible:bg-gray-100"
                    >
                      <Edit
                        className="mt-0.5 h-5 w-5 shrink-0 text-gray-600"
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900">
                          Edit post
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          Change text, media, or details
                        </span>
                      </span>
                    </button>
                  </li>
                )}
                {onDelete && (
                  <li
                    role="none"
                    className={`list-none ${onEdit ? 'border-t border-gray-100' : ''}`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDeleteClick}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-red-50 focus:outline-none focus-visible:bg-red-50"
                    >
                      <Trash2
                        className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-red-600">
                          Delete post
                        </span>
                        <span className="mt-0.5 block text-xs text-red-500/90">
                          Remove this group post permanently
                        </span>
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Content */}
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

      {/* Engagement Stats & Actions */}
      {/*
        For activity feed posts, reactions are prefetched from /api/groups/activity
        in post-like shape (reactions + reactions_total_count), so no extra call.
      */}
      <PostEngagement
        reactionGroups={getReactionGroups()}
        totalReactionCount={prefetchedReactionGroups ? (prefetchedTotalReactionCount ?? 0) : reactions.totalCount}
        commentsCount={post.comments_count}
        onLike={(emoji) => onEmojiReaction?.(post.id, emoji || '👍')}
        onComment={() => onToggleComments ? onToggleComments() : onComment()}
        onShare={onShare}
        onUserClick={(username) => router.push(`/user/${username}`)}
        postId={post.id}
        reactionsEndpoint={`/api/groups/${post.group_id}/posts/${post.id}/reactions`}
      />

      {/* Delete Confirmation Dialog */}
      {/* Edit — same CreatePost modal as home feed */}
      {isEditing && (
        <div
          data-edit-modal
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancelEdit}
            aria-hidden
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl z-10">
            <CreatePost
              groupPostEdit
              editData={{
                id: post.id,
                title: post.title,
                content: post.content,
                category: 'general',
                media_urls: post.media_urls ?? [],
                location: undefined,
              }}
              onSubmit={handleSaveEdit}
              onCancel={handleCancelEdit}
              defaultCategory="general"
            />
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Group Post
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showCommentsFor && (
        <GroupPostCommentsSection
          groupId={post.group_id}
          groupPostId={post.id}
          isOpen={true}
          onClose={() => onToggleComments?.()}
        />
      )}
    </div>
  )
}

export default GroupPostCard
