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
import { GSCH_AGREEMENT_MILESTONE_SELECT } from '@/lib/gsch/selects'
import type { GschAgreementMilestoneStatus } from '@/shared/types/gsch'

const MILESTONE_STATUSES: GschAgreementMilestoneStatus[] = [
  'pending',
  'in_progress',
  'done',
  'skipped',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id, milestoneId } = await params
    const body = await request.json()

    const { data: agreement } = await supabase
      .from('gsch_agreements')
      .select('id, organization_a_id, organization_b_id')
      .eq('id', id)
      .maybeSingle()
    if (!agreement) return errorResponse('Agreement not found', 404)

    const isAdmin = await isPlatformGschAdmin(supabase, user.id)
    if (!isAdmin) {
      const authA = await requireOrgRole(
        supabase,
        agreement.organization_a_id,
        user.id,
        'representative'
      )
      const authB = await requireOrgRole(
        supabase,
        agreement.organization_b_id,
        user.id,
        'representative'
      )
      if (!authA.ok && !authB.ok) {
        return forbiddenResponse('Not authorized to update milestones')
      }
    }

    const { data: existing } = await supabase
      .from('gsch_agreement_milestones')
      .select('id, agreement_id')
      .eq('id', milestoneId)
      .eq('agreement_id', id)
      .maybeSingle()
    if (!existing) return errorResponse('Milestone not found', 404)

    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title).trim()
    if (body.description != null) {
      patch.description = body.description?.trim() || null
    }
    if (body.due_at !== undefined) patch.due_at = body.due_at || null
    if (body.sort_order != null && Number.isFinite(Number(body.sort_order))) {
      patch.sort_order = Number(body.sort_order)
    }
    if (body.status != null) {
      if (!MILESTONE_STATUSES.includes(body.status)) {
        return errorResponse('Invalid milestone status', 400)
      }
      patch.status = body.status
    }

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_agreement_milestones')
      .update(patch)
      .eq('id', milestoneId)
      .select(GSCH_AGREEMENT_MILESTONE_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'agreement_milestone_updated',
      entity_type: 'gsch_agreement_milestone',
      entity_id: milestoneId,
      metadata: patch,
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update milestone', 500)
  }
}
