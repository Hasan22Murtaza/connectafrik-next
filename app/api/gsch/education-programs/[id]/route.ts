import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_EDUCATION_PROGRAM_SELECT, parseGschTags } from '@/lib/gsch/selects'
import type { GschEducationProgramType } from '@/shared/types/gsch'

const PROGRAM_TYPES: GschEducationProgramType[] = [
  'student_exchange',
  'teacher_exchange',
  'research_collaboration',
  'scholarship',
  'innovation_partnership',
  'international_program',
  'other',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_education_programs')
      .select(GSCH_EDUCATION_PROGRAM_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Education program not found', 404)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load education program', 500)
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
      .from('gsch_education_programs')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Education program not found', 404)

    const authz = await requireOrgRole(
      supabase,
      existing.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title).trim()
    if (body.summary != null) patch.summary = body.summary?.trim() || null
    if (body.description != null) patch.description = body.description?.trim() || null
    if (body.program_type != null) {
      if (!PROGRAM_TYPES.includes(body.program_type)) {
        return errorResponse('Invalid program_type', 400)
      }
      patch.program_type = body.program_type
    }
    if (body.institution_name != null) {
      patch.institution_name = body.institution_name?.trim() || null
    }
    if (body.country != null) patch.country = body.country?.trim() || null
    if (body.continent != null) patch.continent = body.continent?.trim() || null
    if (body.location_label != null) {
      patch.location_label = body.location_label?.trim() || null
    }
    if (body.eligibility != null) patch.eligibility = body.eligibility?.trim() || null
    if (body.duration_label != null) {
      patch.duration_label = body.duration_label?.trim() || null
    }
    if (body.city_id !== undefined) patch.city_id = body.city_id || null
    if (body.starts_at !== undefined) patch.starts_at = body.starts_at || null
    if (body.ends_at !== undefined) patch.ends_at = body.ends_at || null
    if (body.application_deadline !== undefined) {
      patch.application_deadline = body.application_deadline || null
    }
    if (body.external_url != null) patch.external_url = body.external_url?.trim() || null
    if (body.contact_email != null) {
      patch.contact_email = body.contact_email?.trim() || null
    }
    if (body.tags != null) patch.tags = parseGschTags(body.tags)
    if (body.is_published != null) patch.is_published = Boolean(body.is_published)

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_education_programs')
      .update(patch)
      .eq('id', id)
      .select(GSCH_EDUCATION_PROGRAM_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'education_program_updated',
      entity_type: 'gsch_education_program',
      entity_id: id,
      metadata: patch,
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update education program', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { deleteGschOrgEntity } = await import('@/lib/gsch/delete-entity')
    return deleteGschOrgEntity({
      supabase,
      userId: user.id,
      id,
      table: 'gsch_education_programs',
      entityType: 'gsch_education_program',
      action: 'education_program_deleted',
      notFoundMessage: 'Education program not found',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete education program', 500)
  }
}
