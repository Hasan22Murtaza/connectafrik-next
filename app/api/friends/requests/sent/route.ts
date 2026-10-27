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
      .select('id, username, full_name, avatar_url, banner_image, country, bio, birthday, status, last_seen')
      .in('id', receiverIds)

    if (profError) {
      return errorResponse(profError.message, 400)
    }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const mutualCounts: Record<string, number> = {}
    const mutualFriendsById = new Map<
      string,
      Array<{ user_id: string; username: string; full_name: string; avatar_url: string | null }>
    >()

    await Promise.all(
      receiverIds.map(async (receiverId) => {
        const { data: count } = await supabase.rpc('get_mutual_friends_count', {
          user1_id: user.id,
          user2_id: receiverId,
        })
        const mutualCount = Number(count ?? 0)
        mutualCounts[receiverId] = mutualCount

        if (mutualCount <= 0) {
          mutualFriendsById.set(receiverId, [])
          return
        }

        const { data: mutuals } = await supabase.rpc('get_mutual_friends', {
          user1_id: user.id,
          user2_id: receiverId,
          limit_count: 3,
        })

        mutualFriendsById.set(
          receiverId,
          (mutuals || []).slice(0, 3).map((m: any) => ({
            user_id: m.user_id,
            username: m.username,
            full_name: m.full_name,
            avatar_url: m.avatar_url ?? null,
          }))
        )
      })
    )

    const result = rows.map((r: any) => {
      const profile = profileMap.get(r.receiver_id)
      const mutualFriends = mutualFriendsById.get(r.receiver_id) ?? []
      const mutualFriendsCount = mutualCounts[r.receiver_id] ?? 0
      return {
        ...r,
        receiver: profile
          ? {
              id: profile.id,
              username: profile.username,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              banner_image: profile.banner_image ?? null,
              country: profile.country,
              bio: profile.bio,
              birthday: profile.birthday,
              status: profile.status,
              last_seen: profile.last_seen,
            }
          : null,
        mutualFriendsCount,
        mutual_friends_count: mutualFriendsCount,
        mutual_friends: mutualFriends,
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
