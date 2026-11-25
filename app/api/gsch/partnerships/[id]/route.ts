import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  isPlatformGschAdmin,
  requireOrgRole,
  writeGschAuditLog,
} from '@/lib/gsch/auth'
import type { GschPartnershipStatus } from '@/shared/types/gsch'

const PARTNERSHIP_SELECT = `
  id, request_id, title, partnership_type,
  organization_a_id, organization_b_id, city_a_id, city_b_id,
  objectives, status, started_at, ends_at, created_by, created_at, updated_at,
  organization_a:gsch_organizations!organization_a_id(
    id, name, country, logo_url, verification_status
  ),
  organization_b:gsch_organizations!organization_b_id(
    id, name, country, logo_url, verification_status
  ),
  city_a:gsch_cities!city_a_id(id, name, country, logo_url),
  city_b:gsch_cities!city_b_id(id, name, country, logo_url)
`

const STATUS_VALUES: GschPartnershipStatus[] = [
  'active',
  'paused',
  'completed',
  'cancelled',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_partnerships')
      .select(PARTNERSHIP_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Partnership not found', 404)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load partnership', 500)
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
      .from('gsch_partnerships')
      .select('id, organization_a_id, organization_b_id, status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Partnership not found', 404)

    const isAdmin = await isPlatformGschAdmin(supabase, user.id)
    if (!isAdmin) {
      const authA = await requireOrgRole(
        supabase,
        existing.organization_a_id,
        user.id,
        'admin'
      )
      const authB = await requireOrgRole(
        supabase,
        existing.organization_b_id,
        user.id,
        'admin'
      )
      if (!authA.ok && !authB.ok) {
        return forbiddenResponse('Only organization admins can update partnership status')
      }
    }

    const patch: Record<string, unknown> = {}
    if (body.status != null) {
      if (!STATUS_VALUES.includes(body.status)) {
        return errorResponse('Invalid status', 400)
      }
      patch.status = body.status
    }
    if (body.objectives != null) patch.objectives = body.objectives?.trim() || null
    if (body.ends_at != null) {
      patch.ends_at = body.ends_at || null
    }
    if (body.title != null) patch.title = String(body.title).trim()

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_partnerships')
      .update(patch)
      .eq('id', id)
      .select(PARTNERSHIP_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'partnership_updated',
      entity_type: 'gsch_partnership',
      entity_id: id,
      metadata: patch,
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update partnership', 500)
  }
}
