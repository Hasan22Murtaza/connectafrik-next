import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { getOrgMembership } from '@/lib/gsch/auth'
import type { GschAnalyticsSnapshot } from '@/shared/types/gsch'

async function countExact(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase'],
  table: string,
  apply?: (q: any) => any
): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count || 0
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')?.trim() || ''

    const [
      totalOrgs,
      verifiedOrgs,
      verifiedCities,
      activePartnerships,
      investmentProjects,
      businessProfiles,
      educationPrograms,
      tourismInitiatives,
      innovationChallenges,
      climateProjects,
      opportunities,
      events,
    ] = await Promise.all([
      countExact(supabase, 'gsch_organizations'),
      countExact(supabase, 'gsch_organizations', (q) =>
        q.eq('verification_status', 'verified')
      ),
      countExact(supabase, 'gsch_cities', (q) =>
        q.eq('is_published', true)
      ),
      countExact(supabase, 'gsch_partnerships', (q) => q.eq('status', 'active')),
      countExact(supabase, 'gsch_projects', (q) => q.eq('is_published', true)),
      countExact(supabase, 'gsch_business_profiles', (q) =>
        q.eq('is_published', true)
      ),
      countExact(supabase, 'gsch_education_programs', (q) =>
        q.eq('is_published', true)
      ),
      countExact(supabase, 'gsch_tourism_initiatives', (q) =>
        q.eq('is_published', true)
      ),
      countExact(supabase, 'gsch_innovation_challenges', (q) =>
        q.eq('is_published', true)
      ),
      countExact(supabase, 'gsch_climate_projects', (q) =>
        q.eq('is_published', true)
      ),
      countExact(supabase, 'gsch_opportunities', (q) =>
        q.eq('is_published', true)
      ),
      countExact(supabase, 'gsch_events', (q) => q.eq('is_published', true)),
    ])

    // Distinct countries from published cities + organizations
    const [{ data: cityCountries }, { data: orgCountries }] = await Promise.all([
      supabase.from('gsch_cities').select('country').eq('is_published', true),
      supabase
        .from('gsch_organizations')
        .select('country')
        .eq('verification_status', 'verified'),
    ])
    const countries = new Set<string>()
    for (const row of [...(cityCountries || []), ...(orgCountries || [])]) {
      const c = String(row.country || '').trim()
      if (c) countries.add(c.toLowerCase())
    }

    const { data: agreementRows, error: agrError } = await supabase
      .from('gsch_agreements')
      .select('status')
    if (agrError) return errorResponse(agrError.message, 400)

    const agreements_by_status: Record<string, number> = {}
    for (const row of agreementRows || []) {
      const s = row.status || 'unknown'
      agreements_by_status[s] = (agreements_by_status[s] || 0) + 1
    }

    const snapshot: GschAnalyticsSnapshot = {
      total_organizations: totalOrgs,
      verified_organizations: verifiedOrgs,
      verified_cities: verifiedCities,
      countries_represented: countries.size,
      active_partnerships: activePartnerships,
      investment_projects_published: investmentProjects,
      business_profiles_published: businessProfiles,
      education_programs: educationPrograms,
      tourism_initiatives: tourismInitiatives,
      innovation_challenges: innovationChallenges,
      climate_projects: climateProjects,
      opportunities,
      events,
      agreements_by_status,
      my_org: null,
    }

    if (orgId) {
      const membership = await getOrgMembership(supabase, orgId, user.id)
      if (!membership) {
        return forbiddenResponse('Not a member of this organization')
      }
      const [publishedEvents, agreements, partnerships, orgOpps] =
        await Promise.all([
          countExact(supabase, 'gsch_events', (q) =>
            q.eq('organization_id', orgId).eq('is_published', true)
          ),
          countExact(supabase, 'gsch_agreements', (q) =>
            q.or(
              `organization_a_id.eq.${orgId},organization_b_id.eq.${orgId}`
            )
          ),
          countExact(supabase, 'gsch_partnerships', (q) =>
            q
              .or(
                `organization_a_id.eq.${orgId},organization_b_id.eq.${orgId}`
              )
              .eq('status', 'active')
          ),
          countExact(supabase, 'gsch_opportunities', (q) =>
            q.eq('organization_id', orgId).eq('is_published', true)
          ),
        ])
      snapshot.my_org = {
        organization_id: orgId,
        published_events: publishedEvents,
        agreements,
        partnerships,
        opportunities: orgOpps,
      }
    }

    return jsonResponse(snapshot)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load analytics', 500)
  }
}
