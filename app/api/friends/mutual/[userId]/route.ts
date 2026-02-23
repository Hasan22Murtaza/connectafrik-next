import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '6', 10), 50)

    const [{ data: countData }, { data: listData }] = await Promise.all([
      supabase.rpc('get_mutual_friends_count', {
        user1_id: user.id,
        user2_id: userId,
      }),
      supabase.rpc('get_mutual_friends', {
        user1_id: user.id,
        user2_id: userId,
        limit_count: limit,
      }),
    ])

    return jsonResponse({
      count: countData ?? 0,
      data: listData || [],
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to get mutual friends', 500)
  }
}
