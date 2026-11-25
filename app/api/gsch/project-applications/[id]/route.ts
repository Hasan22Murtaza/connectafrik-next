import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import type { GschProjectApplicationStatus } from '@/shared/types/gsch'

const APP_SELECT = `
  id, project_id, organization_id, applicant_user_id, application_type,
  message, contact_email, status, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url
  ),
  project:gsch_projects!project_id(
    id, title, organization_id, category
  )
`

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json()

    const { data: existing, error: loadError } = await supabase
      .from('gsch_project_applications')
      .select('id, project_id, applicant_user_id, status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Application not found', 404)

    const { data: project } = await supabase
      .from('gsch_projects')
      .select('id, organization_id')
      .eq('id', existing.project_id)
      .maybeSingle()
    if (!project) return errorResponse('Project not found', 404)

    const action = String(body.action || '').trim()
    let nextStatus: GschProjectApplicationStatus | null = null

    if (action === 'withdraw') {
      if (existing.applicant_user_id !== user.id) {
        return forbiddenResponse('Only the applicant can withdraw.')
      }
      if (!['submitted', 'under_review'].includes(existing.status)) {
        return errorResponse('Cannot withdraw in current status', 400)
      }
      nextStatus = 'withdrawn'
    } else if (action === 'respond' || action === 'under_review' || action === 'close') {
      const authz = await requireOrgRole(
        supabase,
        project.organization_id,
        user.id,
        'representative'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
      if (action === 'respond') nextStatus = 'responded'
      else if (action === 'under_review') nextStatus = 'under_review'
      else nextStatus = 'closed'
    } else if (body.status) {
      // Direct status for project owners
      const authz = await requireOrgRole(
        supabase,
        project.organization_id,
        user.id,
        'representative'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
      if (
        !['submitted', 'under_review', 'responded', 'withdrawn', 'closed'].includes(
          body.status
        )
      ) {
        return errorResponse('Invalid status', 400)
      }
      nextStatus = body.status
    } else {
      return errorResponse('action or status is required', 400)
    }

    const { data, error } = await supabase
      .from('gsch_project_applications')
      .update({ status: nextStatus })
      .eq('id', id)
      .select(APP_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: `project_application_${action || nextStatus}`,
      entity_type: 'gsch_project_application',
      entity_id: id,
      metadata: { status: nextStatus },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update application', 500)
  }
}
