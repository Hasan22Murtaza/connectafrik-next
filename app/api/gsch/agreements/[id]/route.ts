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
import { GSCH_AGREEMENT_SELECT, parseGschTags } from '@/lib/gsch/selects'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'
import type { GschAgreementStatus } from '@/shared/types/gsch'

const ALLOWED_TRANSITIONS: Record<GschAgreementStatus, GschAgreementStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['discussion', 'approved', 'cancelled'],
  discussion: ['approved', 'submitted', 'cancelled'],
  approved: ['signed', 'discussion', 'cancelled'],
  signed: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_agreements')
      .select(GSCH_AGREEMENT_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Agreement not found', 404)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load agreement', 500)
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
      .from('gsch_agreements')
      .select(
        'id, organization_a_id, organization_b_id, status, title, created_by'
      )
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Agreement not found', 404)

    const isAdmin = await isPlatformGschAdmin(supabase, user.id)
    if (!isAdmin) {
      const authA = await requireOrgRole(
        supabase,
        existing.organization_a_id,
        user.id,
        'representative'
      )
      const authB = await requireOrgRole(
        supabase,
        existing.organization_b_id,
        user.id,
        'representative'
      )
      if (!authA.ok && !authB.ok) {
        return forbiddenResponse('Not authorized to update this agreement')
      }
    }

    const patch: Record<string, unknown> = {}

    if (body.status != null) {
      const next = body.status as GschAgreementStatus
      const current = existing.status as GschAgreementStatus
      const allowed = ALLOWED_TRANSITIONS[current] || []
      if (!allowed.includes(next) && !isAdmin) {
        return errorResponse(
          `Cannot transition from ${current} to ${next}`,
          400
        )
      }
      if (next === 'signed' && !body.disclaimer_acknowledged) {
        return errorResponse(
          'Disclaimer acknowledgement is required before recording signed intent status',
          400
        )
      }
      patch.status = next
    }

    if (body.title != null) patch.title = String(body.title).trim()
    if (body.objectives != null) patch.objectives = body.objectives?.trim() || null
    if (body.duration_label != null) {
      patch.duration_label = body.duration_label?.trim() || null
    }
    if (body.responsibilities_a != null) {
      patch.responsibilities_a = body.responsibilities_a?.trim() || null
    }
    if (body.responsibilities_b != null) {
      patch.responsibilities_b = body.responsibilities_b?.trim() || null
    }
    if (body.document_urls != null) {
      patch.document_urls = parseGschTags(body.document_urls)
    }
    if (body.city_a_id !== undefined) patch.city_a_id = body.city_a_id || null
    if (body.city_b_id !== undefined) patch.city_b_id = body.city_b_id || null
    if (body.partnership_id !== undefined) {
      patch.partnership_id = body.partnership_id || null
    }

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_agreements')
      .update(patch)
      .eq('id', id)
      .select(GSCH_AGREEMENT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    if (patch.status) {
      await supabase.from('gsch_agreement_approvals').insert({
        agreement_id: id,
        organization_id: existing.organization_a_id,
        approver_user_id: user.id,
        action:
          patch.status === 'signed'
            ? 'signed_intent'
            : patch.status === 'submitted'
              ? 'submitted'
              : patch.status === 'approved'
                ? 'approved'
                : 'comment',
        notes:
          patch.status === 'signed'
            ? 'Status moved to signed (intent only — not a legal e-signature)'
            : `Status changed to ${patch.status}`,
      })
    }

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'agreement_updated',
      entity_type: 'gsch_agreement',
      entity_id: id,
      metadata: patch,
    })

    for (const orgId of [
      existing.organization_a_id,
      existing.organization_b_id,
    ]) {
      await notifyGschOrgOwners(supabase, orgId, {
        type: 'gsch_agreement_update',
        title: 'Agreement updated',
        message: `"${existing.title}" was updated${
          patch.status ? ` → ${patch.status}` : ''
        }.`,
        data: { agreement_id: id, status: patch.status || existing.status },
        excludeUserId: user.id,
      })
    }

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update agreement', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params

    const { data: existing, error: loadError } = await supabase
      .from('gsch_agreements')
      .select('id, organization_a_id, organization_b_id, title')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Agreement not found', 404)

    const isAdmin = await isPlatformGschAdmin(supabase, user.id)
    if (!isAdmin) {
      const authA = await requireOrgRole(
        supabase,
        existing.organization_a_id,
        user.id,
        'representative'
      )
      const authB = await requireOrgRole(
        supabase,
        existing.organization_b_id,
        user.id,
        'representative'
      )
      if (!authA.ok && !authB.ok) {
        return forbiddenResponse('Not authorized to delete this agreement.')
      }
    }

    const { error } = await supabase.from('gsch_agreements').delete().eq('id', id)
    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'agreement_deleted',
      entity_type: 'gsch_agreement',
      entity_id: id,
      metadata: { deleted: true, title: existing.title },
    })

    return jsonResponse({ deleted: true, id })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete agreement', 500)
  }
}
