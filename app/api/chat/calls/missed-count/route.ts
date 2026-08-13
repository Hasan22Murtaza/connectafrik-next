import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getCallsLastViewedAt,
  getMissedCallCount,
  resolveCallsViewedSince,
} from '@/lib/chat/chatHeaderCounts'

/**
 * GET /api/chat/calls/missed-count
 * Optional `since` (ISO timestamp): only count missed/declined calls after that time
 * (e.g. when the user last opened the calls menu). Combined with the persisted
 * `profiles.calls_last_viewed_at` so the badge stays cleared across devices.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const serviceClient = createServiceClient()
    const profileSince = await getCallsLastViewedAt(serviceClient, user.id)
    const since = resolveCallsViewedSince(searchParams.get('since'), profileSince)
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
