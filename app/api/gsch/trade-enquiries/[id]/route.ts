import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { getOrgMembership, requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'
import { GSCH_TRADE_ENQUIRY_SELECT } from '@/lib/gsch/selects'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_trade_enquiries')
      .select(GSCH_TRADE_ENQUIRY_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Trade enquiry not found', 404)

    const fromMem = await getOrgMembership(supabase, data.from_organization_id, user.id)
    const toMem = await getOrgMembership(supabase, data.to_organization_id, user.id)
    if (!fromMem && !toMem) {
      const adminAuthz = await requireOrgRole(
        supabase,
        data.to_organization_id,
        user.id,
        'member'
      )
      if (!adminAuthz.ok) return forbiddenResponse('Not authorized to view this enquiry.')
    }

    return jsonResponse({
      ...data,
      direction: fromMem ? 'sent' : 'received',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load trade enquiry', 500)
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
      .from('gsch_trade_enquiries')
      .select(
        'id, from_organization_id, to_organization_id, status, created_by, subject'
      )
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Trade enquiry not found', 404)

    const action = String(body.action || '').trim()
    const patch: Record<string, unknown> = {}

    if (action === 'withdraw') {
      const authz = await requireOrgRole(
        supabase,
        existing.from_organization_id,
        user.id,
        'member'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
      if (!['open'].includes(existing.status)) {
        return errorResponse('Can only withdraw open enquiries', 400)
      }
      patch.status = 'withdrawn'
    } else if (action === 'respond') {
      const authz = await requireOrgRole(
        supabase,
        existing.to_organization_id,
        user.id,
        'representative'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
      patch.status = 'responded'
      patch.responded_by = user.id
      patch.responded_at = new Date().toISOString()
      if (body.response_notes != null) {
        patch.response_notes = body.response_notes?.trim() || null
      }
    } else if (action === 'close') {
      const toAuthz = await requireOrgRole(
        supabase,
        existing.to_organization_id,
        user.id,
        'representative'
      )
      const fromAuthz = await requireOrgRole(
        supabase,
        existing.from_organization_id,
        user.id,
        'member'
      )
      if (!toAuthz.ok && !fromAuthz.ok) {
        return forbiddenResponse('Not authorized to close this enquiry.')
      }
      patch.status = 'closed'
      if (body.response_notes != null) {
        patch.response_notes = body.response_notes?.trim() || null
      }
    } else {
      return errorResponse('action must be respond, close, or withdraw', 400)
    }

    const { data, error } = await supabase
      .from('gsch_trade_enquiries')
      .update(patch)
      .eq('id', id)
      .select(GSCH_TRADE_ENQUIRY_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: `trade_enquiry_${action}`,
      entity_type: 'gsch_trade_enquiry',
      entity_id: id,
      metadata: patch,
    })

    if (action === 'respond') {
      await notifyGschOrgOwners(supabase, existing.from_organization_id, {
        type: 'gsch_trade_enquiry_response',
        title: 'Trade enquiry response',
        message: `Response received for “${existing.subject}”.`,
        data: {
          enquiry_id: id,
          type: 'gsch_trade_enquiry_response',
        },
        excludeUserId: user.id,
      })
    }

    const fromMem = await getOrgMembership(
      supabase,
      data.from_organization_id,
      user.id
    )
    return jsonResponse({
      ...data,
      direction: fromMem ? 'sent' : 'received',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update trade enquiry', 500)
  }
}
