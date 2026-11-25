import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'

const CITY_LIST_SELECT = `
  id, organization_id, name, country, continent, state_province,
  logo_url, cover_image_url, description, population, official_website,
  mayor_name, major_industries, collaboration_interests, existing_sister_cities,
  latitude, longitude, is_published, created_by, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, verification_status, verification_badge, logo_url
  )
`

function parseCsvArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q')?.trim() || ''
    const country = searchParams.get('country')?.trim() || ''
    const continent = searchParams.get('continent')?.trim() || ''
    const industry = searchParams.get('industry')?.trim() || ''
    const saved = searchParams.get('saved') === '1' || searchParams.get('saved') === 'true'
    const mine = searchParams.get('mine') === '1'
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase.from('gsch_cities').select(CITY_LIST_SELECT).range(from, to)

    if (saved) {
      const { data: follows } = await supabase
        .from('gsch_city_follows')
        .select('city_id')
        .eq('user_id', user.id)
      const ids = (follows || []).map((f) => f.city_id)
      if (ids.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      query = query.in('id', ids)
    } else if (mine) {
      const { data: memberships } = await supabase
        .from('gsch_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      const orgIds = (memberships || []).map((m) => m.organization_id)
      query = query.or(
        orgIds.length > 0
          ? `created_by.eq.${user.id},organization_id.in.(${orgIds.join(',')})`
          : `created_by.eq.${user.id}`
      )
    } else {
      query = query.eq('is_published', true)
    }

    if (country) query = query.ilike('country', `%${country}%`)
    if (continent) query = query.ilike('continent', `%${continent}%`)
    if (industry) query = query.contains('major_industries', [industry])
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,description.ilike.%${q}%,country.ilike.%${q}%,state_province.ilike.%${q}%`
      )
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    const items = data || []
    const cityIds = items.map((c: any) => c.id)
    let followed = new Set<string>()
    if (cityIds.length > 0) {
      const { data: follows } = await supabase
        .from('gsch_city_follows')
        .select('city_id')
        .eq('user_id', user.id)
        .in('city_id', cityIds)
      followed = new Set((follows || []).map((f) => f.city_id))
    }

    const enriched = items.map((c: any) => ({
      ...c,
      is_followed: followed.has(c.id),
    }))

    return jsonResponse({
      data: enriched,
      page,
      pageSize: limit,
      hasMore: items.length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load cities', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.name?.trim()) return errorResponse('name is required', 400)
    if (!body.country?.trim()) return errorResponse('country is required', 400)

    const organizationId = body.organization_id || null
    if (organizationId) {
      const authz = await requireOrgRole(
        supabase,
        organizationId,
        user.id,
        'representative'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
    }

    const { data, error } = await supabase
      .from('gsch_cities')
      .insert({
        organization_id: organizationId,
        name: String(body.name).trim(),
        country: String(body.country).trim(),
        continent: body.continent?.trim() || null,
        state_province: body.state_province?.trim() || null,
        logo_url: body.logo_url || null,
        cover_image_url: body.cover_image_url || null,
        description: body.description?.trim() || null,
        population:
          body.population != null && body.population !== ''
            ? Number(body.population)
            : null,
        official_website: body.official_website?.trim() || null,
        mayor_name: body.mayor_name?.trim() || null,
        mayor_user_id: body.mayor_user_id || null,
        economic_info: body.economic_info?.trim() || null,
        major_industries: parseCsvArray(body.major_industries),
        tourism_assets: parseCsvArray(body.tourism_assets),
        education_institutions: parseCsvArray(body.education_institutions),
        infrastructure_priorities: parseCsvArray(body.infrastructure_priorities),
        investment_opportunities: body.investment_opportunities?.trim() || null,
        renewable_energy_initiatives: body.renewable_energy_initiatives?.trim() || null,
        climate_objectives: body.climate_objectives?.trim() || null,
        export_products: parseCsvArray(body.export_products),
        collaboration_interests: parseCsvArray(body.collaboration_interests),
        existing_sister_cities: parseCsvArray(body.existing_sister_cities),
        latitude: body.latitude != null && body.latitude !== '' ? Number(body.latitude) : null,
        longitude:
          body.longitude != null && body.longitude !== '' ? Number(body.longitude) : null,
        is_published: Boolean(body.is_published),
        created_by: user.id,
      })
      .select(CITY_LIST_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    const interests = Array.isArray(body.interests) ? body.interests : []
    if (interests.length > 0) {
      await supabase.from('gsch_city_interests').insert(
        interests
          .filter((i: any) => i?.interest_slug && i?.interest_label)
          .map((i: any) => ({
            city_id: data.id,
            interest_slug: String(i.interest_slug).trim(),
            interest_label: String(i.interest_label).trim(),
          }))
      )
    }

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'city_created',
      entity_type: 'gsch_city',
      entity_id: data.id,
      metadata: { name: data.name, organization_id: organizationId },
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create city', 500)
  }
}
