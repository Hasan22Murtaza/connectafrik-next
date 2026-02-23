import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    let viewerId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      viewerId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const isUUID = UUID_RE.test(identifier)
    let ownerId: string

    if (isUUID) {
      ownerId = identifier
    } else {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', identifier)
        .single()
      if (profileError || !profile) {
        return errorResponse('User not found', 404)
      }
      ownerId = profile.id
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', ownerId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (postsError) {
      return errorResponse(postsError.message, 400)
    }

    const posts = postsData || []

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, country')
      .eq('id', ownerId)
      .single()

    let likedPostIds = new Set<string>()
    if (viewerId && posts.length > 0) {
      const { data: likesData } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', viewerId)
        .in('post_id', posts.map((p: any) => p.id))

      if (likesData) {
        likedPostIds = new Set(likesData.map((l: any) => l.post_id))
      }
    }

    const result = posts.map((post: any) => ({
      ...post,
      author: ownerProfile || {
        id: ownerId,
        username: identifier,
        full_name: '',
        avatar_url: null,
        country: null,
      },
      isLiked: likedPostIds.has(post.id),
    }))

    return jsonResponse({ data: result })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch user posts', 500)
  }
}
