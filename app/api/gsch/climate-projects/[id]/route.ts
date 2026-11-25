import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_CLIMATE_PROJECT_SELECT, parseGschTags } from '@/lib/gsch/selects'
import type { GschClimateType } from '@/shared/types/gsch'

const CLIMATE_TYPES: GschClimateType[] = [
  'renewable_energy',
  'carbon_reduction',
  'waste_management',
  'recycling',
  'water_conservation',
  'climate_adaptation',
  'net_zero',
  'environmental_collaboration',
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
      .from('gsch_climate_projects')
      .select(GSCH_CLIMATE_PROJECT_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Climate project not found', 404)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load climate project', 500)
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
      .from('gsch_climate_projects')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Climate project not found', 404)

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
    if (body.climate_type != null) {
      if (!CLIMATE_TYPES.includes(body.climate_type)) {
        return errorResponse('Invalid climate_type', 400)
      }
      patch.climate_type = body.climate_type
    }
    if (body.country != null) patch.country = body.country?.trim() || null
    if (body.continent != null) patch.continent = body.continent?.trim() || null
    if (body.location_label != null) {
      patch.location_label = body.location_label?.trim() || null
    }
    if (body.city_id !== undefined) patch.city_id = body.city_id || null
    if (body.seeking_partners != null) {
      patch.seeking_partners = parseGschTags(body.seeking_partners)
    }
    if (body.estimated_impact != null) {
      patch.estimated_impact = body.estimated_impact?.trim() || null
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
      .from('gsch_climate_projects')
      .update(patch)
      .eq('id', id)
      .select(GSCH_CLIMATE_PROJECT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'climate_project_updated',
      entity_type: 'gsch_climate_project',
      entity_id: id,
      metadata: patch,
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update climate project', 500)
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
      table: 'gsch_climate_projects',
      entityType: 'gsch_climate_project',
      action: 'climate_project_deleted',
      notFoundMessage: 'Climate project not found',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete climate project', 500)
  }
}
