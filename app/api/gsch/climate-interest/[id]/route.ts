import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_CLIMATE_INTEREST_SELECT } from '@/lib/gsch/selects'
import type { GschClimateInterestStatus } from '@/shared/types/gsch'

const STATUSES: GschClimateInterestStatus[] = [
  'submitted',
  'under_review',
  'responded',
  'withdrawn',
  'closed',
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
      .from('gsch_climate_interest')
      .select('id, climate_project_id, applicant_user_id, status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Interest record not found', 404)

    const { data: project } = await supabase
      .from('gsch_climate_projects')
      .select('id, organization_id')
      .eq('id', existing.climate_project_id)
      .maybeSingle()
    if (!project) return errorResponse('Climate project not found', 404)

    const action = String(body.action || '').trim()
    let nextStatus: GschClimateInterestStatus | null = null

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
      action === 'respond' ||
      action === 'close'
    ) {
      const authz = await requireOrgRole(
        supabase,
        project.organization_id,
        user.id,
        'representative'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
      if (action === 'under_review') nextStatus = 'under_review'
      else if (action === 'respond') nextStatus = 'responded'
      else nextStatus = 'closed'
    } else if (body.status) {
      const authz = await requireOrgRole(
        supabase,
        project.organization_id,
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
      .from('gsch_climate_interest')
      .update({ status: nextStatus })
      .eq('id', id)
      .select(GSCH_CLIMATE_INTEREST_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: `climate_interest_${action || nextStatus}`,
      entity_type: 'gsch_climate_interest',
      entity_id: id,
      metadata: { status: nextStatus },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update interest', 500)
  }
}
