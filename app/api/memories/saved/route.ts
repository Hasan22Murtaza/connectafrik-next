import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const REEL_SELECT = `
  *,
  profiles:profiles!reels_author_id_fkey(username, full_name, avatar_url)
`

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50)
    const from = page * limit
    const to = from + limit - 1

    const { data: savesData, error: savesError } = await supabase
      .from('reel_saves')
      .select('reel_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (savesError) throw savesError

    if (!savesData || savesData.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const orderedIds = savesData.map((s) => s.reel_id as string)

    const { data: reelsData, error: reelsError } = await supabase
      .from('reels')
      .select(REEL_SELECT)
      .in('id', orderedIds)
      .eq('is_deleted', false)

    if (reelsError) throw reelsError

    const byId = new Map((reelsData || []).map((r: any) => [r.id, r]))
    const orderedReels = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((reel: any) => ({ ...reel, is_saved: true }))

    return jsonResponse({
      data: orderedReels,
      page,
      pageSize: limit,
      hasMore: savesData.length === limit,
    })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('GET /api/memories/saved error:', err)
    return errorResponse(err.message || 'Failed to fetch saved reels', 500)
  }
}
