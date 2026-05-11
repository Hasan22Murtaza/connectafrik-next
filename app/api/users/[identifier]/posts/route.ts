import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { requireProfileAccess } from '../_shared/resolve-user-request'
import { POST_SELECT, formatPostsForClient } from '../../../posts/format-posts-response'

/** Profile "user's posts" — larger window than the global feed. */
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    const access = await requireProfileAccess(request, identifier)
    if (!access.ok) return access.response

    const { supabase, viewerId, ownerId, profile } = access.ctx

    const { searchParams } = new URL(request.url)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const parsedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    const from = page * limit
    const to = from + limit - 1

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('author_id', ownerId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (postsError) {
      return errorResponse(postsError.message, 400)
    }

    const posts = postsData || []
    const result = await formatPostsForClient(supabase, viewerId, posts, {
      onlyAuthorId: ownerId,
    })

    const ownerAuthor = {
      id: ownerId,
      username: (profile as { username?: string }).username,
      full_name: (profile as { full_name?: string }).full_name,
      avatar_url: (profile as { avatar_url?: string | null }).avatar_url ?? null,
      country: (profile as { country?: string | null }).country ?? null,
    }

    const withAuthor = result.map((p: { author?: unknown }) => ({
      ...p,
      author: p.author || ownerAuthor,
    }))

    return jsonResponse({
      data: withAuthor,
      page,
      pageSize: limit,
      hasMore: posts.length === limit,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user posts'
    return errorResponse(message, 500)
  }
}
