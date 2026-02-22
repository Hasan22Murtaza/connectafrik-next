'use client'

import React, { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Clock, X, Pencil, Trash2, Tag, Globe, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useReels, useUpdateReel, useDeleteReel } from '@/shared/hooks/useReels'
import { useMembers } from '@/shared/hooks/useMembers'
import ReelCard from '@/features/social/components/ReelCard'
import ShareModal from '@/features/social/components/ShareModal'
import { trackEvent } from '@/features/social/services/engagementTracking'
import { sendNotification } from '@/shared/services/notificationService'
import { REEL_CATEGORIES, MAX_REEL_TITLE_LENGTH, MAX_REEL_DESCRIPTION_LENGTH, MAX_REEL_TAGS } from '@/shared/types/reels'
import { Reel, ReelCategory } from '@/shared/types/reels'
import toast from 'react-hot-toast'

const MemoriesPage: React.FC = () => {
  const { user } = useAuth()
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [shareModalState, setShareModalState] = useState<{ open: boolean; reelId: string | null }>({ open: false, reelId: null })

  // Edit modal state
  const [editingReel, setEditingReel] = useState<Reel | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState<ReelCategory>('entertainment')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editNewTag, setEditNewTag] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(true)

  const { reels, loading, error, hasMore, loadMore, refresh } = useReels()
  const { updateReel, loading: updating } = useUpdateReel()
  const { deleteReel, loading: deleting } = useDeleteReel()
  const { members } = useMembers()
  const memoizedMembers = useMemo(() => members, [members])
  const activeShareReel = useMemo(
    () => (shareModalState.reelId ? reels.find((reel) => reel.id === shareModalState.reelId) : null),
    [reels, shareModalState.reelId]
  )
  const shareUrl = useMemo(() => {
    if (!shareModalState.reelId) return ''
    if (typeof window === 'undefined') return `/memories/${shareModalState.reelId}`
    return `${process.env.NEXT_PUBLIC_APP_URL}/memories/${shareModalState.reelId}`
  }, [shareModalState.reelId])

  const handleLike = useCallback((reelId: string) => {
    if (user?.id) {
      trackEvent.like(user.id, reelId, 'reel')
    }
  }, [user?.id])

  const handleComment = useCallback((reelId: string) => {
    setShowCommentsFor(showCommentsFor === reelId ? null : reelId)
    if (user?.id) {
      trackEvent.comment(user.id, reelId, 'reel')
    }
  }, [showCommentsFor, user?.id])

  const handleShare = useCallback((reelId: string) => {
    setShareModalState({ open: true, reelId })
    if (user?.id) {
      trackEvent.share(user.id, reelId, 'reel')
    }
  }, [user?.id])

  const handleSave = useCallback((reelId: string) => {
    if (user?.id) {
      trackEvent.save(user.id, reelId, 'reel')
    }
  }, [user?.id])

  const handleFollow = useCallback((authorId: string) => {
    console.log('Followed author:', authorId)
  }, [])

  // Delete handler
  const handleDelete = useCallback(async (reelId: string) => {
    if (!window.confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
      return
    }

    const { success, error: deleteError } = await deleteReel(reelId)
    if (success) {
      toast.success('Memory deleted successfully')
      refresh()
    } else {
      toast.error(deleteError || 'Failed to delete memory')
    }
  }, [deleteReel, refresh])

  // Edit handlers
  const openEditModal = useCallback((reel: Reel) => {
    setEditingReel(reel)
    setEditTitle(reel.title)
    setEditDescription(reel.description || '')
    setEditCategory(reel.category)
    setEditTags(reel.tags || [])
    setEditIsPublic(reel.is_public)
    setEditNewTag('')
  }, [])

  const closeEditModal = useCallback(() => {
    setEditingReel(null)
    setEditTitle('')
    setEditDescription('')
    setEditCategory('entertainment')
    setEditTags([])
    setEditNewTag('')
    setEditIsPublic(true)
  }, [])

  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReel) return

    if (!editTitle.trim()) {
      toast.error('Title is required')
      return
    }

    const { data, error: updateError } = await updateReel(editingReel.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      category: editCategory,
      tags: editTags,
      is_public: editIsPublic
    })

    if (data) {
      toast.success('Memory updated successfully')
      closeEditModal()
      refresh()
    } else {
      toast.error(updateError || 'Failed to update memory')
    }
  }, [editingReel, editTitle, editDescription, editCategory, editTags, editIsPublic, updateReel, closeEditModal, refresh])

  const addEditTag = useCallback(() => {
    if (editNewTag.trim() && editTags.length < MAX_REEL_TAGS) {
      const tag = editNewTag.trim().toLowerCase()
      if (!editTags.includes(tag)) {
        setEditTags([...editTags, tag])
        setEditNewTag('')
      }
    }
  }, [editNewTag, editTags])

  const removeEditTag = useCallback((tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove))
  }, [editTags])

  const handleSendToMembers = useCallback(async (memberIds: string[], message: string) => {
    if (!memberIds.length) {
      toast.success('No members selected')
      return
    }

    const senderName = user?.user_metadata?.full_name || user?.email || 'Someone'
    const reelId = shareModalState.reelId

    const results = await Promise.allSettled(
      memberIds.map((memberId) =>
        sendNotification({
          user_id: memberId,
          title: 'Memory Shared With You',
          body: message
            ? `${senderName} shared a memory with you: "${message}"`
            : `${senderName} shared a memory with you`,
          notification_type: 'post_share',
          data: {
            type: 'reel_share',
            reel_id: reelId || '',
            sender_id: user?.id || '',
            sender_name: senderName,
            message,
            url: `/memories/${reelId}`,
          },
        })
      )
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    if (succeeded > 0) {
      toast.success(`Shared with ${succeeded} member${succeeded === 1 ? '' : 's'}`)
    } else {
      toast.error('Failed to send notifications')
    }
  }, [user, shareModalState.reelId])

  const handleToggleComments = useCallback((reelId: string) => {
    setShowCommentsFor(showCommentsFor === reelId ? null : reelId)
  }, [showCommentsFor])

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadMore()
    }
  }, [loading, hasMore, loadMore])

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Memories</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Relive your past moments on ConnectAfrik</p>
            </div>
            
            <Link
              href="/memories/create"
              className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Create Memory</span>
            </Link>
          </div>
        </div>

        {/* Memories Grid */}
        <div className="space-y-4 sm:space-y-6">
          {loading && reels.length === 0 ? (
            // Loading skeleton
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                  <div className="bg-gray-200 h-64 sm:h-96"></div>
                  <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/3 mb-1 sm:mb-2"></div>
                        <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                    <div className="h-3 sm:h-4 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 sm:py-12">
              <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Error loading memories</h3>
              <p className="text-gray-600 mb-4 text-sm sm:text-base">{error}</p>
              <button
                onClick={refresh}
                className="btn-primary text-sm sm:text-base"
              >
                Try Again
              </button>
            </div>
          ) : reels.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">No memories found</h3>
              <p className="text-gray-600 mb-4 text-sm sm:text-base">
                Be the first to create a memory!
              </p>
              <Link
                href="/memories/create"
                className="btn-primary text-sm sm:text-base inline-block"
              >
                Create First Memory
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {reels.map((reel) => (
                  <ReelCard
                    key={reel.id}
                    reel={reel}
                    onLike={handleLike}
                    onComment={handleComment}
                    onShare={handleShare}
                    onSave={handleSave}
                    onFollow={handleFollow}
                    onDelete={() => handleDelete(reel.id)}
                    onEdit={() => openEditModal(reel)}
                    showComments={showCommentsFor === reel.id}
                    onToggleComments={handleToggleComments}
                  />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="text-center pt-6 sm:pt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    {loading ? 'Loading...' : 'Load More Memories'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {activeShareReel && (
        <ShareModal
          isOpen={shareModalState.open}
          onClose={() => setShareModalState({ open: false, reelId: null })}
          postUrl={shareUrl}
          postId={activeShareReel.id}
          members={memoizedMembers}
          onSendToMembers={handleSendToMembers}
        />
      )}

      {/* Edit Memory Modal */}
      {editingReel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-primary-600">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-white" />
                <h2 className="text-lg font-semibold text-white">Edit Memory</h2>
              </div>
              <button
                onClick={closeEditModal}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Thumbnail preview */}
              {editingReel.thumbnail_url && (
                <div className="flex justify-center">
                  <img
                    src={editingReel.thumbnail_url}
                    alt={editingReel.title}
                    className="w-32 h-44 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Give your memory a title..."
                  className="input-field"
                  maxLength={MAX_REEL_TITLE_LENGTH}
                  required
                />
                <div className="text-right text-xs text-gray-400 mt-1">
                  {editTitle.length}/{MAX_REEL_TITLE_LENGTH}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Tell people what this memory is about..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  maxLength={MAX_REEL_DESCRIPTION_LENGTH}
                />
                <div className="text-right text-xs text-gray-400 mt-1">
                  {editDescription.length}/{MAX_REEL_DESCRIPTION_LENGTH}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as ReelCategory)}
                  className="input-field"
                >
                  {REEL_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tags
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editNewTag}
                      onChange={(e) => setEditNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addEditTag()
                        }
                      }}
                      placeholder="Add a tag..."
                      className="input-field flex-1"
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onClick={addEditTag}
                      disabled={!editNewTag.trim() || editTags.length >= MAX_REEL_TAGS}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  {editTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {editTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                        >
                          <Tag className="w-3 h-3" />
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => removeEditTag(tag)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-gray-400">
                    {editTags.length}/{MAX_REEL_TAGS} tags
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Privacy
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={editIsPublic}
                      onChange={() => setEditIsPublic(true)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <Globe className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Public</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!editIsPublic}
                      onChange={() => setEditIsPublic(false)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <Lock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">Private</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
                      deleteReel(editingReel.id).then(({ success }) => {
                        if (success) {
                          toast.success('Memory deleted successfully')
                          closeEditModal()
                          refresh()
                        } else {
                          toast.error('Failed to delete memory')
                        }
                      })
                    }
                  }}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || !editTitle.trim()}
                    className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MemoriesPage

