export interface Reel {
  id: string
  author_id: string
  title: string
  description?: string
  video_url: string
  thumbnail_url?: string
  duration: number
  aspect_ratio: '9:16' | '16:9' | '1:1' | '4:3'
  category: ReelCategory
  tags: string[]
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  saves_count: number
  is_public: boolean
  is_featured: boolean
  is_deleted: boolean
  engagement_score: number
  created_at: string
  updated_at: string
  // Joined fields from profiles
  profiles?: {
    username: string
    full_name: string
    avatar_url?: string
  }
}

export type ReelCategory = 
  | 'entertainment' 
  | 'education' 
  | 'news' 
  | 'comedy' 
  | 'music' 
  | 'dance' 
  | 'food' 
  | 'travel' 
  | 'fashion' 
  | 'sports' 
  | 'other'

export interface ReelLike {
  id: string
  user_id: string
  reel_id: string
  created_at: string
}

export interface ReelComment {
  id: string
  reel_id: string
  author_id: string
  content: string
  parent_id?: string
  thread_depth: number
  likes_count: number
  replies_count: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  // Joined fields
  author?: {
    username: string
    full_name: string
    avatar_url?: string
  }
  replies?: ReelComment[]
}

export interface ReelCommentLike {
  id: string
  user_id: string
  comment_id: string
  created_at: string
}

export interface ReelView {
  id: string
  reel_id: string
  user_id?: string
  ip_address?: string
  user_agent?: string
  view_duration?: number
  completion_rate?: number
  created_at: string
}

export interface ReelSave {
  id: string
  user_id: string
  reel_id: string
  created_at: string
}

export interface ReelShare {
  id: string
  user_id: string
  reel_id: string
  share_type: 'copy_link' | 'social_media' | 'direct_message' | 'story'
  platform?: string
  created_at: string
}

export interface CreateReelData {
  title: string
  description?: string
  video_url: string
  thumbnail_url?: string
  duration: number
  aspect_ratio?: '9:16' | '16:9' | '1:1' | '4:3'
  category?: ReelCategory
  tags?: string[]
  is_public?: boolean
}

export interface UpdateReelData {
  title?: string
  description?: string
  thumbnail_url?: string
  category?: ReelCategory
  tags?: string[]
  is_public?: boolean
}

export interface ReelStats {
  total_reels: number
  total_views: number
  total_likes: number
  total_comments: number
  total_shares: number
  avg_engagement: number
}

export interface ReelFilters {
  category?: ReelCategory
  author_id?: string
  is_featured?: boolean
  min_duration?: number
  max_duration?: number
  tags?: string[]
  search?: string
}

export interface ReelSortOptions {
  field: 'created_at' | 'likes_count' | 'views_count' | 'engagement_score' | 'comments_count'
  order: 'asc' | 'desc'
}

export interface ReelUploadProgress {
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  message?: string
}

export interface ReelPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playbackRate: number
  isFullscreen: boolean
}

export interface ReelInteractionState {
  isLiked: boolean
  isSaved: boolean
  isFollowing: boolean
  hasViewed: boolean
}

export const REEL_CATEGORIES: { value: ReelCategory; label: string; icon: string }[] = [
  { value: 'entertainment', label: 'Entertainment', icon: '🎭' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'news', label: 'News', icon: '📰' },
  { value: 'comedy', label: 'Comedy', icon: '😂' },
  { value: 'music', label: 'Music', icon: '🎵' },
  { value: 'dance', label: 'Dance', icon: '💃' },
  { value: 'food', label: 'Food', icon: '🍽️' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'fashion', label: 'Fashion', icon: '👗' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'other', label: 'Other', icon: '🎬' }
]

export const REEL_ASPECT_RATIOS = [
  { value: '9:16', label: 'Portrait (9:16)', icon: '📱' },
  { value: '16:9', label: 'Landscape (16:9)', icon: '🖥️' },
  { value: '1:1', label: 'Square (1:1)', icon: '⬜' },
  { value: '4:3', label: 'Classic (4:3)', icon: '📺' }
]

export const MAX_REEL_DURATION = 300 // 5 minutes in seconds
export const MAX_REEL_TITLE_LENGTH = 200
export const MAX_REEL_DESCRIPTION_LENGTH = 1000
export const MAX_REEL_COMMENT_LENGTH = 500
export const MAX_REEL_TAGS = 10
