import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const from = page * limit
    const to = from + limit - 1

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
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const { data: profiles, error: profError } = await serviceClient
      .from('profiles')
      .select('id, full_name, username, avatar_url, birthday')
      .in('id', Array.from(connectedUserIds))
      .not('birthday', 'is', null)
      .order('birthday', { ascending: true })
      .range(from, to)

    if (profError) {
      return errorResponse(profError.message, 400)
    }

    const list = profiles || []
    return jsonResponse({ data: list, page, pageSize: limit, hasMore: list.length === limit })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
