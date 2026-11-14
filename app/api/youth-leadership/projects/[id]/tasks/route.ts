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

async function canCoordinate(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase'],
  project: { id: string; created_by: string; organization_id: string | null },
  userId: string
): Promise<boolean> {
  if (project.created_by === userId) return true
  if (project.organization_id) {
    const authz = await requireOrgRole(
      supabase,
      project.organization_id,
      userId,
      'coordinator'
    )
    if (authz.ok) return true
  }
  const { data } = await supabase
    .from('youth_project_members')
    .select('id')
    .eq('project_id', project.id)
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
      .from('youth_project_tasks')
      .select(
        `
        id, title, description, priority, due_date, status, assigned_to,
        completed_at, verified_at, created_at,
        assignee:profiles!assigned_to(id, username, full_name, avatar_url)
      `
      )
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load tasks', 500)
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

    const { data: project } = await supabase
      .from('youth_projects')
      .select('id, title, created_by, organization_id')
      .eq('id', projectId)
      .maybeSingle()

    if (!project) return errorResponse('Project not found', 404)

    const ok = await canCoordinate(supabase, project, user.id)
    if (!ok) return forbiddenResponse('Only coordinators can create tasks.')

    const body = await request.json()
    if (!body.title?.trim()) return errorResponse('title is required', 400)

    const payload = {
      project_id: projectId,
      assigned_to: body.assigned_to ?? null,
      title: String(body.title).trim(),
      description: body.description ?? null,
      priority: body.priority || 'medium',
      due_date: body.due_date ?? null,
      status: 'todo',
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('youth_project_tasks')
      .insert(payload)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    if (payload.assigned_to && payload.assigned_to !== user.id) {
      await notifyYouthUser({
        user_id: payload.assigned_to,
        type: 'youth_project_task',
        title: 'New project task',
        message: `You were assigned a task on ${project.title}.`,
        data: {
          project_id: projectId,
          task_id: data.id,
          href: `/youth-leadership/projects/${projectId}`,
        },
      })
    }

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create task', 500)
  }
}
