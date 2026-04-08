'use client'

import { useAuth } from '@/contexts/AuthContext'
import ProductCard from '@/features/marketplace/components/ProductCard'
import { PostCard } from '@/features/social/components/PostCard'
import { trackEvent } from '@/features/social/services/engagementTracking'
import { apiClient } from '@/lib/api-client'
import { useEmojiReaction } from '@/shared/hooks/useEmojiReaction'
import { Product } from '@/shared/types'
import { Bookmark, FileText, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState, type ComponentProps } from 'react'
import toast from 'react-hot-toast'

type SavedPostRow = ComponentProps<typeof PostCard>['post']

type ReactionResponse = {
  action: 'added' | 'updated' | 'removed'
  reaction_type: string
}

interface SavedPostsListPayload {
  data: SavedPostRow[]
  page: number
  pageSize: number
  hasMore: boolean
}

const SavedPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [savedProducts, setSavedProducts] = useState<Product[]>([])
  const [savedPosts, setSavedPosts] = useState<SavedPostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'posts'>('products')

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

      if (activeTab === 'products') {
        const allProducts: Product[] = []
        let page = 0
        let hasMore = true

        while (hasMore) {
          const res = await apiClient.get<{ data: Product[]; hasMore?: boolean }>(
            '/api/marketplace/saved',
            { page, limit: 20 }
          )
          const pageProducts = res.data || []
          allProducts.push(...pageProducts)
          hasMore = Boolean(res.hasMore)
          page += 1

          if (pageProducts.length === 0) break
        }

        setSavedProducts(allProducts)
      } else {
        const allPosts: SavedPostRow[] = []
        let page = 0
        let hasMore = true

        while (hasMore) {
          const res = await apiClient.get<SavedPostsListPayload>('/api/posts/saved', {
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

  const handleUnsaveProduct = async (productId: string) => {
    try {
      await apiClient.post(`/api/marketplace/${productId}/save`)
      toast.success('Product removed from saved items')
      fetchSavedItems()
    } catch (error: unknown) {
      console.error('Error unsaving product:', error)
      toast.error('Failed to remove product')
    }
  }

  const handleViewProduct = (productId: string) => {
    router.push(`/marketplace/${productId}`)
  }

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
        title: string
        content: string
        category: 'politics' | 'culture' | 'general'
        media_urls?: string[]
        media_type?: string
        tags?: string[]
      }
    ) => {
      setSavedPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)))
    },
    []
  )

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Bookmark className="mx-auto mb-4 h-10 w-10 text-primary-600" />
          <h1 className="text-lg font-semibold text-gray-900">Sign in to view saved items</h1>
          <p className="mt-2 text-gray-600">Your saved products and posts appear here.</p>
          <button type="button" className="btn-primary mt-6" onClick={() => router.push('/')}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 sm:px-6">
        <div className="border-b border-gray-200">
          <div className="py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                  <Bookmark className="w-7 h-7 text-primary-600" />
                  <span>Saved Items</span>
                </h1>
                <p className="text-gray-600 mt-1">
                  View all your bookmarked products and posts
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'products'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-primary-600 hover:text-white bg-gray-200'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Products ({savedProducts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('posts')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'posts'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-primary-600 hover:text-white bg-gray-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Posts ({savedPosts.length})</span>
              </button>
            </div>
          </div>
        </div>

        <div className="py-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : activeTab === 'products' ? (
            savedProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {savedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSave={handleUnsaveProduct}
                    onView={handleViewProduct}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No saved products</h3>
                <p className="text-gray-500 mb-4">
                  Browse the marketplace and save products you&apos;re interested in
                </p>
                <button type="button" className="btn-primary" onClick={() => router.push('/marketplace')}>
                  Browse Marketplace
                </button>
              </div>
            )
          ) : savedPosts.length > 0 ? (
            <div className="mx-auto max-w-4xl">
              <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Saved posts</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {savedPosts.length} saved post{savedPosts.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="space-y-3">
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
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No saved posts</h3>
              <p className="text-gray-500 mb-4">
                Use the menu on any post (&middot;&middot;&middot;) and choose <strong>Save post</strong>.
              </p>
              <button type="button" className="btn-primary" onClick={() => router.push('/feed')}>
                Go to feed
              </button>
            </div>
          )}
        </div>
    </div>
  )
}

export default SavedPage
