import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: connections, error: connError } = await serviceClient
      .from('follows')
      .select('following_id, follower_id')
      .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)

    if (connError) {
      return errorResponse(connError.message, 400)
    }

    const connectedUserIds = new Set<string>()
    connections?.forEach((conn: any) => {
      if (conn.follower_id === user.id) {
        connectedUserIds.add(conn.following_id)
      } else {
        connectedUserIds.add(conn.follower_id)
      }
    })

    if (connectedUserIds.size === 0) {
      return jsonResponse({ data: [] })
    }

    const { data: profiles, error: profError } = await serviceClient
      .from('profiles')
      .select('id, full_name, username, avatar_url, birthday')
      .in('id', Array.from(connectedUserIds))
      .not('birthday', 'is', null)

    if (profError) {
      return errorResponse(profError.message, 400)
    }

    return jsonResponse({ data: profiles || [] })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
