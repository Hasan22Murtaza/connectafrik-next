import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|bmp|svg|jfif|avif)(\?|#|$)/i
const VIDEO_RE = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?|#|$)/i

function getFileName(url: string): string {
  const cleanUrl = url.split('?')[0].split('#')[0]
  const fileName = cleanUrl.split('/').pop()
  return fileName && fileName.trim() ? fileName : 'file'
}

function getExtension(fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : ''
  return (ext || '').toLowerCase()
}

function isMediaUrl(url: string): boolean {
  return IMAGE_RE.test(url) || VIDEO_RE.test(url)
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

    const files = rows.flatMap((post: any) =>
      (post.media_urls || [])
        .map((url: string, index: number) => {
          if (isMediaUrl(url)) return null
          const name = getFileName(url)
          return {
            id: `${post.id}-${index}`,
            url,
            name,
            type: getExtension(name),
            created_at: post.created_at,
            post: {
              id: post.id,
              title: post.title || '',
            },
            author: profileMap.get(post.author_id) ?? null,
          }
        })
        .filter(Boolean)
    )

    return jsonResponse({ data: files, total: files.length })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch group files', 500)
  }
}

