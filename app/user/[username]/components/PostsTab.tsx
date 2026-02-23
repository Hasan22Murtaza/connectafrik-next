'use client'

import React from 'react'
import { MessageSquare } from 'lucide-react'
import { PostCard } from '@/features/social/components/PostCard'
import CommentsSection from '@/features/social/components/CommentsSection'

interface PostWithAuthor {
  id: string; title: string; content: string
  category: 'politics' | 'culture' | 'general'
  author_id: string; created_at: string
  likes_count: number; comments_count: number; shares_count: number; views_count: number
  media_urls: string[] | null
  author: { id: string; username: string; full_name: string; avatar_url: string | null; country: string | null }
  isLiked?: boolean
}

const EmptyState = ({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) => (
  <div className="text-center py-14">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
      <Icon className="w-8 h-8 text-gray-400" />
    </div>
    <p className="text-gray-700 font-medium">{title}</p>
    <p className="text-sm text-gray-500 mt-1">{sub}</p>
  </div>
)

interface PostsTabProps {
  posts: PostWithAuthor[]
  isOwnProfile: boolean
  userId?: string
  profileId: string
  showCommentsFor: string | null
  canCommentOnPost: (authorId: string) => boolean
  canFollow: boolean
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
  onDelete?: (postId: string) => Promise<void>
  onEdit?: (postId: string, updates: { title: string; content: string; category: 'politics' | 'culture' | 'general'; media_urls?: string[]; media_type?: string; tags?: string[] }) => void
  onEmojiReaction: (postId: string, emoji: string) => void
  onCloseComments: () => void
}

const PostsTab: React.FC<PostsTabProps> = ({
  posts,
  isOwnProfile,
  userId,
  profileId,
  showCommentsFor,
  canCommentOnPost,
  canFollow,
  onLike,
  onComment,
  onShare,
  onDelete,
  onEdit,
  onEmojiReaction,
  onCloseComments,
}) => {
  if (posts.length === 0) {
    return (
      <div className="bg-white sm:rounded-lg shadow-sm">
        <EmptyState
          icon={MessageSquare}
          title="No posts yet"
          sub={isOwnProfile ? 'Share your first post from the feed.' : "This profile doesn't have any posts yet."}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-4">
      {posts.map((post) => (
        <React.Fragment key={post.id}>
          <PostCard
            post={post as Parameters<typeof PostCard>[0]['post']}
            onLike={onLike}
            onComment={onComment}
            onShare={onShare}
            onDelete={userId === profileId ? onDelete : undefined}
            onEdit={userId === profileId ? onEdit : undefined}
            onEmojiReaction={onEmojiReaction}
            isPostLiked={post.isLiked}
            canComment={canCommentOnPost(post.author_id)}
            canFollow={canFollow}
          />
          {showCommentsFor === post.id && (
            <CommentsSection
              postId={post.id}
              isOpen
              onClose={onCloseComments}
              canComment={canCommentOnPost(post.author_id)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export default PostsTab
