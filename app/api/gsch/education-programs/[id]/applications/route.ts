import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'
import { GSCH_EDUCATION_APPLICATION_SELECT } from '@/lib/gsch/selects'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params

    const { data: program, error: loadError } = await supabase
      .from('gsch_education_programs')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!program) return errorResponse('Education program not found', 404)

    const authz = await requireOrgRole(
      supabase,
      program.organization_id,
      user.id,
      'member'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    const { data, error } = await supabase
      .from('gsch_education_applications')
      .select(GSCH_EDUCATION_APPLICATION_SELECT)
      .eq('program_id', id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({
      data: data || [],
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load applications', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json()

    const { data: program, error: loadError } = await supabase
      .from('gsch_education_programs')
      .select('id, organization_id, title, is_published')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!program) return errorResponse('Education program not found', 404)
    if (!program.is_published) {
      return errorResponse('Program is not published', 400)
    }

    if (body.organization_id) {
      const authz = await requireOrgRole(
        supabase,
        body.organization_id,
        user.id,
        'member'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
    }

    const { data, error } = await supabase
      .from('gsch_education_applications')
      .insert({
        program_id: id,
        organization_id: body.organization_id || null,
        applicant_user_id: user.id,
        message: body.message?.trim() || null,
        contact_email: body.contact_email?.trim() || null,
        status: 'submitted',
      })
      .select(GSCH_EDUCATION_APPLICATION_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'education_application_created',
      entity_type: 'gsch_education_application',
      entity_id: data.id,
      metadata: { program_id: id },
    })

    await notifyGschOrgOwners(supabase, program.organization_id, {
      type: 'gsch_education_application',
      title: 'Education application received',
      message: `Someone applied to “${program.title}”.`,
      data: {
        program_id: id,
        application_id: data.id,
        type: 'gsch_education_application',
      },
      excludeUserId: user.id,
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to submit application', 500)
  }
}
