import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const parsedLimit = parseInt(searchParams.get('limit') || '20', 10)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 200)
    const from = page * limit
    const to = from + limit - 1

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({
      data: data ?? [],
      page,
      pageSize: limit,
      hasMore: (data?.length ?? 0) === limit,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to fetch notifications', 500)
  }
}
