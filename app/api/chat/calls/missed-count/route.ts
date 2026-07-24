import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getMissedCallCount } from '@/lib/chatHeaderCounts'

/**
 * GET /api/chat/calls/missed-count
 * Optional `since` (ISO timestamp): only count missed/declined calls after that time
 * (e.g. when the user last opened the calls menu).
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') || undefined
    const serviceClient = createServiceClient()
    const missedCount = await getMissedCallCount(serviceClient, user.id, since)
    return jsonResponse({ data: { missed_count: missedCount } })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch missed call count', 500)
  }
}
