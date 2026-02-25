import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50)
    const from = page * limit
    const to = from + limit - 1

    const { data: requests, error: reqError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at, updated_at')
      .eq('sender_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (reqError) {
      return errorResponse(reqError.message, 400)
    }

    const rows = requests || []
    const receiverIds = [...new Set(rows.map((r: any) => r.receiver_id))]

    if (receiverIds.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, country, bio, birthday, status, last_seen')
      .in('id', receiverIds)

    if (profError) {
      return errorResponse(profError.message, 400)
    }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const result = rows.map((r: any) => {
      const profile = profileMap.get(r.receiver_id)
      return {
        ...r,
        receiver: profile
          ? {
              id: profile.id,
              username: profile.username,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              country: profile.country,
              bio: profile.bio,
              birthday: profile.birthday,
              status: profile.status,
              last_seen: profile.last_seen,
            }
          : null,
      }
    })

    return jsonResponse({ data: result, page, pageSize: limit, hasMore: rows.length === limit })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to get sent friend requests', 500)
  }
}
