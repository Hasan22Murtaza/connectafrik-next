import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_INNOVATION_CHALLENGE_SELECT, parseGschTags } from '@/lib/gsch/selects'
import type {
  GschInnovationChallengeStatus,
  GschInnovationFocusArea,
} from '@/shared/types/gsch'

const FOCUS_AREAS: GschInnovationFocusArea[] = [
  'ai_transportation',
  'smart_traffic',
  'smart_parking',
  'digital_twins',
  'public_safety',
  'water_management',
  'urban_infrastructure',
  'cybersecurity',
  'other',
]

const STATUSES: GschInnovationChallengeStatus[] = [
  'draft',
  'open',
  'closed',
  'awarded',
]

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q')?.trim() || ''
    const type = searchParams.get('type')?.trim() || ''
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
      .from('gsch_innovation_challenges')
      .select(GSCH_INNOVATION_CHALLENGE_SELECT)
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

    if (type) query = query.eq('focus_area', type)
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
    return errorResponse(error?.message || 'Failed to load innovation challenges', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.organization_id) return errorResponse('organization_id is required', 400)
    if (!body.title?.trim()) return errorResponse('title is required', 400)
    if (!FOCUS_AREAS.includes(body.focus_area)) {
      return errorResponse('Invalid focus_area', 400)
    }

    const status: GschInnovationChallengeStatus = STATUSES.includes(body.status)
      ? body.status
      : 'open'

    const authz = await requireOrgRole(
      supabase,
      body.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data, error } = await supabase
      .from('gsch_innovation_challenges')
      .insert({
        organization_id: body.organization_id,
        city_id: body.city_id || null,
        title: String(body.title).trim(),
        summary: body.summary?.trim() || null,
        description: body.description?.trim() || null,
        focus_area: body.focus_area,
        country: body.country?.trim() || null,
        continent: body.continent?.trim() || null,
        location_label: body.location_label?.trim() || null,
        prize_or_benefit: body.prize_or_benefit?.trim() || null,
        submission_deadline: body.submission_deadline || null,
        external_url: body.external_url?.trim() || null,
        contact_email: body.contact_email?.trim() || null,
        tags: parseGschTags(body.tags),
        status,
        is_published: Boolean(body.is_published),
        created_by: user.id,
      })
      .select(GSCH_INNOVATION_CHALLENGE_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'innovation_challenge_created',
      entity_type: 'gsch_innovation_challenge',
      entity_id: data.id,
      metadata: {
        title: data.title,
        is_published: data.is_published,
        focus_area: data.focus_area,
      },
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create innovation challenge', 500)
  }
}
