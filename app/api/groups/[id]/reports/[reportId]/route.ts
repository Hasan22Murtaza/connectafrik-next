import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { canViewGroupComplaints } from '@/lib/groups/roles'

type RouteContext = { params: Promise<{ id: string; reportId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId, reportId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : ''

    if (!['reviewed', 'dismissed'].includes(status)) {
      return errorResponse('status must be one of: reviewed, dismissed', 400)
    }

    const { data: actorMembership, error: actorError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (actorError) return errorResponse(actorError.message, 400)
    if (!actorMembership || !canViewGroupComplaints(actorMembership.role)) {
      return forbiddenResponse('Only co-admins and admins can update complaints')
    }

    const { data: report, error: reportError } = await serviceClient
      .from('group_post_reports')
      .select('id, status')
      .eq('id', reportId)
      .eq('group_id', groupId)
      .maybeSingle()

    if (reportError) return errorResponse(reportError.message, 400)
    if (!report) return errorResponse('Complaint not found', 404)

    const { data: updated, error: updateError } = await serviceClient
      .from('group_post_reports')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', report.id)
      .select()
      .maybeSingle()

    if (updateError) return errorResponse(updateError.message, 400)

    return jsonResponse({ data: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update complaint'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
