'use client'

import { useAuth } from '@/contexts/AuthContext'
import { PostCard } from '@/features/social/components/PostCard'
import { SavedReelsGrid } from '@/features/social/components/SavedReelsGrid'
import { trackEvent } from '@/features/social/services/engagementTracking'
import { apiClient } from '@/lib/api-client'
import { useEmojiReaction } from '@/shared/hooks/useEmojiReaction'
import { Reel } from '@/shared/types/reels'
import { Bookmark, Film, LayoutGrid } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import toast from 'react-hot-toast'

type SavedPostRow = ComponentProps<typeof PostCard>['post']
type SavedTab = 'posts' | 'reels'

type ReactionResponse = {
  action: 'added' | 'updated' | 'removed'
  reaction_type: string
}

interface SavedListPayload<T> {
  data: T[]
  page: number
  pageSize: number
  hasMore: boolean
}

const TABS: { id: SavedTab; label: string; icon: React.ElementType }[] = [
  { id: 'posts', label: 'Posts', icon: LayoutGrid },
  { id: 'reels', label: 'Reels', icon: Film },
]

const SavedPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [savedPosts, setSavedPosts] = useState<SavedPostRow[]>([])
  const [savedReels, setSavedReels] = useState<Reel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SavedTab>('posts')

  const updatePostLikesCount = useCallback((postId: string, delta: number) => {
    setSavedPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count + delta) } : p
      )
    )
  }, [])

  const handleEmojiReaction = useEmojiReaction({
    onLikesCountChange: updatePostLikesCount,
    trackEngagement: true,
  })

  const fetchSavedItems = useCallback(async () => {
    try {
      setLoading(true)

      if (activeTab === 'posts') {
        const allPosts: SavedPostRow[] = []
        let page = 0
        let hasMore = true

        while (hasMore) {
          const res = await apiClient.get<SavedListPayload<SavedPostRow>>('/api/posts/saved', {
            page,
            limit: 20,
          })
          const chunk = res.data || []
          allPosts.push(...chunk)
          hasMore = Boolean(res.hasMore)
          page += 1
          if (chunk.length === 0) break
        }

        setSavedPosts(allPosts)
      } else {
        const allReels: Reel[] = []
        let page = 0
        let hasMore = true

        while (hasMore) {
          const res = await apiClient.get<SavedListPayload<Reel>>('/api/memories/saved', {
            page,
            limit: 20,
          })
          const chunk = res.data || []
          allReels.push(...chunk)
          hasMore = Boolean(res.hasMore)
          page += 1
          if (chunk.length === 0) break
        }

        setSavedReels(allReels)
      }
    } catch (error: unknown) {
      console.error('Error fetching saved items:', error)
      toast.error('Failed to load saved items')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (user) {
      fetchSavedItems()
    }
  }, [user, fetchSavedItems])

  const handleSaveStateChange = useCallback((postId: string, saved: boolean) => {
    if (!saved) {
      setSavedPosts((prev) => prev.filter((p) => p.id !== postId))
    }
  }, [])

  const handleToggleLike = useCallback(
    async (postId: string) => {
      if (!user) return
      try {
        const response = await apiClient.post<ReactionResponse>(`/api/posts/${postId}/reaction`, {
          reaction_type: 'like',
        })
        setSavedPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  isLiked: response.action === 'removed' ? false : true,
                  likes_count:
                    response.action === 'added'
                      ? p.likes_count + 1
                      : response.action === 'removed'
                        ? Math.max(0, p.likes_count - 1)
                        : p.likes_count,
                }
              : p
          )
        )
        trackEvent.like(user.id, postId)
      } catch {
        toast.error('Failed to update like')
      }
    },
    [user]
  )

  const handleComment = useCallback(
    (postId: string) => {
      if (user?.id) trackEvent.comment(user.id, postId)
    },
    [user?.id]
  )

  const handleShare = useCallback(async (postId: string) => {
    try {
      const res = await apiClient.post<{ success: boolean }>(`/api/posts/${postId}/share`)
      if (res.success) {
        setSavedPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, shares_count: p.shares_count + 1 } : p))
        )
        toast.success('Shared')
      }
    } catch {
      toast.error('Failed to share')
    }
  }, [])

  const handleDeletePost = useCallback(
    async (postId: string) => {
      if (!user) return
      try {
        await apiClient.delete(`/api/posts/${postId}`)
        setSavedPosts((prev) => prev.filter((p) => p.id !== postId))
        toast.success('Post deleted')
      } catch {
        toast.error('Failed to delete post')
      }
    },
    [user]
  )

  const handleEditPost = useCallback(
    (
      postId: string,
      updates: {
        content: string
        category: 'politics' | 'culture' | 'general'
        media_urls?: string[]
        media_type?: string
        tags?: string[]
        background_id?: string | null
      }
    ) => {
      setSavedPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)))
    },
    []
  )

  const counts = useMemo(
    () => ({ posts: savedPosts.length, reels: savedReels.length }),
    [savedPosts.length, savedReels.length]
  )

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Bookmark className="h-7 w-7 text-primary-600" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Sign in to view saved items</h1>
          <p className="mt-2 text-gray-600">Your saved posts and reels appear here.</p>
          <button type="button" className="btn-primary mt-6" onClick={() => router.push('/')}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-center gap-3 pb-4 pt-6">
           
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Saved</h1>
              <p className="text-sm text-gray-500">Your bookmarked posts and reels</p>
            </div>
          </div>

          <SavedTabs activeTab={activeTab} counts={counts} onChange={setActiveTab} />
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" />
          </div>
        ) : activeTab === 'posts' ? (
          savedPosts.length > 0 ? (
            <div className="space-y-4">
              {savedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleToggleLike}
                  onComment={handleComment}
                  onShare={handleShare}
                  onDelete={user?.id === post.author_id ? handleDeletePost : undefined}
                  onEdit={user?.id === post.author_id ? handleEditPost : undefined}
                  onEmojiReaction={handleEmojiReaction}
                  isPostLiked={post.isLiked}
                  canComment={post.canComment}
                  canFollow={post.canFollow}
                  disablePostClick={false}
                  onSaveStateChange={handleSaveStateChange}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={LayoutGrid}
              title="No saved posts"
              description="Use the menu on any post (···) and choose Save post."
              ctaLabel="Go to feed"
              onCta={() => router.push('/feed')}
            />
          )
        ) : savedReels.length > 0 ? (
          <SavedReelsGrid
            reels={savedReels}
            onReelDeleted={(id) => setSavedReels((prev) => prev.filter((r) => r.id !== id))}
          />
        ) : (
          <EmptyState
            icon={Film}
            title="No saved reels"
            description="Tap the save icon on any reel to keep it here for later."
            ctaLabel="Explore reels"
            onCta={() => router.push('/memories')}
          />
        )}
      </div>
    </div>
  )
}

