import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_TOURISM_INITIATIVE_SELECT, parseGschTags } from '@/lib/gsch/selects'
import type { GschTourismType } from '@/shared/types/gsch'

const TOURISM_TYPES: GschTourismType[] = [
  'eco',
  'cultural',
  'indigenous',
  'adventure',
  'route',
  'campaign',
  'other',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_tourism_initiatives')
      .select(GSCH_TOURISM_INITIATIVE_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Tourism initiative not found', 404)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load tourism initiative', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json()

    const { data: existing, error: loadError } = await supabase
      .from('gsch_tourism_initiatives')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Tourism initiative not found', 404)

    const authz = await requireOrgRole(
      supabase,
      existing.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title).trim()
    if (body.summary != null) patch.summary = body.summary?.trim() || null
    if (body.description != null) patch.description = body.description?.trim() || null
    if (body.tourism_type != null) {
      if (!TOURISM_TYPES.includes(body.tourism_type)) {
        return errorResponse('Invalid tourism_type', 400)
      }
      patch.tourism_type = body.tourism_type
    }
    if (body.country != null) patch.country = body.country?.trim() || null
    if (body.continent != null) patch.continent = body.continent?.trim() || null
    if (body.location_label != null) {
      patch.location_label = body.location_label?.trim() || null
    }
    if (body.season_label != null) patch.season_label = body.season_label?.trim() || null
    if (body.city_id !== undefined) patch.city_id = body.city_id || null
    if (body.partnership_needs != null) {
      patch.partnership_needs = parseGschTags(body.partnership_needs)
    }
    if (body.external_url != null) patch.external_url = body.external_url?.trim() || null
    if (body.contact_email != null) {
      patch.contact_email = body.contact_email?.trim() || null
    }
    if (body.tags != null) patch.tags = parseGschTags(body.tags)
    if (body.is_published != null) patch.is_published = Boolean(body.is_published)

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_tourism_initiatives')
      .update(patch)
      .eq('id', id)
      .select(GSCH_TOURISM_INITIATIVE_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'tourism_initiative_updated',
      entity_type: 'gsch_tourism_initiative',
      entity_id: id,
      metadata: patch,
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update tourism initiative', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { deleteGschOrgEntity } = await import('@/lib/gsch/delete-entity')
    return deleteGschOrgEntity({
      supabase,
      userId: user.id,
      id,
      table: 'gsch_tourism_initiatives',
      entityType: 'gsch_tourism_initiative',
      action: 'tourism_initiative_deleted',
      notFoundMessage: 'Tourism initiative not found',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete tourism initiative', 500)
  }
}
