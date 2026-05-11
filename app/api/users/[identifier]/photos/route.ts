import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { requireProfileAccess } from '../_shared/resolve-user-request'
import { fetchFormattedAuthorPosts } from '../_shared/media-from-posts'

const DEFAULT_POST_ROWS = 120
const MAX_POST_ROWS = 250
const DEFAULT_ITEM_LIMIT = 200
const MAX_ITEM_LIMIT = 500

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    const access = await requireProfileAccess(request, identifier)
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const parsedRows = parseInt(searchParams.get('postLimit') || String(DEFAULT_POST_ROWS), 10)
    const postRowLimit = Number.isNaN(parsedRows)
      ? DEFAULT_POST_ROWS
      : Math.min(Math.max(parsedRows, 1), MAX_POST_ROWS)

    const parsedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_ITEM_LIMIT), 10)
    const itemLimit = Number.isNaN(parsedLimit)
      ? DEFAULT_ITEM_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_ITEM_LIMIT)

    const { supabase, viewerId, ownerId } = access.ctx
    const formatted = await fetchFormattedAuthorPosts(supabase, viewerId, ownerId, postRowLimit)

    const data: { url: string; postId: string }[] = []
    outer: for (const p of formatted) {
      const urls = Array.isArray(p.media_urls) ? (p.media_urls as string[]) : []
      for (const url of urls) {
        if (typeof url === 'string' && url.length > 0) {
          data.push({ url, postId: p.id as string })
          if (data.length >= itemLimit) break outer
        }
      }
    }

    return jsonResponse({ data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch photos'
    return errorResponse(message, 500)
  }
}
