export interface User {
  id: string
  email: string
  username?: string
  full_name?: string
}

export interface Post {
  id: string
  title: string
  content: string
  category: 'politics' | 'culture' | 'general'
  author_id: string
  media_urls?: string[]
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url?: string
  country?: string
  bio?: string
  created_at: string
  updated_at: string
  // Privacy settings
  profile_visibility?: 'public' | 'followers' | 'private'
  post_visibility?: 'public' | 'followers' | 'private'
  allow_comments?: boolean
  show_online_status?: boolean
  show_country?: boolean
  show_followers_count?: boolean
  // Notification settings
  email_notifications?: boolean
  push_notifications?: boolean
  comment_notifications?: boolean
  like_notifications?: boolean
  follow_notifications?: boolean
  mention_notifications?: boolean
  post_updates?: boolean
  weekly_digest?: boolean
  // Security settings
  two_factor_enabled?: boolean
  login_alerts?: boolean
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  content: string
  parent_id?: string
  likes_count: number
  created_at: string
  updated_at: string
}

// Groups-related types
export interface Group {
  id: string
  creator_id: string
  name: string
  description: string
  category: 'politics' | 'culture' | 'education' | 'business' | 'community' | 'activism' | 'development'
  goals: string[]
  avatar_url?: string
  banner_url?: string
  member_count: number
  max_members: number
  is_public: boolean
  is_verified: boolean
  is_active: boolean
  location?: string
  country?: string
  tags: string[]
  rules: string[]
  created_at: string
  updated_at: string
  creator?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
  membership?: GroupMembership
}

export interface GroupMembership {
  id: string
  group_id: string
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  status: 'active' | 'pending' | 'banned' | 'left'
  joined_at: string
  updated_at: string
  user?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
}

export interface GroupPost {
  id: string
  group_id: string
  author_id: string
  title: string
  content: string
  post_type: 'discussion' | 'goal_update' | 'announcement' | 'event' | 'resource'
  media_urls: string[]
  likes_count: number
  comments_count: number
  is_pinned: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  author?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
}

export interface GroupEvent {
  id: string
  group_id: string
  creator_id: string
  title: string
  description: string
  event_type: 'meeting' | 'action' | 'workshop' | 'discussion' | 'social'
  start_time: string
  end_time?: string
  location?: string
  is_virtual: boolean
  max_attendees: number
  attendee_count: number
  is_public: boolean
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  creator?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
}

export interface GroupGoal {
  id: string
  group_id: string
  title: string
  description?: string
  target_date?: string
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  progress_percentage: number
  created_by: string
  created_at: string
  updated_at: string
  creator?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
}

// Marketplace types
export interface Product {
  id: string
  seller_id: string
  title: string
  description: string
  price: number
  currency: 'USD' | 'EUR' | 'GBP' | 'GHS' | 'NGN' | 'KES' | 'ZAR' | 'XOF' | 'XAF'
  category: 'fashion' | 'crafts' | 'electronics' | 'food' | 'beauty' | 'home' | 'books' | 'art' | 'jewelry' | 'services' | 'other'
  condition: 'new' | 'like-new' | 'good' | 'fair'
  location?: string
  country?: string
  images: string[]
  tags: string[]
  stock_quantity: number
  is_available: boolean
  is_featured: boolean
  views_count: number
  saves_count: number
  created_at: string
  updated_at: string
  seller?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
    bio?: string
  }
  is_saved?: boolean
  // Optional fields for reviews and ratings
  shipping_available?: boolean
  contact_phone?: string
  average_rating?: number
  reviews_count?: number
  rating_1_count?: number
  rating_2_count?: number
  rating_3_count?: number
  rating_4_count?: number
  rating_5_count?: number
}