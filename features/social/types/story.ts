export interface Story {
  id: string
  user_id: string
  user_name: string
  user_avatar: string
  username?: string
  profile_picture_url?: string
  media_url: string | null
  media_type: 'image' | 'video' | 'text'
  text_overlay?: string | null
  background_color: string
  background_gradient?: string | null
  background_gradient_colors?: string[] | null
  caption?: string | null
  music_url?: string | null
  music_title?: string | null
  music_artist?: string | null
  is_highlight: boolean
  view_count: number
  expires_at: string
  created_at: string
  has_viewed: boolean
  reaction_count?: number
  reply_count?: number
  user_reaction?: string | null
}
