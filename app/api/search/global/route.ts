import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20
const MIN_QUERY_LENGTH = 2

const USER_FIELDS = 'id, username, full_name, avatar_url, bio, follower_count'
const POST_FIELDS =
  'id, title, content, category, author_id, created_at, likes_count, comments_count, author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url)'
const GROUP_FIELDS = 'id, name, description, category, avatar_url, member_count, is_public, created_at'
const PRODUCT_FIELDS =
  'id, title, description, price, currency, category, condition, images, views_count, saves_count, created_at, seller_id'

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value || `${DEFAULT_LIMIT}`, 10)
  if (Number.isNaN(parsed)) return DEFAULT_LIMIT
  return Math.min(Math.max(parsed, 1), MAX_LIMIT)
}

async function runQuery<T>(
  promise: Promise<{ data: T[] | null; error: { message: string } | null }>,
  label: string
): Promise<T[]> {
  const { data, error } = await promise
  if (error) {
    console.error(`[GlobalSearch] ${label} query failed:`, error.message)
    return []
  }
  return data ?? []
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const limit = parseLimit(searchParams.get('limit'))

    if (q.length < MIN_QUERY_LENGTH) {
      return errorResponse(`q query param must be at least ${MIN_QUERY_LENGTH} characters`, 400)
    }

    const [users, posts, groups, products] = await Promise.all([
      runQuery(
        supabase
          .from('profiles')
          .select(USER_FIELDS)
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
          .order('follower_count', { ascending: false, nullsFirst: false })
          .limit(limit),
        'profiles'
      ),
      runQuery(
        supabase
          .from('posts')
          .select(POST_FIELDS)
          .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(limit),
        'posts'
      ),
      runQuery(
        supabase
          .from('groups')
          .select(GROUP_FIELDS)
          .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
          .eq('is_active', true)
          .order('member_count', { ascending: false })
          .limit(limit),
        'groups'
      ),
      runQuery(
        supabase
          .from('products')
          .select(PRODUCT_FIELDS)
          .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
          .eq('is_available', true)
          .order('created_at', { ascending: false })
          .limit(limit),
        'products'
      ),
    ])

    return jsonResponse({
      users,
      posts,
      groups,
      products,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to run global search', 500)
  }
}
