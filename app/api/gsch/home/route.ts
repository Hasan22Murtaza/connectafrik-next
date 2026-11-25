import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import type { GschHomeSummary } from '@/shared/types/gsch'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const [
      featuredRes,
      membershipsRes,
      verifiedRes,
      followsRes,
    ] = await Promise.all([
      supabase
        .from('gsch_cities')
        .select(
          `
          id, organization_id, name, country, continent, state_province,
          logo_url, cover_image_url, description, population, major_industries,
          collaboration_interests, is_published, created_at,
          organization:gsch_organizations!organization_id(
            id, name, verification_status, verification_badge, logo_url
          )
        `
        )
        .eq('is_published', true)
        .order('population', { ascending: false, nullsFirst: false })
        .limit(8),
      supabase
        .from('gsch_memberships')
        .select('organization_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase
        .from('gsch_organizations')
        .select(
          'id, name, org_type, country, city, logo_url, verification_status, verification_badge, created_at'
        )
        .eq('verification_status', 'verified')
        .order('verified_at', { ascending: false, nullsFirst: false })
        .limit(6),
      supabase
        .from('gsch_city_follows')
        .select('city_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12),
    ])

    if (featuredRes.error) return errorResponse(featuredRes.error.message, 400)
    if (membershipsRes.error) return errorResponse(membershipsRes.error.message, 400)
    if (verifiedRes.error) return errorResponse(verifiedRes.error.message, 400)
    if (followsRes.error) return errorResponse(followsRes.error.message, 400)

    const memberships = membershipsRes.data || []
    const orgIds = memberships.map((m) => m.organization_id)
    let myOrganizations: any[] = []
    if (orgIds.length > 0) {
      const { data: orgs, error } = await supabase
        .from('gsch_organizations')
        .select('*')
        .in('id', orgIds)
        .order('created_at', { ascending: false })
      if (error) return errorResponse(error.message, 400)
      const roleByOrg = new Map(memberships.map((m) => [m.organization_id, m.role]))
      myOrganizations = (orgs || []).map((org) => ({
        ...org,
        my_role: roleByOrg.get(org.id) || null,
      }))
    }

    const followIds = (followsRes.data || []).map((f) => f.city_id)
    let myFollows: any[] = []
    if (followIds.length > 0) {
      const { data: cities, error } = await supabase
        .from('gsch_cities')
        .select(
          `
          id, name, country, continent, logo_url, cover_image_url, description,
          population, is_published, major_industries,
          organization:gsch_organizations!organization_id(
            id, name, verification_status, verification_badge, logo_url
          )
        `
        )
        .in('id', followIds)
      if (error) return errorResponse(error.message, 400)
      myFollows = (cities || []).map((c) => ({ ...c, is_followed: true }))
    }

    const draftOrg =
      myOrganizations.find((o) =>
        ['draft', 'additional_info_required', 'rejected'].includes(o.verification_status)
      ) || null
    const pendingCount = myOrganizations.filter((o) =>
      ['submitted', 'under_review', 'additional_info_required'].includes(
        o.verification_status
      )
    ).length

    const summary: GschHomeSummary = {
      featured_cities: (featuredRes.data || []) as unknown as GschHomeSummary['featured_cities'],
      my_organizations: myOrganizations as unknown as GschHomeSummary['my_organizations'],
      recent_verified_orgs: (verifiedRes.data ||
        []) as unknown as GschHomeSummary['recent_verified_orgs'],
      my_follows: myFollows as unknown as GschHomeSummary['my_follows'],
      verification_cta: {
        needs_org: myOrganizations.length === 0,
        needs_verification: Boolean(
          draftOrg ||
            myOrganizations.some((o) => o.verification_status === 'draft')
        ),
        pending_count: pendingCount,
        draft_org_id: draftOrg?.id || null,
      },
    }

    return jsonResponse(summary)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load home', 500)
  }
}
