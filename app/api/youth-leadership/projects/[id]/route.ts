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
  isPlatformYouthAdmin,
  requireOrgRole,
} from '@/lib/youth-leadership/auth'

const PROJECT_SELECT = `
  *,
  organization:youth_organizations!organization_id(id, name, logo_url)
`

type Params = { params: Promise<{ id: string }> }

async function canManageProject(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase'],
  userId: string,
  project: { created_by: string; organization_id: string | null }
): Promise<boolean> {
  if (project.created_by === userId) return true
  if (await isPlatformYouthAdmin(supabase, userId)) return true
  if (project.organization_id) {
    const authz = await requireOrgRole(
      supabase,
      project.organization_id,
      userId,
      'coordinator'
    )
    if (authz.ok) return true
  }
  const { data: membership } = await supabase
    .from('youth_project_members')
    .select('role, status')
    .eq('project_id', (project as any).id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('role', 'coordinator')
    .maybeSingle()
  return Boolean(membership)
}

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

    const { data: project, error } = await supabase
      .from('youth_projects')
      .select(PROJECT_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!project) return errorResponse('Project not found', 404)

    const [{ data: members }, { data: myMembership }, { count }] = await Promise.all([
      supabase
        .from('youth_project_members')
        .select(
          `
          id, project_id, user_id, role, status, joined_at, created_at,
          profile:profiles!user_id(id, username, full_name, avatar_url)
        `
        )
        .eq('project_id', id)
        .in('status', ['invited', 'active', 'completed']),
      supabase
        .from('youth_project_members')
        .select('id, project_id, user_id, role, status, joined_at')
        .eq('project_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('youth_project_members')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', id)
        .in('status', ['active', 'invited']),
    ])

    return jsonResponse({
      ...project,
      members: members || [],
      member_count: count ?? (members || []).length,
      my_membership: myMembership || null,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load project', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data: existing } = await supabase
      .from('youth_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return errorResponse('Project not found', 404)

    const allowedManage = await canManageProject(supabase, user.id, {
      ...existing,
      id,
    } as any)
    if (!allowedManage) return forbiddenResponse('Not authorized to update this project.')

    const allowed: Record<string, unknown> = {}
    for (const key of [
      'title',
      'description',
      'objective',
      'skills_required',
      'max_participants',
      'status',
      'start_date',
      'end_date',
      'milestones',
      'program_id',
    ] as const) {
      if (body[key] !== undefined) allowed[key] = body[key]
    }

    // Only org coordinator / platform admin can approve
    if (body.status === 'approved' && existing.status !== 'approved') {
      let canApprove = await isPlatformYouthAdmin(supabase, user.id)
      if (!canApprove && existing.organization_id) {
        const authz = await requireOrgRole(
          supabase,
          existing.organization_id,
          user.id,
          'coordinator'
        )
        canApprove = authz.ok
      }
      if (!canApprove) {
        return forbiddenResponse('Only organization coordinators can approve projects.')
      }
      allowed.approved_by = user.id
      allowed.approved_at = new Date().toISOString()
    }

    if (Object.keys(allowed).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data, error } = await supabase
      .from('youth_projects')
      .update(allowed)
      .eq('id', id)
      .select(PROJECT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update project', 500)
  }
}
