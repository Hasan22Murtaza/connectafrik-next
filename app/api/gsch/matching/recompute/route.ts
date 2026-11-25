import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { canManageCity, writeGschAuditLog } from '@/lib/gsch/auth'
import {
  computeRecommendationsForCity,
  GSCH_MATCH_ALGORITHM_VERSION,
  type GschMatchCityInput,
} from '@/lib/gsch/matching'

const CITY_MATCH_FIELDS = `
  id, name, country, continent, logo_url, population, is_published,
  major_industries, tourism_assets, education_institutions,
  infrastructure_priorities, export_products, collaboration_interests,
  climate_objectives, renewable_energy_initiatives,
  interests:gsch_city_interests(interest_slug, interest_label)
`

const CANDIDATE_CAP = 200

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const cityId = body.city_id?.trim()
    if (!cityId) return errorResponse('city_id is required', 400)

    const limit = Math.min(
      Math.max(parseInt(String(body.limit || '20'), 10) || 20, 1),
      50
    )

    const allowed = await canManageCity(supabase, cityId, user.id)
    if (!allowed) {
      return forbiddenResponse('Only city managers or platform admins can recompute matches')
    }

    const { data: source, error: sourceErr } = await supabase
      .from('gsch_cities')
      .select(CITY_MATCH_FIELDS)
      .eq('id', cityId)
      .maybeSingle()

    if (sourceErr) return errorResponse(sourceErr.message, 400)
    if (!source) return errorResponse('Source city not found', 404)
    if (!source.is_published) {
      return errorResponse('Publish the city profile before computing matches', 400)
    }

    const { data: candidates, error: candErr } = await supabase
      .from('gsch_cities')
      .select(CITY_MATCH_FIELDS)
      .eq('is_published', true)
      .neq('id', cityId)
      .order('updated_at', { ascending: false })
      .limit(CANDIDATE_CAP)

    if (candErr) return errorResponse(candErr.message, 400)

    const sourceCity = source as unknown as GschMatchCityInput
    const results = computeRecommendationsForCity(
      sourceCity,
      (candidates || []) as unknown as GschMatchCityInput[],
      limit
    )

    const now = new Date().toISOString()
    const rows = results.map((r) => ({
      source_city_id: r.source_city_id,
      recommended_city_id: r.recommended_city_id,
      compatibility_score: r.score,
      shared_interests: r.shared_interests,
      collaboration_areas: r.collaboration_areas,
      score_breakdown: r.score_breakdown,
      explanation: r.explanation,
      algorithm_version: GSCH_MATCH_ALGORITHM_VERSION,
      computed_at: now,
    }))

    // Clear prior weighted_v1 rows for this source, then insert fresh
    const { error: delErr } = await supabase
      .from('gsch_match_recommendations')
      .delete()
      .eq('source_city_id', cityId)
      .eq('algorithm_version', GSCH_MATCH_ALGORITHM_VERSION)

    if (delErr) return errorResponse(delErr.message, 400)

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('gsch_match_recommendations')
        .upsert(rows, {
          onConflict: 'source_city_id,recommended_city_id,algorithm_version',
        })
      if (upsertErr) return errorResponse(upsertErr.message, 400)
    }

    const { data: stored, error: loadErr } = await supabase
      .from('gsch_match_recommendations')
      .select(
        `
        id, source_city_id, recommended_city_id, compatibility_score,
        shared_interests, collaboration_areas, score_breakdown, explanation,
        algorithm_version, computed_at, created_at,
        recommended_city:gsch_cities!recommended_city_id(
          id, name, country, continent, logo_url, population,
          major_industries, collaboration_interests
        )
      `
      )
      .eq('source_city_id', cityId)
      .eq('algorithm_version', GSCH_MATCH_ALGORITHM_VERSION)
      .order('compatibility_score', { ascending: false })
      .limit(limit)

    if (loadErr) return errorResponse(loadErr.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'match_recommendations_recomputed',
      entity_type: 'gsch_city',
      entity_id: cityId,
      metadata: {
        algorithm_version: GSCH_MATCH_ALGORITHM_VERSION,
        candidate_count: (candidates || []).length,
        result_count: rows.length,
      },
    })

    return jsonResponse({
      data: stored || [],
      city_id: cityId,
      page: 0,
      pageSize: limit,
      hasMore: false,
      algorithm_version: GSCH_MATCH_ALGORITHM_VERSION,
      candidates_scored: (candidates || []).length,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to recompute matches', 500)
  }
}
