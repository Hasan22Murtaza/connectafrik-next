import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { isPlatformGschAdmin, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_PROJECT_SELECT } from '@/lib/gsch/selects'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!(await isPlatformGschAdmin(supabase, user.id))) {
      return forbiddenResponse('Platform admin access required.')
    }

    const { id } = await params
    const body = await request.json()
    const status = String(body.verification_status || body.status || '').trim()

    if (!['verified', 'rejected', 'pending_review', 'unverified'].includes(status)) {
      return errorResponse(
        'verification_status must be verified, rejected, pending_review, or unverified',
        400
      )
    }

    const { data: existing, error: loadError } = await supabase
      .from('gsch_projects')
      .select('id, title')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Project not found', 404)

    const { data, error } = await supabase
      .from('gsch_projects')
      .update({ verification_status: status })
      .eq('id', id)
      .select(GSCH_PROJECT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'project_verification_updated',
      entity_type: 'gsch_project',
      entity_id: id,
      metadata: { verification_status: status },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update project verification', 500)
  }
}
