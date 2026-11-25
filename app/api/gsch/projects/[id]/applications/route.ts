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
import type { GschProjectApplicationType } from '@/shared/types/gsch'

const APP_TYPES: GschProjectApplicationType[] = [
  'express_interest',
  'request_information',
]

const APP_SELECT = `
  id, project_id, organization_id, applicant_user_id, application_type,
  message, contact_email, status, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url
  )
`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params

    const { data: project, error: loadError } = await supabase
      .from('gsch_projects')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!project) return errorResponse('Project not found', 404)

    const authz = await requireOrgRole(
      supabase,
      project.organization_id,
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
      .from('gsch_project_applications')
      .select(APP_SELECT)
      .eq('project_id', id)
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

    if (!APP_TYPES.includes(body.application_type)) {
      return errorResponse(
        'application_type must be express_interest or request_information',
        400
      )
    }

    const { data: project, error: loadError } = await supabase
      .from('gsch_projects')
      .select('id, organization_id, title, is_published')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!project) return errorResponse('Project not found', 404)
    if (!project.is_published) {
      return errorResponse('Project is not published', 400)
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
      .from('gsch_project_applications')
      .insert({
        project_id: id,
        organization_id: body.organization_id || null,
        applicant_user_id: user.id,
        application_type: body.application_type,
        message: body.message?.trim() || null,
        contact_email: body.contact_email?.trim() || null,
        status: 'submitted',
      })
      .select(APP_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'project_application_created',
      entity_type: 'gsch_project_application',
      entity_id: data.id,
      metadata: {
        project_id: id,
        application_type: body.application_type,
      },
    })

    const notifType =
      body.application_type === 'express_interest'
        ? 'gsch_project_interest'
        : 'gsch_project_info_request'
    await notifyGschOrgOwners(supabase, project.organization_id, {
      type: notifType,
      title:
        body.application_type === 'express_interest'
          ? 'Project interest received'
          : 'Project information request',
      message: `Someone expressed interest in “${project.title}”.`,
      data: {
        project_id: id,
        application_id: data.id,
        type: notifType,
      },
      excludeUserId: user.id,
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to submit application', 500)
  }
}
