import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_BUSINESS_PROFILE_SELECT } from '@/lib/gsch/selects'

function parseStringArray(value: unknown): string[] {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_business_profiles')
      .select(GSCH_BUSINESS_PROFILE_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Business profile not found', 404)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load business profile', 500)
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
      .from('gsch_business_profiles')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Business profile not found', 404)

    const authz = await requireOrgRole(
      supabase,
      existing.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const patch: Record<string, unknown> = {}
    if (body.display_name != null) patch.display_name = String(body.display_name).trim()
    if (body.tagline !== undefined) patch.tagline = body.tagline?.trim() || null
    if (body.description !== undefined) {
      patch.description = body.description?.trim() || null
    }
    if (body.logo_url !== undefined) patch.logo_url = body.logo_url?.trim() || null
    if (body.website !== undefined) patch.website = body.website?.trim() || null
    if (body.country !== undefined) patch.country = body.country?.trim() || null
    if (body.city !== undefined) patch.city = body.city?.trim() || null
    if (body.industry_sectors != null) {
      patch.industry_sectors = parseStringArray(body.industry_sectors)
    }
    if (body.seeking != null) patch.seeking = parseStringArray(body.seeking)
    if (body.offering != null) patch.offering = parseStringArray(body.offering)
    if (body.export_markets != null) {
      patch.export_markets = parseStringArray(body.export_markets)
    }
    if (body.import_needs != null) {
      patch.import_needs = parseStringArray(body.import_needs)
    }
    if (body.languages != null) patch.languages = parseStringArray(body.languages)
    if (body.employee_range !== undefined) {
      patch.employee_range = body.employee_range?.trim() || null
    }
    if (body.year_established !== undefined) {
      patch.year_established = body.year_established
        ? Number(body.year_established)
        : null
    }
    if (body.is_published != null) patch.is_published = Boolean(body.is_published)

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_business_profiles')
      .update(patch)
      .eq('id', id)
      .select(GSCH_BUSINESS_PROFILE_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'business_profile_updated',
      entity_type: 'gsch_business_profile',
      entity_id: id,
      metadata: patch,
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update business profile', 500)
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
      table: 'gsch_business_profiles',
      entityType: 'gsch_business_profile',
      action: 'business_profile_deleted',
      notFoundMessage: 'Business profile not found',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete business profile', 500)
  }
}
