import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50

    let suggestions: any[] = []

    const { data: friendRecs, error: friendErr } = await supabase.rpc('get_friend_recommendations', {
      p_user_id: user.id,
      p_limit: limit,
    })

    if (!friendErr && friendRecs && friendRecs.length > 0) {
      suggestions = friendRecs
    } else {
      const { data: generalRecs, error: generalErr } = await supabase.rpc(
        'get_general_user_recommendations',
        {
          p_user_id: user.id,
          p_limit: limit,
        }
      )
      if (!generalErr && generalRecs && generalRecs.length > 0) {
        suggestions = generalRecs
      }
    }

    return jsonResponse({ data: suggestions })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to get friend suggestions', 500)
  }
}
