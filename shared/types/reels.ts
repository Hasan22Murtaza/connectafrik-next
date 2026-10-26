export interface Reel {
  id: string
  author_id: string
  title: string
  description?: string
  video_url: string
  thumbnail_url?: string
  duration: number
  aspect_ratio: string
  category: string
  tags: string[]
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  saves_count: number
  reposts_count?: number
  is_public: boolean
  is_featured: boolean
  is_deleted: boolean
  engagement_score: number
  created_at: string
  updated_at: string
  is_following?: boolean
  is_saved?: boolean
  is_liked?: boolean
  is_reposted?: boolean
  is_shared?: boolean
  is_viewed?: boolean
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
  user_id: string
  author_id?: string
  content: string
  parent_id?: string
  thread_depth: number
  likes_count: number
  replies_count: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  author?: {
    username: string
    full_name: string
    avatar_url?: string
  }
  profiles?: {
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

export interface ReelRepost {
  id: string
  user_id: string
  reel_id: string
  created_at: string
}

export interface ReelShare {
  id: string
  user_id: string
  reel_id: string
  share_type: string
  platform?: string
  created_at: string
}

export interface ReelReaction {
  id: string
  user_id: string
  reel_id: string
  reaction_type: string
  created_at: string
}

export interface CreateReelData {
  title: string
  description?: string
  video_url: string
  thumbnail_url?: string
  duration: number
  aspect_ratio?: string
  category?: string
  tags?: string[]
  is_public?: boolean
}

export interface UpdateReelData {
  title?: string
  description?: string
  thumbnail_url?: string
  category?: string
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
export type ReelFeedType = 'foryou' | 'explore' | 'following' | 'mine'

export interface ReelFilters {
  category?: string
  author_id?: string
  feed?: ReelFeedType
  following_only?: boolean
  is_featured?: boolean
  min_duration?: number
  max_duration?: number
  tags?: string[]
  search?: string
  /** Author profile country (marketplace-style location filter). */
  country?: string
  lat?: number
  lng?: number
  radius_km?: number
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
  isReposted: boolean
  isFollowing: boolean
  hasViewed: boolean
}

export const REEL_CATEGORIES: { value: ReelCategory; label: string; icon: string }[] = [
  { value: 'entertainment', label: 'Entertainment', icon: 'ðŸŽ­' },
  { value: 'education', label: 'Education', icon: 'ðŸ“š' },
  { value: 'news', label: 'News', icon: 'ðŸ“°' },
  { value: 'comedy', label: 'Comedy', icon: 'ðŸ˜‚' },
  { value: 'music', label: 'Music', icon: 'ðŸŽµ' },
  { value: 'dance', label: 'Dance', icon: 'ðŸ’ƒ' },
  { value: 'food', label: 'Food', icon: 'ðŸ½ï¸' },
  { value: 'travel', label: 'Travel', icon: 'âœˆï¸' },
  { value: 'fashion', label: 'Fashion', icon: 'ðŸ‘—' },
  { value: 'sports', label: 'Sports', icon: 'âš½' },
  { value: 'other', label: 'Other', icon: 'ðŸŽ¬' }
]

export const REEL_ASPECT_RATIOS = [
  { value: '9:16', label: 'Portrait (9:16)', icon: 'ðŸ“±' },
  { value: '16:9', label: 'Landscape (16:9)', icon: 'ðŸ–¥ï¸' },
  { value: '1:1', label: 'Square (1:1)', icon: 'â¬œ' },
  { value: '4:3', label: 'Classic (4:3)', icon: 'ðŸ“º' }
]

export const MAX_REEL_DURATION = 300 // 5 minutes in seconds
export const MAX_REEL_TITLE_LENGTH = 200
export const MAX_REEL_DESCRIPTION_LENGTH = 1000
export const MAX_REEL_COMMENT_LENGTH = 500
export const MAX_REEL_TAGS = 10
