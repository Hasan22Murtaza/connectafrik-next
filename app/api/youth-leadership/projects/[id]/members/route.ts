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
} from '@/lib/youth-leadership/auth'
import { notifyYouthUser } from '@/lib/youth-leadership/notify'

type Params = { params: Promise<{ id: string }> }

async function isProjectCoordinator(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase'],
  projectId: string,
  userId: string,
  organizationId: string | null,
  createdBy: string
): Promise<boolean> {
  if (createdBy === userId) return true
  if (organizationId) {
    const authz = await requireOrgRole(supabase, organizationId, userId, 'coordinator')
    if (authz.ok) return true
  }
  const { data } = await supabase
    .from('youth_project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('role', 'coordinator')
    .eq('status', 'active')
    .maybeSingle()
  return Boolean(data)
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

    const { data, error } = await supabase
      .from('youth_project_members')
      .select(
        `
        *,
        profile:profiles!user_id(id, username, full_name, avatar_url)
      `
      )
      .eq('project_id', id)
      .order('created_at', { ascending: true })

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load members', 500)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const body = await request.json().catch(() => ({}))
    const action = (body.action || 'join') as 'join' | 'invite'

    const { data: project } = await supabase
      .from('youth_projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle()

    if (!project) return errorResponse('Project not found', 404)

    if (action === 'invite') {
      const targetUserId = body.user_id as string
      if (!targetUserId) return errorResponse('user_id is required for invite', 400)

      const canInvite = await isProjectCoordinator(
        supabase,
        projectId,
        user.id,
        project.organization_id,
        project.created_by
      )
      if (!canInvite) return forbiddenResponse('Only coordinators can invite members.')

      if (project.max_participants != null) {
        const { count } = await supabase
          .from('youth_project_members')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .in('status', ['active', 'invited'])
        if ((count || 0) >= project.max_participants) {
          return errorResponse('Project is at capacity.', 400)
        }
      }

      const role = body.role === 'volunteer' ? 'volunteer' : 'participant'
      const { data: existing } = await supabase
        .from('youth_project_members')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('user_id', targetUserId)
        .maybeSingle()

      let result
      if (existing) {
        const { data, error } = await supabase
          .from('youth_project_members')
          .update({ role, status: 'invited' })
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) return errorResponse(error.message, 400)
        result = data
      } else {
        const { data, error } = await supabase
          .from('youth_project_members')
          .insert({
            project_id: projectId,
            user_id: targetUserId,
            role,
            status: 'invited',
          })
          .select('*')
          .single()
        if (error) return errorResponse(error.message, 400)
        result = data
      }

      await notifyYouthUser({
        user_id: targetUserId,
        type: 'youth_project_invitation',
        title: 'Project invitation',
        message: `You were invited to join ${project.title}.`,
        data: {
          project_id: projectId,
          href: `/youth-leadership/projects/${projectId}`,
        },
      })

      return jsonResponse(result, existing ? 200 : 201)
    }

    // join
    if (!['approved', 'active'].includes(project.status) && project.created_by !== user.id) {
      return errorResponse('This project is not open for joining.', 400)
    }

    if (project.max_participants != null) {
      const { count } = await supabase
        .from('youth_project_members')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['active', 'invited'])
      if ((count || 0) >= project.max_participants) {
        return errorResponse('Project is at capacity.', 400)
      }
    }

    const { data: existing } = await supabase
      .from('youth_project_members')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing && ['active', 'invited'].includes(existing.status)) {
      if (existing.status === 'invited') {
        const { data, error } = await supabase
          .from('youth_project_members')
          .update({
            status: 'active',
            joined_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) return errorResponse(error.message, 400)
        return jsonResponse(data)
      }
      return errorResponse('You are already a member of this project.', 400)
    }

    const role = body.role === 'volunteer' ? 'volunteer' : 'participant'
    let result
    if (existing) {
      const { data, error } = await supabase
        .from('youth_project_members')
        .update({
          role,
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      result = data
    } else {
      const { data, error } = await supabase
        .from('youth_project_members')
        .insert({
          project_id: projectId,
          user_id: user.id,
          role,
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      result = data
    }

    return jsonResponse(result, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update membership', 500)
  }
}
