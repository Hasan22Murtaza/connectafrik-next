import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  REEL_SELECT,
  REEL_SELECT_LOCATION,
  parseReelListParams,
  applyReelFilters,
  attachViewerFlags,
  authorIdsMatchingCountry,
  emptyReelPage,
} from '@/lib/reels/listHelpers'

/** GET /api/reels/following — reels from creators the viewer follows */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = parseReelListParams(searchParams)

    let userId: string
    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
    } catch {
      return emptyReelPage(params.page, params.limit)
    }

    const supabase = createServiceClient()
    const reelSelect = params.country ? REEL_SELECT_LOCATION : REEL_SELECT

    const { data: followsRows, error: followsErr } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    if (followsErr) return errorResponse(followsErr.message, 400)

    let followingIds = [
      ...new Set((followsRows ?? []).map((r: { following_id: string }) => r.following_id)),
    ]

    if (followingIds.length === 0) {
      return emptyReelPage(params.page, params.limit)
    }

    if (params.country) {
      const matched = await authorIdsMatchingCountry(supabase, followingIds, params.country)
      if (matched.error) return errorResponse(matched.error, 400)
      followingIds = matched.ids
      if (followingIds.length === 0) {
        return emptyReelPage(params.page, params.limit)
      }
    }

    let query = supabase
      .from('reels')
      .select(reelSelect, { count: 'exact' })
      .eq('is_deleted', false)
      .eq('is_public', true)
      .in('author_id', followingIds)

    query = applyReelFilters(query, params)
    query = query
      .order(params.sort_field, { ascending: params.sort_order === 'asc' })
      .range(params.from, params.to)

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
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch following reels', 500)
  }
}
