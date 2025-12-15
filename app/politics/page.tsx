'use client'

import React, { useState } from 'react'
import { TrendingUp, Users, Globe, Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePosts } from '@/shared/hooks/usePosts'
import { PostCard } from '@/features/social/components/PostCard'
import CreatePost from '@/features/social/components/CreatePost'
import toast from 'react-hot-toast'

const PoliticsPage: React.FC = () => {
  const { user } = useAuth()
  const [showCreatePost, setShowCreatePost] = useState(false)
  const { posts, loading, createPost, toggleLike, sharePost } = usePosts('politics')

  const handleCreatePost = async (postData: any) => {
    const { error } = await createPost({ ...postData, category: 'politics' })
    if (error) {
      toast.error(error)
    } else {
      toast.success('Political post created successfully!')
      setShowCreatePost(false)
    }
  }

  const handleLike = async (postId: string) => {
    if (!user) {
      toast.error('Please sign in to like posts')
      return
    }
    await toggleLike(postId)
  }

  const handleComment = (_postId: string) => {
    toast('Comment feature coming soon!')
  }

  const handleShare = async (postId: string) => {
    const result = await sharePost(postId)
    if (result.success) {
      toast.success('Post link copied to clipboard!')
    } else {
      toast.error('Failed to share post')
    }
  }

  const politicalTopics = [
    { name: 'Democracy & Governance', count: 45, trend: '+12%' },
    { name: 'Economic Development', count: 32, trend: '+8%' },
    { name: 'Youth & Politics', count: 28, trend: '+15%' },
    { name: 'Continental Integration', count: 23, trend: '+5%' },
    { name: 'Education Policy', count: 19, trend: '+7%' },
    { name: 'Healthcare Systems', count: 16, trend: '+3%' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">African Politics</h1>
              <p className="text-gray-600">
                Engaging discussions on governance, democracy, and political development across Africa
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card text-center">
              <TrendingUp className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{posts.length}</div>
              <div className="text-sm text-gray-600">Active Discussions</div>
            </div>
            <div className="card text-center">
              <Users className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">2.3k</div>
              <div className="text-sm text-gray-600">Political Enthusiasts</div>
            </div>
            <div className="card text-center">
              <Globe className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">54</div>
              <div className="text-sm text-gray-600">Countries Represented</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              {/* Trending Topics */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Trending Topics</h3>
                <div className="space-y-3">
                  {politicalTopics.map((topic, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                    >
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{topic.name}</div>
                        <div className="text-xs text-gray-500">{topic.count} discussions</div>
                      </div>
                      <div className="text-xs text-green-600 font-medium">{topic.trend}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discussion Guidelines */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Discussion Guidelines</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Respectful dialogue and debate</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Fact-based discussions</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Constructive criticism</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Personal attacks or hate speech</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Misinformation or propaganda</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Create Post Button */}
            {!showCreatePost && (
              <div className="card mb-6">
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="w-full flex items-center space-x-3 p-4 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Plus className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Share your political insights</div>
                    <span className="text-gray-500 text-sm">
                      What's your take on African politics today?
                    </span>
                  </div>
                </button>
              </div>
            )}

            {/* Create Post Form */}
            {showCreatePost && (
              <div className="mb-6">
                <CreatePost onSubmit={handleCreatePost} onCancel={() => setShowCreatePost(false)} />
              </div>
            )}

            {/* Posts Feed */}
            <div>
              {loading ? (
                <div className="space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="card animate-pulse">
                      <div className="flex space-x-3 mb-4">
                        <div className="w-10 h-10 bg-gray-300 rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-300 rounded w-1/4 mb-2" />
                          <div className="h-3 bg-gray-300 rounded w-1/3" />
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="h-4 bg-gray-300 rounded" />
                        <div className="h-4 bg-gray-300 rounded w-3/4" />
                      </div>
                      <div className="flex space-x-4">
                        <div className="h-8 bg-gray-300 rounded w-16" />
                        <div className="h-8 bg-gray-300 rounded w-16" />
                        <div className="h-8 bg-gray-300 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="card text-center py-12">
                  <TrendingUp className="w-16 h-16 text-red-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No political discussions yet</h3>
                  <p className="text-gray-600 mb-6">
                    Be the first to start a conversation about African politics!
                  </p>
                  <button onClick={() => setShowCreatePost(true)} className="btn-primary">
                    Start Political Discussion
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onLike={handleLike}
                      onComment={handleComment}
                      onShare={handleShare}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PoliticsPage

