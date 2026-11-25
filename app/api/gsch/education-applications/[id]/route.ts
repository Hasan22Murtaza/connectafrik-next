import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_EDUCATION_APPLICATION_SELECT } from '@/lib/gsch/selects'
import type { GschEducationApplicationStatus } from '@/shared/types/gsch'

const STATUSES: GschEducationApplicationStatus[] = [
  'submitted',
  'under_review',
  'accepted',
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
      .from('gsch_education_applications')
      .select('id, program_id, applicant_user_id, status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Application not found', 404)

    const { data: program } = await supabase
      .from('gsch_education_programs')
      .select('id, organization_id')
      .eq('id', existing.program_id)
      .maybeSingle()
    if (!program) return errorResponse('Education program not found', 404)

    const action = String(body.action || '').trim()
    let nextStatus: GschEducationApplicationStatus | null = null

    if (action === 'withdraw') {
      if (existing.applicant_user_id !== user.id) {
        return forbiddenResponse('Only the applicant can withdraw.')
      }
      if (!['submitted', 'under_review'].includes(existing.status)) {
        return errorResponse('Cannot withdraw in current status', 400)
      }
      nextStatus = 'withdrawn'
    } else if (
      action === 'under_review' ||
      action === 'accept' ||
      action === 'decline'
    ) {
      const authz = await requireOrgRole(
        supabase,
        program.organization_id,
        user.id,
        'representative'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
      if (action === 'under_review') nextStatus = 'under_review'
      else if (action === 'accept') nextStatus = 'accepted'
      else nextStatus = 'declined'
    } else if (body.status) {
      const authz = await requireOrgRole(
        supabase,
        program.organization_id,
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
      .from('gsch_education_applications')
      .update({ status: nextStatus })
      .eq('id', id)
      .select(GSCH_EDUCATION_APPLICATION_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: `education_application_${action || nextStatus}`,
      entity_type: 'gsch_education_application',
      entity_id: id,
      metadata: { status: nextStatus },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update application', 500)
  }
}
