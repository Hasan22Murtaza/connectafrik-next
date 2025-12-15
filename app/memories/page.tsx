'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Plus, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useReels } from '@/shared/hooks/useReels'
import { useMembers } from '@/shared/hooks/useMembers'
import ReelCard from '@/features/social/components/ReelCard'
import CreateReel from '@/features/social/components/CreateReel'
import ShareModal from '@/features/social/components/ShareModal'
import { trackEvent } from '@/features/social/services/engagementTracking'
import toast from 'react-hot-toast'

const MemoriesPage: React.FC = () => {
  const { user } = useAuth()
  const [showCreateReel, setShowCreateReel] = useState(false)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [shareModalState, setShareModalState] = useState<{ open: boolean; reelId: string | null }>({ open: false, reelId: null })

  const { reels, loading, error, hasMore, loadMore, refresh } = useReels()
  const { members } = useMembers()
  const memoizedMembers = useMemo(() => members, [members])
  const activeShareReel = useMemo(
    () => (shareModalState.reelId ? reels.find((reel) => reel.id === shareModalState.reelId) : null),
    [reels, shareModalState.reelId]
  )
  const shareUrl = useMemo(() => {
    if (!shareModalState.reelId) return ''
    if (typeof window === 'undefined') return `/memories/${shareModalState.reelId}`
    return `${window.location.origin}/memories/${shareModalState.reelId}`
  }, [shareModalState.reelId])

  console.log('Memories page state:', { 
    reelsLength: reels.length, 
    loading, 
    error, 
    hasMore,
    firstReel: reels[0]
  })

  const handleCreateReelSuccess = useCallback((createdReel: any) => {
    console.log('Created memory:', createdReel?.id)
    toast.success('Memory created successfully!')
    setShowCreateReel(false)
    refresh()
  }, [refresh])

  const handleLike = useCallback((reelId: string) => {
    console.log('Liked memory:', reelId)
    // Track engagement event
    if (user?.id) {
      trackEvent.like(user.id, reelId, 'reel')
    }
  }, [user])

  const handleComment = useCallback((reelId: string) => {
    setShowCommentsFor(showCommentsFor === reelId ? null : reelId)
    // Track engagement event
    if (user?.id) {
      trackEvent.comment(user.id, reelId, 'reel')
    }
  }, [showCommentsFor, user])

  const handleShare = useCallback((reelId: string) => {
    setShareModalState({ open: true, reelId })

    // Track engagement event
    if (user?.id) {
      trackEvent.share(user.id, reelId, 'reel')
    }
  }, [user])

  const handleSave = useCallback((reelId: string) => {
    console.log('Saved memory:', reelId)
    // Track engagement event
    if (user?.id) {
      trackEvent.save(user.id, reelId, 'reel')
    }
  }, [user])

  const handleFollow = useCallback((authorId: string) => {
    console.log('Followed author:', authorId)
  }, [])

  const handleSendToMembers = useCallback(async (memberIds: string[], message: string) => {
    if (!memberIds.length) {
      toast.success('No members selected')
      return
    }
    toast.success(`Shared with ${memberIds.length} member${memberIds.length === 1 ? '' : 's'}`)
  }, [])

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
      
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Memories</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Relive your past moments on ConnectAfrik</p>
            </div>
            
            <button
              onClick={() => setShowCreateReel(true)}
              className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Create Memory</span>
            </button>
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
              <button
                onClick={() => setShowCreateReel(true)}
                className="btn-primary text-sm sm:text-base"
              >
                Create First Memory
              </button>
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

      {/* Create Reel Modal */}
      {showCreateReel && (
        <CreateReel
          onSuccess={handleCreateReelSuccess}
          onCancel={() => setShowCreateReel(false)}
        />
      )}

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
    </div>
  )
}

export default MemoriesPage

