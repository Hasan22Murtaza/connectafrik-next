import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { POST_SELECT, formatPostsForClient } from '../format-posts-response'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50)
    const from = page * limit
    const to = from + limit - 1

    const { data: savesData, error: savesError } = await supabase
      .from('post_saves')
      .select('post_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (savesError) throw savesError

    if (!savesData || savesData.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const orderedIds = savesData.map((s) => s.post_id as string)

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .in('id', orderedIds)
      .eq('is_deleted', false)

    if (postsError) throw postsError

    const byId = new Map((postsData || []).map((p: any) => [p.id, p]))
    const orderedPosts = orderedIds.map((id) => byId.get(id)).filter(Boolean) as any[]

    const result = await formatPostsForClient(supabase, user.id, orderedPosts, { markAllSaved: true })

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: savesData.length === limit,
    })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('GET /api/posts/saved error:', err)
    return errorResponse(err.message || 'Failed to fetch saved posts', 500)
  }
}
