'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import CommentsSection from '@/features/social/components/CommentsSection'
import { usePostReactionsWithUsers } from '@/shared/hooks/usePostReactionsWithUsers'
import ReactionTooltip from '@/features/social/components/ReactionTooltip'
import Link from 'next/link'

interface Post {
  id: string
  title: string
  content: string
  category: string
  author_id: string
  created_at: string
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  media_urls: string[] | null
  author: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    country: string | null
  }
  isLiked?: boolean
}

const PostDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const postId = params?.id as string
  const { user } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const { postReactions, loading: reactionsLoading } = usePostReactionsWithUsers(postId)

  useEffect(() => {
    if (postId) {
      fetchPost()
      recordView()
    }
  }, [postId, user])

  const fetchPost = async () => {
    try {
      setLoading(true)

      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            country
          )
        `)
        .eq('id', postId)
        .eq('is_deleted', false)
        .single()

      if (postError) throw postError
      if (!postData) {
        toast.error('Post not found')
        router.push('/feed')
        return
      }

      setPost(postData)

      if (user) {
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .single()

        setIsLiked(!!likeData)
      }
    } catch (error: any) {
      console.error('Error fetching post:', error)
      toast.error('Failed to load post')
      router.push('/feed')
    } finally {
      setLoading(false)
    }
  }

  const recordView = async () => {
    if (!user || !postId) return

    try {
      await supabase.from('post_views').insert({
        post_id: postId,
        user_id: user.id,
      })
    } catch (error) {
      console.error('Error recording view:', error)
    }
  }

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like posts')
      return
    }

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)

        if (error) throw error

        setPost((prev) =>
          prev ? { ...prev, likes_count: prev.likes_count - 1 } : null
        )
        setIsLiked(false)
      } else {
        const { error } = await supabase.from('likes').insert({
          post_id: postId,
          user_id: user.id,
        })

        if (error) throw error

        setPost((prev) =>
          prev ? { ...prev, likes_count: prev.likes_count + 1 } : null
        )
        setIsLiked(true)
      }
    } catch (error: any) {
      console.error('Error toggling like:', error)
      toast.error('Failed to update like')
    }
  }

  const handleShare = async () => {
    if (!post) return

    const shareUrl = `${window.location.origin}/post/${post.id}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || 'Check out this post',
          text: post.content.substring(0, 100),
          url: shareUrl,
        })
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          navigator.clipboard.writeText(shareUrl)
          toast.success('Link copied to clipboard!')
        }
      }
    } else {
      navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard!')
    }
  }

  const handleDelete = async () => {
    if (!user || !post || post.author_id !== user.id) return

    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_deleted: true })
        .eq('id', postId)
        .eq('author_id', user.id)

      if (error) throw error

      toast.success('Post deleted')
      router.push('/feed')
    } catch (error: any) {
      console.error('Error deleting post:', error)
      toast.error('Failed to delete post')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Post not found</p>
          <button
            onClick={() => router.push('/feed')}
            className="btn-primary"
          >
            Back to Feed
          </button>
        </div>
      </div>
    )
  }

  const isAuthor = user?.id === post.author_id

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Post</h1>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Link href={`/user/${post.author.username}`}>
                    {post.author.avatar_url ? (
                      <img
                        src={post.author.avatar_url}
                        alt={post.author.full_name}
                        className="w-10 h-10 rounded-full object-cover cursor-pointer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </Link>
                  <div>
                    <Link
                      href={`/user/${post.author.username}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {post.author.full_name}
                    </Link>
                    <div className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(post.created_at), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </div>
                {isAuthor && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={handleDelete}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                        >
                          Delete Post
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {post.title && (
                <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
              )}

              <p className="text-gray-900 mb-4 whitespace-pre-wrap">
                {post.content}
              </p>

              {post.media_urls && post.media_urls.length > 0 && (
                <div className="mb-4">
                  {post.media_urls.length === 1 ? (
                    <img
                      src={post.media_urls[0]}
                      alt="Post media"
                      className="w-full rounded-lg object-cover max-h-[600px]"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {post.media_urls.slice(0, 4).map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Post media ${index + 1}`}
                          className="w-full h-48 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  {postReactions && Object.keys(postReactions).length > 0 && (
                    <ReactionTooltip reactions={postReactions} />
                  )}
                  <span className="text-sm text-gray-600">
                    {post.likes_count} likes
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{post.comments_count} comments</span>
                  <span>{post.shares_count} shares</span>
                  <span>{post.views_count} views</span>
                </div>
              </div>

              <div className="flex items-center justify-around pt-3 border-t border-gray-200 mt-3">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isLiked
                      ? 'text-[#F97316]'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  <span className="font-medium">Like</span>
                </button>
                <button
                  onClick={() => setShowComments(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="font-medium">Comment</span>
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                  <span className="font-medium">Share</span>
                </button>
              </div>
            </div>
          </div>

          {showComments && (
            <div className="mt-4">
              <CommentsSection
                postId={postId}
                isOpen={showComments}
                onClose={() => setShowComments(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PostDetailPage

