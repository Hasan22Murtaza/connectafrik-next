import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { canManageCity, writeGschAuditLog } from '@/lib/gsch/auth'

type Params = { params: Promise<{ id: string }> }

const CITY_DETAIL_SELECT = `
  *,
  organization:gsch_organizations!organization_id(
    id, name, verification_status, verification_badge, logo_url
  ),
  interests:gsch_city_interests!city_id(id, city_id, interest_slug, interest_label, created_at)
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

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data, error } = await supabase
      .from('gsch_cities')
      .select(CITY_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('City not found', 404)

    const { data: follow } = await supabase
      .from('gsch_city_follows')
      .select('id')
      .eq('city_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    return jsonResponse({
      ...data,
      is_followed: Boolean(follow),
      can_manage: await canManageCity(supabase, id, user.id),
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load city', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!(await canManageCity(supabase, id, user.id))) {
      return forbiddenResponse('Not authorized to manage this city profile.')
    }

    const allowed: Record<string, unknown> = {}
    const stringFields = [
      'name',
      'country',
      'continent',
      'state_province',
      'logo_url',
      'cover_image_url',
      'description',
      'official_website',
      'mayor_name',
      'mayor_user_id',
      'economic_info',
      'investment_opportunities',
      'renewable_energy_initiatives',
      'climate_objectives',
      'organization_id',
    ] as const

    for (const key of stringFields) {
      if (body[key] !== undefined) {
        allowed[key] =
          typeof body[key] === 'string' ? body[key].trim() || null : body[key]
      }
    }

    const arrayFields = [
      'major_industries',
      'tourism_assets',
      'education_institutions',
      'infrastructure_priorities',
      'export_products',
      'collaboration_interests',
      'existing_sister_cities',
    ] as const

    for (const key of arrayFields) {
      if (body[key] !== undefined) allowed[key] = parseCsvArray(body[key])
    }

    if (body.population !== undefined) {
      allowed.population =
        body.population != null && body.population !== ''
          ? Number(body.population)
          : null
    }
    if (body.latitude !== undefined) {
      allowed.latitude =
        body.latitude != null && body.latitude !== '' ? Number(body.latitude) : null
    }
    if (body.longitude !== undefined) {
      allowed.longitude =
        body.longitude != null && body.longitude !== ''
          ? Number(body.longitude)
          : null
    }
    if (body.is_published !== undefined) {
      allowed.is_published = Boolean(body.is_published)
    }

    if (Object.keys(allowed).length === 0 && body.interests === undefined) {
      return errorResponse('No valid updates provided.', 400)
    }

    let data = null
    if (Object.keys(allowed).length > 0) {
      const result = await supabase
        .from('gsch_cities')
        .update(allowed)
        .eq('id', id)
        .select(CITY_DETAIL_SELECT)
        .single()
      if (result.error) return errorResponse(result.error.message, 400)
      data = result.data
    }

    if (Array.isArray(body.interests)) {
      await supabase.from('gsch_city_interests').delete().eq('city_id', id)
      const rows = body.interests
        .filter((i: any) => i?.interest_slug && i?.interest_label)
        .map((i: any) => ({
          city_id: id,
          interest_slug: String(i.interest_slug).trim(),
          interest_label: String(i.interest_label).trim(),
        }))
      if (rows.length > 0) {
        await supabase.from('gsch_city_interests').insert(rows)
      }
    }

    if (!data) {
      const result = await supabase
        .from('gsch_cities')
        .select(CITY_DETAIL_SELECT)
        .eq('id', id)
        .single()
      if (result.error) return errorResponse(result.error.message, 400)
      data = result.data
    }

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'city_updated',
      entity_type: 'gsch_city',
      entity_id: id,
      metadata: { fields: Object.keys(allowed) },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update city', 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params

    if (!(await canManageCity(supabase, id, user.id))) {
      return forbiddenResponse('Not authorized to delete this city.')
    }

    const { error } = await supabase.from('gsch_cities').delete().eq('id', id)
    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'city_deleted',
      entity_type: 'gsch_city',
      entity_id: id,
      metadata: { deleted: true },
    })

    return jsonResponse({ deleted: true, id })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete city', 500)
  }
}
