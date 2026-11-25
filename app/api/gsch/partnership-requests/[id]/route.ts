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
  orgRoleRank,
  requireOrgRole,
  writeGschAuditLog,
} from '@/lib/gsch/auth'
import type { GschPartnershipType } from '@/shared/types/gsch'

const PARTNERSHIP_TYPES: GschPartnershipType[] = [
  'sister_city',
  'economic',
  'tourism',
  'education',
  'climate',
  'infrastructure',
  'innovation',
  'cultural',
  'other',
]

const REQUEST_SELECT = `
  id, requesting_organization_id, target_organization_id,
  requesting_city_id, target_city_id, title, partnership_type,
  objectives, proposed_duration, message, status, created_by,
  responded_by, responded_at, response_notes, partnership_id,
  created_at, updated_at,
  requesting_organization:gsch_organizations!requesting_organization_id(
    id, name, country, logo_url, verification_status
  ),
  target_organization:gsch_organizations!target_organization_id(
    id, name, country, logo_url, verification_status
  ),
  requesting_city:gsch_cities!requesting_city_id(
    id, name, country, logo_url
  ),
  target_city:gsch_cities!target_city_id(
    id, name, country, logo_url
  )
`

async function loadRequest(supabase: any, id: string) {
  const { data, error } = await supabase
    .from('gsch_partnership_requests')
    .select(REQUEST_SELECT)
    .eq('id', id)
    .maybeSingle()
  return { data, error }
}

