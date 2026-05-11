import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { requireProfileAccess } from '../_shared/resolve-user-request'
import { fetchFormattedAuthorPosts, isVideoUrl } from '../_shared/media-from-posts'

const DEFAULT_POST_ROWS = 120
const MAX_POST_ROWS = 250

type ReelItem = {
  url: string
  postId: string
  content: string
  author: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    country: string | null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    const access = await requireProfileAccess(request, identifier)
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const parsed = parseInt(searchParams.get('postLimit') || String(DEFAULT_POST_ROWS), 10)
    const postRowLimit = Number.isNaN(parsed)
      ? DEFAULT_POST_ROWS
      : Math.min(Math.max(parsed, 1), MAX_POST_ROWS)

    const { supabase, viewerId, ownerId } = access.ctx
    const formatted = await fetchFormattedAuthorPosts(supabase, viewerId, ownerId, postRowLimit)

    const data: ReelItem[] = []
    for (const p of formatted) {
      const urls = Array.isArray(p.media_urls) ? (p.media_urls as string[]) : []
      const author = p.author as ReelItem['author'] | null
      if (!author?.id) continue
      for (const url of urls) {
        if (typeof url === 'string' && url.length > 0 && isVideoUrl(url)) {
          data.push({
            url,
            postId: p.id as string,
            content: (p.content as string) || '',
            author: {
              id: author.id,
              username: author.username,
              full_name: author.full_name,
              avatar_url: author.avatar_url,
              country: author.country,
            },
          })
        }
      }
    }

    return jsonResponse({ data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch reels'
    return errorResponse(message, 500)
  }
}
