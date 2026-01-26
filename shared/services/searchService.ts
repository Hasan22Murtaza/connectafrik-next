import { supabase } from '@/lib/supabase'

export interface SearchUser {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  follower_count: number | null
}

export interface SearchPost {
  id: string
  title: string
  content: string
  category: string
  author_id: string
  created_at: string
  likes_count: number
  comments_count: number
  author: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
  }
}

export interface SearchGroup {
  id: string
  name: string
  description: string
  category: string
  avatar_url: string | null
  member_count: number
  is_public: boolean
  created_at: string
}

export interface SearchProduct {
  id: string
  title: string
  description: string
  price: number
  currency: string
  category: string
  condition: string
  images: string[]
  views_count: number
  saves_count: number
  created_at: string
  seller_id: string
}

export interface SearchResults {
  users: SearchUser[]
  posts: SearchPost[]
  groups: SearchGroup[]
  products: SearchProduct[]
}

export interface SearchOptions {
  limit?: number
  minQueryLength?: number
}

const DEFAULT_SEARCH_LIMIT = 5
const DEFAULT_MIN_QUERY_LENGTH = 2
const SEARCH_DEBOUNCE_MS = 250

const USER_FIELDS = 'id, username, full_name, avatar_url, bio, follower_count'
const POST_FIELDS = `
  id,
  title,
  content,
  category,
  author_id,
  created_at,
  likes_count,
  comments_count,
  author:profiles!posts_author_id_fkey(
    id,
    username,
    full_name,
    avatar_url
  )
`
const GROUP_FIELDS = `
  id,
  name,
  description,
  category,
  avatar_url,
  member_count,
  is_public,
  created_at
`
const PRODUCT_FIELDS = `
  id,
  title,
  description,
  price,
  currency,
  category,
  condition,
  images,
  views_count,
  saves_count,
  created_at,
  seller_id
`

const buildUserSearchQuery = (searchTerm: string, limit: number) => {
  return supabase
    .from('profiles')
    .select(USER_FIELDS)
    .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
    .order('follower_count', { ascending: false, nullsFirst: false })
    .limit(limit)
}

const buildPostSearchQuery = (searchTerm: string, limit: number) => {
  return supabase
    .from('posts')
    .select(POST_FIELDS)
    .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit)
}

const buildGroupSearchQuery = (searchTerm: string, limit: number) => {
  return supabase
    .from('groups')
    .select(GROUP_FIELDS)
    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .eq('is_active', true)
    .order('member_count', { ascending: false })
    .limit(limit)
}

const buildProductSearchQuery = (searchTerm: string, limit: number) => {
  return supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(limit)
}

const normalizeQuery = (query: string | null | undefined, minLength: number): string | null => {
  if (!query) return null
  
  const trimmed = query.trim()
  return trimmed.length >= minLength ? trimmed : null
}

const executeQuery = async <T>(
  queryBuilder: any,
  errorContext: string
): Promise<T[]> => {
  try {
    const { data, error } = await queryBuilder
    
    if (error) {
      console.error(`[SearchService] ${errorContext}:`, error)
      return []
    }
    
    return (data || []) as T[]
  } catch (error) {
    console.error(`[SearchService] Unexpected error in ${errorContext}:`, error)
    return []
  }
}

const fetchProductSellers = async (sellerIds: string[]) => {
  if (sellerIds.length === 0) return new Map()
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', sellerIds)
    
    if (error) {
      console.error('[SearchService] Error fetching sellers:', error)
      return new Map()
    }
    
    return new Map((data || []).map(profile => [profile.id, profile]))
  } catch (error) {
    console.error('[SearchService] Unexpected error fetching sellers:', error)
    return new Map()
  }
}

export const searchService = {
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResults> {
    const { limit = DEFAULT_SEARCH_LIMIT, minQueryLength = DEFAULT_MIN_QUERY_LENGTH } = options
    const normalizedQuery = normalizeQuery(query, minQueryLength)
    
    if (!normalizedQuery) {
      return { users: [], posts: [], groups: [], products: [] }
    }

    const [users, posts, groups, productsData] = await Promise.all([
      executeQuery<SearchUser>(
        buildUserSearchQuery(normalizedQuery, limit),
        'user search'
      ),
      executeQuery<SearchPost>(
        buildPostSearchQuery(normalizedQuery, limit),
        'post search'
      ),
      executeQuery<SearchGroup>(
        buildGroupSearchQuery(normalizedQuery, limit),
        'group search'
      ),
      executeQuery<SearchProduct>(
        buildProductSearchQuery(normalizedQuery, limit),
        'product search'
      ),
    ])

    return { users, posts, groups, products: productsData }
  },

  async searchUsers(query: string, limit: number = 10): Promise<SearchUser[]> {
    const normalizedQuery = normalizeQuery(query, DEFAULT_MIN_QUERY_LENGTH)
    
    if (!normalizedQuery) {
      return []
    }

    return executeQuery(
      buildUserSearchQuery(normalizedQuery, limit),
      'user search'
    )
  },

  async searchPosts(query: string, limit: number = 10): Promise<SearchPost[]> {
    const normalizedQuery = normalizeQuery(query, DEFAULT_MIN_QUERY_LENGTH)
    
    if (!normalizedQuery) {
      return []
    }

    return executeQuery(
      buildPostSearchQuery(normalizedQuery, limit),
      'post search'
    )
  },

  async searchGroups(query: string, limit: number = 10): Promise<SearchGroup[]> {
    const normalizedQuery = normalizeQuery(query, DEFAULT_MIN_QUERY_LENGTH)
    
    if (!normalizedQuery) {
      return []
    }

    return executeQuery(
      buildGroupSearchQuery(normalizedQuery, limit),
      'group search'
    )
  },

  async searchProducts(query: string, limit: number = 10): Promise<SearchProduct[]> {
    const normalizedQuery = normalizeQuery(query, DEFAULT_MIN_QUERY_LENGTH)
    
    if (!normalizedQuery) {
      return []
    }

    return executeQuery(
      buildProductSearchQuery(normalizedQuery, limit),
      'product search'
    )
  },
}

export { DEFAULT_SEARCH_LIMIT, DEFAULT_MIN_QUERY_LENGTH, SEARCH_DEBOUNCE_MS }
