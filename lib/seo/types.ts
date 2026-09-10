import type { Metadata } from 'next'

export type SeoRobotsDirective = 'index, follow' | 'noindex, nofollow'

export type SeoPageType =
  | 'website'
  | 'article'
  | 'profile'
  | 'group'
  | 'groupPost'
  | 'memory'
  | 'product'

export interface SeoAuthor {
  name: string
  url?: string
  image?: string | null
}

export interface SeoImage {
  url: string
  alt?: string
  width?: number
  height?: number
}

export interface BreadcrumbItem {
  name: string
  path: string
}

export interface SeoInput {
  title: string
  description: string
  path: string
  type?: SeoPageType
  keywords?: string[]
  image?: SeoImage | null
  images?: SeoImage[]
  indexable?: boolean
  author?: SeoAuthor
  publishedTime?: string
  modifiedTime?: string
  section?: string
  tags?: string[]
  breadcrumbs?: BreadcrumbItem[]
  /** Video memories / video posts */
  video?: {
    url: string
    durationSeconds?: number
    thumbnailUrl?: string
  }
}

export type BuiltMetadata = Metadata

export interface PublicPostSeo {
  id: string
  content: string
  category: string | null
  tags: string[] | null
  media_urls: string[] | null
  media_type: string | null
  created_at: string
  updated_at: string | null
  author_id: string
  author: {
    username: string | null
    full_name: string | null
    avatar_url: string | null
    post_visibility: string | null
  } | null
}

export interface PublicGroupSeo {
  id: string
  name: string
  description: string | null
  category: string | null
  tags: string[] | null
  avatar_url: string | null
  banner_url: string | null
  is_public: boolean
  is_active: boolean
  location: string | null
  created_at: string
  updated_at: string | null
}

export interface PublicGroupPostSeo {
  id: string
  group_id: string
  title: string | null
  content: string
  post_type: string | null
  media_urls: string[] | null
  created_at: string
  updated_at: string | null
  moderation_status: string | null
  is_deleted: boolean
  is_hidden: boolean | null
  author: {
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  group: PublicGroupSeo
}

export interface PublicMemorySeo {
  id: string
  title: string | null
  description: string | null
  video_url: string
  thumbnail_url: string | null
  duration: number | null
  category: string | null
  tags: string[] | null
  is_public: boolean
  created_at: string
  updated_at: string | null
  author: {
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}
