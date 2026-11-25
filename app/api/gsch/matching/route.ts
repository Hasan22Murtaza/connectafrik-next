import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canManageCity } from '@/lib/gsch/auth'
import { GSCH_MATCH_ALGORITHM_VERSION } from '@/lib/gsch/matching'

const MATCH_SELECT = `
  id, source_city_id, recommended_city_id, compatibility_score,
  shared_interests, collaboration_areas, score_breakdown, explanation,
  algorithm_version, computed_at, created_at,
  source_city:gsch_cities!source_city_id(
    id, name, country, continent, logo_url, population
  ),
  recommended_city:gsch_cities!recommended_city_id(
    id, name, country, continent, logo_url, population,
    major_industries, collaboration_interests
  )
`

async function resolveDefaultCityId(
  supabase: any,
  userId: string
): Promise<string | null> {
  // Prefer a published city the user can manage
  const { data: memberships } = await supabase
    .from('gsch_memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
  const orgIds = (memberships || []).map((m: any) => m.organization_id)

  let managedQuery = supabase
    .from('gsch_cities')
    .select('id')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (orgIds.length > 0) {
    managedQuery = managedQuery.or(
      `created_by.eq.${userId},organization_id.in.(${orgIds.join(',')})`
    )
  } else {
    managedQuery = managedQuery.eq('created_by', userId)
  }

  const { data: managed } = await managedQuery.maybeSingle()
  if (managed?.id) return managed.id

  const { data: follow } = await supabase
    .from('gsch_city_follows')
    .select('city_id, city:gsch_cities!city_id(id, is_published)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  const followedPublished = (follow || []).find(
    (f: any) => f.city?.is_published && f.city_id
  )
  return followedPublished?.city_id || null
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    let cityId = searchParams.get('city_id')?.trim() || ''
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )

    if (!cityId) {
      const resolved = await resolveDefaultCityId(supabase, user.id)
      if (!resolved) {
        return jsonResponse({
          data: [],
          city_id: null,
          page: 0,
          pageSize: limit,
          hasMore: false,
          can_recompute: false,
        })
      }
      cityId = resolved
    }

    const { data, error } = await supabase
      .from('gsch_match_recommendations')
      .select(MATCH_SELECT)
      .eq('source_city_id', cityId)
      .eq('algorithm_version', GSCH_MATCH_ALGORITHM_VERSION)
      .order('compatibility_score', { ascending: false })
      .limit(limit)

    if (error) return errorResponse(error.message, 400)

    const canRecompute = await canManageCity(supabase, cityId, user.id)

    return jsonResponse({
      data: data || [],
      city_id: cityId,
      page: 0,
      pageSize: limit,
      hasMore: false,
      can_recompute: canRecompute,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load matches', 500)
  }
}