async function resolveTargetOrgId(
  supabase: any,
  row: {
    target_organization_id: string | null
    target_city_id: string | null
  }
): Promise<string | null> {
  if (row.target_organization_id) return row.target_organization_id
  if (!row.target_city_id) return null
  const { data: city } = await supabase
    .from('gsch_cities')
    .select('organization_id')
    .eq('id', row.target_city_id)
    .maybeSingle()
  return city?.organization_id || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await loadRequest(supabase, id)
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Partnership request not found', 404)
    void user
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load request', 500)
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

    const { data: existing, error: loadError } = await loadRequest(supabase, id)
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Partnership request not found', 404)

    const action = String(body.action || '').trim()
    const isAdmin = await isPlatformGschAdmin(supabase, user.id)
    const targetOrgId = await resolveTargetOrgId(supabase, existing)

    // --- Accept ---
    if (action === 'accept') {
      if (!['pending'].includes(existing.status)) {
        return errorResponse('Only pending requests can be accepted', 400)
      }
      if (!targetOrgId) {
        return errorResponse('Request has no target organization to accept', 400)
      }
      if (!isAdmin) {
        const authz = await requireOrgRole(supabase, targetOrgId, user.id, 'representative')
        if (!authz.ok) return forbiddenResponse(authz.message)
      }

      const { data: partnership, error: pErr } = await supabase
        .from('gsch_partnerships')
        .insert({
          request_id: existing.id,
          title: existing.title,
          partnership_type: existing.partnership_type,
          organization_a_id: existing.requesting_organization_id,
          organization_b_id: targetOrgId,
          city_a_id: existing.requesting_city_id,
          city_b_id: existing.target_city_id,
          objectives: existing.objectives,
          status: 'active',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (pErr) return errorResponse(pErr.message, 400)

      const { data: updated, error: uErr } = await supabase
        .from('gsch_partnership_requests')
        .update({
          status: 'accepted',
          responded_by: user.id,
          responded_at: new Date().toISOString(),
          response_notes: body.response_notes?.trim() || null,
          partnership_id: partnership.id,
        })
        .eq('id', id)
        .select(REQUEST_SELECT)
        .single()

      if (uErr) return errorResponse(uErr.message, 400)

      await writeGschAuditLog(supabase, {
        actor_id: user.id,
        action: 'partnership_request_accepted',
        entity_type: 'gsch_partnership_request',
        entity_id: id,
        metadata: { partnership_id: partnership.id },
      })

      return jsonResponse({ ...updated, partnership_id: partnership.id })
    }

    // --- Decline ---
    if (action === 'decline') {
      if (!['pending'].includes(existing.status)) {
        return errorResponse('Only pending requests can be declined', 400)
      }
      if (!targetOrgId) {
        return errorResponse('Request has no target organization', 400)
      }
      if (!isAdmin) {
        const authz = await requireOrgRole(supabase, targetOrgId, user.id, 'representative')
        if (!authz.ok) return forbiddenResponse(authz.message)
      }

      const { data: updated, error: uErr } = await supabase
        .from('gsch_partnership_requests')
        .update({
          status: 'declined',
          responded_by: user.id,
          responded_at: new Date().toISOString(),
          response_notes: body.response_notes?.trim() || null,
        })
        .eq('id', id)
        .select(REQUEST_SELECT)
        .single()

      if (uErr) return errorResponse(uErr.message, 400)

      await writeGschAuditLog(supabase, {
        actor_id: user.id,
        action: 'partnership_request_declined',
        entity_type: 'gsch_partnership_request',
        entity_id: id,
      })

      return jsonResponse(updated)
    }

    // --- Withdraw / cancel ---
    if (action === 'withdraw' || action === 'cancel') {
      if (!['draft', 'pending'].includes(existing.status)) {
        return errorResponse('Only draft or pending requests can be withdrawn', 400)
      }
      if (!isAdmin) {
        const isCreator = existing.created_by === user.id
        const authz = await requireOrgRole(
          supabase,
          existing.requesting_organization_id,
          user.id,
          'admin'
        )
        if (!isCreator && !authz.ok) return forbiddenResponse(authz.message)
      }

      const { data: updated, error: uErr } = await supabase
        .from('gsch_partnership_requests')
        .update({
          status: action === 'cancel' ? 'cancelled' : 'withdrawn',
          responded_by: user.id,
          responded_at: new Date().toISOString(),
          response_notes: body.response_notes?.trim() || null,
        })
        .eq('id', id)
        .select(REQUEST_SELECT)
        .single()

      if (uErr) return errorResponse(uErr.message, 400)

      await writeGschAuditLog(supabase, {
        actor_id: user.id,
        action: `partnership_request_${action === 'cancel' ? 'cancelled' : 'withdrawn'}`,
        entity_type: 'gsch_partnership_request',
        entity_id: id,
      })

      return jsonResponse(updated)
    }

    // --- Draft / field updates by requester ---
    if (!isAdmin) {
      const isCreator = existing.created_by === user.id
      const authz = await requireOrgRole(
        supabase,
        existing.requesting_organization_id,
        user.id,
        'representative'
      )
      if (!isCreator && !authz.ok) return forbiddenResponse(authz.message)
      if (
        authz.ok &&
        !isCreator &&
        orgRoleRank(authz.membership.role) < orgRoleRank('representative')
      ) {
        return forbiddenResponse('Not authorized')
      }
    }

    if (!['draft', 'pending'].includes(existing.status)) {
      return errorResponse('Cannot edit a closed request', 400)
    }

    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title).trim()
    if (body.objectives != null) patch.objectives = body.objectives?.trim() || null
    if (body.proposed_duration != null) {
      patch.proposed_duration = body.proposed_duration?.trim() || null
    }
    if (body.message != null) patch.message = body.message?.trim() || null
    if (body.partnership_type != null) {
      if (!PARTNERSHIP_TYPES.includes(body.partnership_type)) {
        return errorResponse('Invalid partnership_type', 400)
      }
      patch.partnership_type = body.partnership_type
    }
    if (body.status === 'pending' && existing.status === 'draft') {
      patch.status = 'pending'
    }
    if (body.status === 'draft' && existing.status === 'draft') {
      patch.status = 'draft'
    }

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data: updated, error: uErr } = await supabase
      .from('gsch_partnership_requests')
      .update(patch)
      .eq('id', id)
      .select(REQUEST_SELECT)
      .single()

    if (uErr) return errorResponse(uErr.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'partnership_request_updated',
      entity_type: 'gsch_partnership_request',
      entity_id: id,
      metadata: patch,
    })

    return jsonResponse(updated)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update request', 500)
  }
}
