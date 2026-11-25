import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import type { GschOpportunityCategory } from '@/shared/types/gsch'

const CATEGORIES: GschOpportunityCategory[] = [
  'investment',
  'grant',
  'conference',
  'trade_mission',
  'development_funding',
  'innovation_challenge',
  'sister_city',
  'education_program',
  'other',
]

const OPP_SELECT = `
  id, organization_id, city_id, title, summary, description, category,
  country, continent, location_label, starts_at, ends_at,
  application_deadline, external_url, contact_email, tags,
  is_published, created_by, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status
  ),
  city:gsch_cities!city_id(id, name, country, logo_url)
`

function parseTags(value: unknown): string[] {
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
    const category = searchParams.get('category')?.trim() || ''
    const country = searchParams.get('country')?.trim() || ''
    const continent = searchParams.get('continent')?.trim() || ''
    const mine = searchParams.get('mine') === '1'
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('gsch_opportunities')
      .select(OPP_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (mine) {
      const { data: memberships } = await supabase
        .from('gsch_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      const orgIds = (memberships || []).map((m) => m.organization_id)
      if (orgIds.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      query = query.in('organization_id', orgIds)
    } else {
      query = query.eq('is_published', true)
    }

    if (category) query = query.eq('category', category)
    if (country) query = query.ilike('country', `%${country}%`)
    if (continent) query = query.ilike('continent', `%${continent}%`)
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,summary.ilike.%${q}%,description.ilike.%${q}%,location_label.ilike.%${q}%`
      )
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    return jsonResponse({
      data: data || [],
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load opportunities', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.organization_id) return errorResponse('organization_id is required', 400)
    if (!body.title?.trim()) return errorResponse('title is required', 400)
    if (!CATEGORIES.includes(body.category)) {
      return errorResponse('Invalid category', 400)
    }

    const authz = await requireOrgRole(
      supabase,
      body.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data, error } = await supabase
      .from('gsch_opportunities')
      .insert({
        organization_id: body.organization_id,
        city_id: body.city_id || null,
        title: String(body.title).trim(),
        summary: body.summary?.trim() || null,
        description: body.description?.trim() || null,
        category: body.category,
        country: body.country?.trim() || null,
        continent: body.continent?.trim() || null,
        location_label: body.location_label?.trim() || null,
        starts_at: body.starts_at || null,
        ends_at: body.ends_at || null,
        application_deadline: body.application_deadline || null,
        external_url: body.external_url?.trim() || null,
        contact_email: body.contact_email?.trim() || null,
        tags: parseTags(body.tags),
        is_published: Boolean(body.is_published),
        created_by: user.id,
      })
      .select(OPP_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'opportunity_created',
      entity_type: 'gsch_opportunity',
      entity_id: data.id,
      metadata: {
        title: data.title,
        is_published: data.is_published,
        category: data.category,
      },
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create opportunity', 500)
  }
}
