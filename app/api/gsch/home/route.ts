import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { GSCH_MATCH_ALGORITHM_VERSION } from '@/lib/gsch/matching'
import type { GschHomeSummary } from '@/shared/types/gsch'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const [
      featuredRes,
      membershipsRes,
      verifiedRes,
      followsRes,
      opportunitiesRes,
      projectsRes,
      businessRes,
      educationRes,
      tourismRes,
      innovationRes,
      climateRes,
      eventsRes,
      analyticsOrgs,
      analyticsVerifiedOrgs,
      analyticsCities,
      analyticsPartnerships,
      analyticsEvents,
      analyticsProjects,
      analyticsOpportunities,
      analyticsPendingAgreements,
    ] = await Promise.all([
      supabase
        .from('gsch_cities')
        .select(
          `
          id, organization_id, name, country, continent, state_province,
          logo_url, cover_image_url, description, population, major_industries,
          collaboration_interests, latitude, longitude, is_published, created_at,
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
      supabase
        .from('gsch_opportunities')
        .select(
          `
          id, organization_id, city_id, title, summary, category, country,
          continent, location_label, starts_at, application_deadline,
          is_published, created_at, tags,
          organization:gsch_organizations!organization_id(
            id, name, country, logo_url, verification_status
          )
        `
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('gsch_projects')
        .select(
          `
          id, organization_id, city_id, title, description, category,
          location_label, country, continent, estimated_value_amount,
          estimated_value_currency, funding_required_amount,
          funding_required_currency, project_stage, verification_status,
          is_published, created_at,
          organization:gsch_organizations!organization_id(
            id, name, country, logo_url, verification_status
          )
        `
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('gsch_business_profiles')
        .select(
          `
          id, organization_id, display_name, tagline, description, logo_url,
          country, city, industry_sectors, seeking, offering, is_published,
          created_at,
          organization:gsch_organizations!organization_id(
            id, name, country, logo_url, verification_status, org_type
          )
        `
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('gsch_education_programs')
        .select(
          `
          id, organization_id, city_id, title, summary, program_type,
          institution_name, country, continent, location_label,
          application_deadline, is_published, created_at, tags,
          organization:gsch_organizations!organization_id(
            id, name, country, logo_url, verification_status
          )
        `
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('gsch_tourism_initiatives')
        .select(
          `
          id, organization_id, city_id, title, summary, tourism_type,
          country, continent, location_label, season_label, is_published,
          created_at, tags,
          organization:gsch_organizations!organization_id(
            id, name, country, logo_url, verification_status
          )
        `
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('gsch_innovation_challenges')
        .select(
          `
          id, organization_id, city_id, title, summary, focus_area,
          country, continent, location_label, submission_deadline, status,
          is_published, created_at, tags,
          organization:gsch_organizations!organization_id(
            id, name, country, logo_url, verification_status
          )
        `
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('gsch_climate_projects')
        .select(
          `
          id, organization_id, city_id, title, summary, climate_type,
          country, continent, location_label, seeking_partners,
          estimated_impact, is_published, created_at, tags,
          organization:gsch_organizations!organization_id(
            id, name, country, logo_url, verification_status
          )
        `
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('gsch_events')
        .select(
          `
          id, organization_id, city_id, title, summary, event_type,
          country, continent, location_label, starts_at, ends_at,
          is_published, created_at, tags,
          organization:gsch_organizations!organization_id(
            id, name, country, logo_url, verification_status
          )
        `
        )
        .eq('is_published', true)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true, nullsFirst: false })
        .limit(6),
      supabase
        .from('gsch_organizations')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('gsch_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'verified'),
      supabase
        .from('gsch_cities')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      supabase
        .from('gsch_partnerships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('gsch_events')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      supabase
        .from('gsch_projects')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      supabase
        .from('gsch_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      supabase
        .from('gsch_agreements')
        .select('id', { count: 'exact', head: true })
        .in('status', ['draft', 'submitted', 'discussion']),
    ])

    if (featuredRes.error) return errorResponse(featuredRes.error.message, 400)
    if (membershipsRes.error) return errorResponse(membershipsRes.error.message, 400)
    if (verifiedRes.error) return errorResponse(verifiedRes.error.message, 400)
    if (followsRes.error) return errorResponse(followsRes.error.message, 400)
    if (opportunitiesRes.error) {
      return errorResponse(opportunitiesRes.error.message, 400)
    }
    if (projectsRes.error) return errorResponse(projectsRes.error.message, 400)
    if (businessRes.error) return errorResponse(businessRes.error.message, 400)
    if (educationRes.error) return errorResponse(educationRes.error.message, 400)
    if (tourismRes.error) return errorResponse(tourismRes.error.message, 400)
    if (innovationRes.error) return errorResponse(innovationRes.error.message, 400)
    if (climateRes.error) return errorResponse(climateRes.error.message, 400)
    if (eventsRes.error) return errorResponse(eventsRes.error.message, 400)

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
          id, name, country, continent, state_province, logo_url, cover_image_url,
          description, population, latitude, longitude, is_published, major_industries,
          organization:gsch_organizations!organization_id(
            id, name, verification_status, verification_badge, logo_url
          )
        `
        )
        .in('id', followIds)
      if (error) return errorResponse(error.message, 400)
      myFollows = (cities || []).map((c) => ({ ...c, is_followed: true }))
    }

    // Recommended matches from managed or followed cities
    let matchSourceIds: string[] = []
    {
      const managedFilter =
        orgIds.length > 0
          ? `created_by.eq.${user.id},organization_id.in.(${orgIds.join(',')})`
          : `created_by.eq.${user.id}`
      const { data: managedCities } = await supabase
        .from('gsch_cities')
        .select('id')
        .eq('is_published', true)
        .or(managedFilter)
        .limit(5)
      matchSourceIds = (managedCities || []).map((c) => c.id)
    }
    if (matchSourceIds.length === 0 && followIds.length > 0) {
      matchSourceIds = followIds.slice(0, 3)
    }

    let recommendedMatches: GschHomeSummary['recommended_matches'] = []
    if (matchSourceIds.length > 0) {
      const { data: matches } = await supabase
        .from('gsch_match_recommendations')
        .select(
          `
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
        )
        .in('source_city_id', matchSourceIds)
        .eq('algorithm_version', GSCH_MATCH_ALGORITHM_VERSION)
        .order('compatibility_score', { ascending: false })
        .limit(6)
      recommendedMatches = (matches ||
        []) as unknown as GschHomeSummary['recommended_matches']
    }

    // Pending inbound partnership requests
    let pendingInbound = 0
    const inboundFilters: string[] = []
    if (orgIds.length > 0) {
      inboundFilters.push(`target_organization_id.in.(${orgIds.join(',')})`)
    }
    const { data: managedForInbound } = await supabase
      .from('gsch_cities')
      .select('id')
      .or(
        orgIds.length > 0
          ? `created_by.eq.${user.id},organization_id.in.(${orgIds.join(',')})`
          : `created_by.eq.${user.id}`
      )
      .limit(50)
    const managedCityIds = (managedForInbound || []).map((c) => c.id)
    if (managedCityIds.length > 0) {
      inboundFilters.push(`target_city_id.in.(${managedCityIds.join(',')})`)
    }
    if (inboundFilters.length > 0) {
      const { count } = await supabase
        .from('gsch_partnership_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .or(inboundFilters.join(','))
      pendingInbound = count || 0
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

    // Active partnerships + recommended matches → map connection arcs
    const mapConnections: GschHomeSummary['map_connections'] = []
    const connectionCityIds = new Set<string>()

    const { data: activePartnerships } = await supabase
      .from('gsch_partnerships')
      .select('id, city_a_id, city_b_id, title, partnership_type')
      .eq('status', 'active')
      .not('city_a_id', 'is', null)
      .not('city_b_id', 'is', null)
      .limit(40)

    for (const p of activePartnerships || []) {
      if (!p.city_a_id || !p.city_b_id || p.city_a_id === p.city_b_id) continue
      mapConnections.push({
        id: `partnership-${p.id}`,
        from_city_id: p.city_a_id,
        to_city_id: p.city_b_id,
        kind: 'partnership',
        label: p.title || p.partnership_type || 'Partnership',
      })
      connectionCityIds.add(p.city_a_id)
      connectionCityIds.add(p.city_b_id)
    }

    for (const match of recommendedMatches) {
      if (!match.source_city_id || !match.recommended_city_id) continue
      mapConnections.push({
        id: `match-${match.id}`,
        from_city_id: match.source_city_id,
        to_city_id: match.recommended_city_id,
        kind: 'match',
        label: 'Recommended match',
      })
      connectionCityIds.add(match.source_city_id)
      connectionCityIds.add(match.recommended_city_id)
    }

    const knownCityIds = new Set([
      ...(featuredRes.data || []).map((c: { id: string }) => c.id),
      ...myFollows.map((c: { id: string }) => c.id),
    ])
    const missingCityIds = Array.from(connectionCityIds).filter(
      (id) => !knownCityIds.has(id)
    )

    let mapCitiesExtra: GschHomeSummary['map_cities'] = []
    if (missingCityIds.length > 0) {
      const { data: extraCities } = await supabase
        .from('gsch_cities')
        .select(
          `
          id, organization_id, name, country, continent, state_province,
          logo_url, cover_image_url, description, population, major_industries,
          collaboration_interests, latitude, longitude, is_published, created_at,
          organization:gsch_organizations!organization_id(
            id, name, verification_status, verification_badge, logo_url
          )
        `
        )
        .in('id', missingCityIds)
        .eq('is_published', true)
      mapCitiesExtra = (extraCities ||
        []) as unknown as GschHomeSummary['map_cities']
    }

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
      recommended_matches: recommendedMatches,
      pending_partnership_requests: pendingInbound,
      trending_opportunities: (opportunitiesRes.data ||
        []) as unknown as GschHomeSummary['trending_opportunities'],
      featured_projects: (projectsRes.data ||
        []) as unknown as GschHomeSummary['featured_projects'],
      recent_business_profiles: (businessRes.data ||
        []) as unknown as GschHomeSummary['recent_business_profiles'],
      education_highlights: (educationRes.data ||
        []) as unknown as GschHomeSummary['education_highlights'],
      tourism_highlights: (tourismRes.data ||
        []) as unknown as GschHomeSummary['tourism_highlights'],
      innovation_highlights: (innovationRes.data ||
        []) as unknown as GschHomeSummary['innovation_highlights'],
      climate_highlights: (climateRes.data ||
        []) as unknown as GschHomeSummary['climate_highlights'],
      upcoming_events: (eventsRes.data ||
        []) as unknown as GschHomeSummary['upcoming_events'],
      map_connections: mapConnections,
      map_cities: mapCitiesExtra,
      analytics_snapshot: {
        total_organizations: analyticsOrgs.count || 0,
        verified_organizations: analyticsVerifiedOrgs.count || 0,
        verified_cities: analyticsCities.count || 0,
        active_partnerships: analyticsPartnerships.count || 0,
        investment_projects_published: analyticsProjects.count || 0,
        opportunities: analyticsOpportunities.count || 0,
        events: analyticsEvents.count || 0,
        pending_agreements: analyticsPendingAgreements.count || 0,
      },
    }

    return jsonResponse(summary)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load home', 500)
  }
}
