import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import {
  REEL_SELECT,
  REEL_SELECT_LOCATION,
  parseReelListParams,
  applyReelFilters,
  attachViewerFlags,
} from '@/lib/reels/listHelpers'

/** GET /api/reels/foryou — discovery feed sorted by engagement by default */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()

    let userId: string | null = null
    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
    } catch {
      // Anonymous access allowed
    }

    const { searchParams } = new URL(request.url)
    const params = parseReelListParams(searchParams)
    const sortField = searchParams.has('sort_field') ? params.sort_field : 'engagement_score'
    const reelSelect = params.country ? REEL_SELECT_LOCATION : REEL_SELECT

    let query = supabase
      .from('reels')
      .select(reelSelect, { count: 'exact' })
      .eq('is_deleted', false)
      .eq('is_public', true)

    query = applyReelFilters(query, params)
    query = query.order(sortField, { ascending: params.sort_order === 'asc' }).range(params.from, params.to)

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    const result = await attachViewerFlags(supabase, data ?? [], userId)

    return jsonResponse({
      data: result,
      page: params.page,
      pageSize: params.limit,
      hasMore: result.length === params.limit,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return errorResponse(err.message || 'Failed to fetch for-you reels', 500)
  }
}
