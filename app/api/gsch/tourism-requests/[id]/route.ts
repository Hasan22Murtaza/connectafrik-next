import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_TOURISM_REQUEST_SELECT } from '@/lib/gsch/selects'
import type { GschTourismPartnershipStatus } from '@/shared/types/gsch'

const STATUSES: GschTourismPartnershipStatus[] = [
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
      .from('gsch_tourism_partnership_requests')
      .select('id, initiative_id, from_organization_id, created_by, status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Partnership request not found', 404)

    const { data: initiative } = await supabase
      .from('gsch_tourism_initiatives')
      .select('id, organization_id')
      .eq('id', existing.initiative_id)
      .maybeSingle()
    if (!initiative) return errorResponse('Tourism initiative not found', 404)

    const action = String(body.action || '').trim()
    let nextStatus: GschTourismPartnershipStatus | null = null

    if (action === 'withdraw') {
      if (
        existing.created_by !== user.id &&
        !(
          await requireOrgRole(
            supabase,
            existing.from_organization_id,
            user.id,
            'member'
          )
        ).ok
      ) {
        return forbiddenResponse('Only the requester can withdraw.')
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
        initiative.organization_id,
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
        initiative.organization_id,
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
      .from('gsch_tourism_partnership_requests')
      .update({ status: nextStatus })
      .eq('id', id)
      .select(GSCH_TOURISM_REQUEST_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: `tourism_partnership_request_${action || nextStatus}`,
      entity_type: 'gsch_tourism_partnership_request',
      entity_id: id,
      metadata: { status: nextStatus },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update partnership request', 500)
  }
}
