import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    if (query.length < 2) {
      return errorResponse('Query must be at least 2 characters', 400)
    }

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, country')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .neq('id', user.id)
      .limit(limit)

    if (error) {
      return errorResponse(error.message, 400)
    }

    const results = profiles || []
    if (results.length === 0) {
      return jsonResponse({ data: [] })
    }

    const profileIds = results.map((p: any) => p.id)

    const { data: friendRows } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id, status')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .in('status', ['accepted', 'pending'])

    const friendStatusMap = new Map<string, { is_friend: boolean; has_pending_request: boolean }>()
    if (friendRows) {
      friendRows.forEach((r: any) => {
        const otherId = r.sender_id === user.id ? r.receiver_id : r.sender_id
        if (profileIds.includes(otherId)) {
          friendStatusMap.set(otherId, {
            is_friend: r.status === 'accepted',
            has_pending_request: r.status === 'pending',
          })
        }
      })
    }

    const mutualCounts: Record<string, number> = {}
    await Promise.all(
      profileIds.map(async (profileId: string) => {
        const { data: count } = await supabase.rpc('get_mutual_friends_count', {
          user1_id: user.id,
          user2_id: profileId,
        })
        mutualCounts[profileId] = count ?? 0
      })
    )

    const enriched = results.map((p: any) => ({
      ...p,
      is_friend: friendStatusMap.get(p.id)?.is_friend ?? false,
      has_pending_request: friendStatusMap.get(p.id)?.has_pending_request ?? false,
      mutual_friends_count: mutualCounts[p.id] ?? 0,
    }))

    return jsonResponse({ data: enriched })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to search users', 500)
  }
}
