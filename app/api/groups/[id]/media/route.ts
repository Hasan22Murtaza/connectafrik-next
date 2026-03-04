import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|bmp|svg|jfif|avif)(\?|#|$)/i
const VIDEO_RE = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?|#|$)/i

function getMediaType(url: string): 'image' | 'video' | null {
  if (IMAGE_RE.test(url)) return 'image'
  if (VIDEO_RE.test(url)) return 'video'
  return null
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { supabase } = await getAuthenticatedUser(request)

    const { data: posts, error: postsError } = await supabase
      .from('group_posts')
      .select('id, title, created_at, author_id, media_urls')
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (postsError) {
      return errorResponse(postsError.message, 400)
    }

    const rows = posts || []
    const authorIds = [...new Set(rows.map((post: any) => post.author_id).filter(Boolean))]
    const { data: profiles } =
      authorIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', authorIds)
        : { data: [] as any[] }
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const mediaItems = rows.flatMap((post: any) =>
      (post.media_urls || [])
        .map((url: string, index: number) => {
          const type = getMediaType(url)
          if (!type) return null
          return {
            id: `${post.id}-${index}`,
            url,
            type,
            created_at: post.created_at,
            author: profileMap.get(post.author_id) ?? null,
          }
        })
        .filter(Boolean)
    )

    return jsonResponse({ data: mediaItems, total: mediaItems.length })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch group media', 500)
  }
}