const SavedTabs: React.FC<{
  activeTab: SavedTab
  counts: Record<SavedTab, number>
  onChange: (tab: SavedTab) => void
}> = ({ activeTab, counts, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  useEffect(() => {
    const btn = tabRefs.current[activeTab]
    const container = containerRef.current
    if (btn && container) {
      const btnRect = btn.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setIndicator({ left: btnRect.left - containerRect.left, width: btnRect.width })
    }
  }, [activeTab, counts])

  return (
    <div ref={containerRef} className="relative flex gap-1 pb-px">
      <span
        className="absolute bottom-0 h-0.5 rounded-full bg-primary-600 transition-all duration-300 ease-out"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el
            }}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${
              isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${
                isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {counts[tab.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const EmptyState: React.FC<{
  icon: React.ElementType
  title: string
  description: string
  ctaLabel: string
  onCta: () => void
}> = ({ icon: Icon, title, description, ctaLabel, onCta }) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
      <Icon className="h-8 w-8 text-gray-400" />
    </div>
    <h3 className="mb-1 text-lg font-semibold text-gray-900">{title}</h3>
    <p className="mb-5 max-w-xs text-sm text-gray-500">{description}</p>
    <button type="button" className="btn-primary" onClick={onCta}>
      {ctaLabel}
    </button>
  </div>
)

export default SavedPage
