import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  checkYouthLeadershipAccess,
  requireOrgRole,
  writeYouthAuditLog,
} from '@/lib/youth-leadership/auth'

const PROGRAM_SELECT = `
  *,
  organization:youth_organizations!organization_id(
    id, name, logo_url, website, verification_status, country, region, description
  ),
  category:youth_program_categories!category_id(id, slug, name)
`

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const { data: program, error } = await supabase
      .from('youth_programs')
      .select(PROGRAM_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!program) return errorResponse('Program not found', 404)

    const [{ data: application }, { data: enrollment }] = await Promise.all([
      supabase
        .from('youth_program_applications')
        .select('*')
        .eq('program_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('youth_program_enrollments')
        .select('*')
        .eq('program_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    return jsonResponse({
      ...program,
      my_application: application || null,
      my_enrollment: enrollment || null,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load program', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data: existing } = await supabase
      .from('youth_programs')
      .select('id, organization_id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return errorResponse('Program not found', 404)

    const authz = await requireOrgRole(
      supabase,
      existing.organization_id,
      user.id,
      'coordinator'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const allowed: Record<string, unknown> = {}
    const fields = [
      'title',
      'description',
      'objectives',
      'category_id',
      'category_slug',
      'eligibility',
      'minimum_age',
      'maximum_age',
      'required_skills',
      'format',
      'location_region',
      'country',
      'schedule',
      'requirements',
      'safety_information',
      'start_date',
      'end_date',
      'application_deadline',
      'capacity',
      'requires_guardian_approval',
      'application_questions',
      'status',
    ] as const

    for (const key of fields) {
      if (body[key] !== undefined) allowed[key] = body[key]
    }

    if (body.status === 'published' && existing.status !== 'published') {
      allowed.published_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('youth_programs')
      .update(allowed)
      .eq('id', id)
      .select(PROGRAM_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    if (body.status && body.status !== existing.status) {
      await writeYouthAuditLog(supabase, {
        actor_id: user.id,
        action: `program_status_${body.status}`,
        entity_type: 'youth_program',
        entity_id: id,
        metadata: { from: existing.status, to: body.status },
      })
    }

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update program', 500)
  }
}
