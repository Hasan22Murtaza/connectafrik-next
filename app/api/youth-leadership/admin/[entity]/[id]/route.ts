import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  isPlatformYouthAdmin,
  writeYouthAuditLog,
} from '@/lib/youth-leadership/auth'

type Params = { params: Promise<{ entity: string; id: string }> }

const ENTITY_TABLE: Record<string, string> = {
  organizations: 'youth_organizations',
  orgs: 'youth_organizations',
  mentors: 'youth_mentors',
  programs: 'youth_programs',
  'safety-reports': 'youth_safety_reports',
  safety_reports: 'youth_safety_reports',
  safety: 'youth_safety_reports',
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { entity, id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!(await isPlatformYouthAdmin(supabase, user.id))) {
      return forbiddenResponse('Platform admin access required.')
    }

    const table = ENTITY_TABLE[entity]
    if (!table) {
      return errorResponse(
        'entity must be one of: organizations, mentors, programs, safety-reports',
        400
      )
    }

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    const now = new Date().toISOString()

    if (table === 'youth_organizations') {
      const status = body.verification_status || body.status
      if (status) {
        if (!['pending', 'verified', 'rejected', 'suspended'].includes(status)) {
          return errorResponse('Invalid organization verification_status', 400)
        }
        updates.verification_status = status
        if (status === 'verified') {
          updates.verified_by = user.id
          updates.verified_at = now
        }
      }
      for (const key of ['name', 'description', 'country', 'region'] as const) {
        if (body[key] !== undefined) updates[key] = body[key]
      }
    } else if (table === 'youth_mentors') {
      const status = body.verification_status || body.status
      if (status) {
        if (!['pending', 'verified', 'rejected', 'suspended'].includes(status)) {
          return errorResponse('Invalid mentor verification_status', 400)
        }
        updates.verification_status = status
        if (status === 'verified') {
          updates.verified_by = user.id
          updates.verified_at = now
        }
      }
      if (body.accepts_minors !== undefined) updates.accepts_minors = Boolean(body.accepts_minors)
    } else if (table === 'youth_programs') {
      const status = body.status
      if (status) {
        if (
          !['draft', 'pending_review', 'published', 'closed', 'archived', 'suspended'].includes(
            status
          )
        ) {
          return errorResponse('Invalid program status', 400)
        }
        updates.status = status
        if (status === 'published') {
          updates.published_at = now
        }
      }
    } else if (table === 'youth_safety_reports') {
      const status = body.status
      if (status) {
        if (!['open', 'under_review', 'resolved', 'dismissed'].includes(status)) {
          return errorResponse('Invalid safety report status', 400)
        }
        updates.status = status
        updates.reviewed_by = user.id
        updates.reviewed_at = now
      }
      if (body.resolution_notes !== undefined) {
        updates.resolution_notes = body.resolution_notes
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Entity not found', 404)

    await writeYouthAuditLog(supabase, {
      actor_id: user.id,
      action: `admin_${entity}_update`,
      entity_type: table,
      entity_id: id,
      metadata: { updates },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update entity', 500)
  }
}
