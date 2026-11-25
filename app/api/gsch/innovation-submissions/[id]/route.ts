import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_INNOVATION_SUBMISSION_SELECT } from '@/lib/gsch/selects'
import type { GschInnovationSubmissionStatus } from '@/shared/types/gsch'

const STATUSES: GschInnovationSubmissionStatus[] = [
  'submitted',
  'under_review',
  'shortlisted',
  'selected',
  'declined',
  'withdrawn',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json()

    const { data: existing, error: loadError } = await supabase
      .from('gsch_innovation_submissions')
      .select('id, challenge_id, submitter_user_id, status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Submission not found', 404)

    const { data: challenge } = await supabase
      .from('gsch_innovation_challenges')
      .select('id, organization_id')
      .eq('id', existing.challenge_id)
      .maybeSingle()
    if (!challenge) return errorResponse('Innovation challenge not found', 404)

    const action = String(body.action || '').trim()
    let nextStatus: GschInnovationSubmissionStatus | null = null

    if (action === 'withdraw') {
      if (existing.submitter_user_id !== user.id) {
        return forbiddenResponse('Only the submitter can withdraw.')
      }
      if (!['submitted', 'under_review', 'shortlisted'].includes(existing.status)) {
        return errorResponse('Cannot withdraw in current status', 400)
      }
      nextStatus = 'withdrawn'
    } else if (
      action === 'under_review' ||
      action === 'shortlist' ||
      action === 'select' ||
      action === 'decline'
    ) {
      const authz = await requireOrgRole(
        supabase,
        challenge.organization_id,
        user.id,
        'representative'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
      if (action === 'under_review') nextStatus = 'under_review'
      else if (action === 'shortlist') nextStatus = 'shortlisted'
      else if (action === 'select') nextStatus = 'selected'
      else nextStatus = 'declined'
    } else if (body.status) {
      const authz = await requireOrgRole(
        supabase,
        challenge.organization_id,
        user.id,
        'representative'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
      if (!STATUSES.includes(body.status)) {
        return errorResponse('Invalid status', 400)
      }
      nextStatus = body.status
    } else {
      return errorResponse('action or status is required', 400)
    }

    const { data, error } = await supabase
      .from('gsch_innovation_submissions')
      .update({ status: nextStatus })
      .eq('id', id)
      .select(GSCH_INNOVATION_SUBMISSION_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: `innovation_submission_${action || nextStatus}`,
      entity_type: 'gsch_innovation_submission',
      entity_id: id,
      metadata: { status: nextStatus },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update submission', 500)
  }
}
