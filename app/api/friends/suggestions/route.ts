import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const fetchLimit = (page + 1) * limit + 1
    const from = page * limit
    const toExclusive = from + limit

    let suggestions: any[] = []

    const { data: friendRecs, error: friendErr } = await supabase.rpc('get_friend_recommendations', {
      p_user_id: user.id,
      p_limit: fetchLimit,
    })

    if (!friendErr && friendRecs && friendRecs.length > 0) {
      suggestions = friendRecs
    } else {
      const { data: generalRecs, error: generalErr } = await supabase.rpc(
        'get_general_user_recommendations',
        {
          p_user_id: user.id,
          p_limit: fetchLimit,
        }
      )
      if (!generalErr && generalRecs && generalRecs.length > 0) {
        suggestions = generalRecs
      }
    }

    const paged = suggestions.slice(from, toExclusive)
    const hasMore = suggestions.length > toExclusive
    return jsonResponse({ data: paged, page, pageSize: limit, hasMore })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to get friend suggestions', 500)
  }
}
