import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole } from '@/lib/youth-leadership/auth'
import type { YouthTaskStatus } from '@/shared/types/youthLeadership'

type Params = { params: Promise<{ id: string; taskId: string }> }

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

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: projectId, taskId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))

    const [{ data: project }, { data: task }] = await Promise.all([
      supabase
        .from('youth_projects')
        .select('id, created_by, organization_id')
        .eq('id', projectId)
        .maybeSingle(),
      supabase
        .from('youth_project_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('project_id', projectId)
        .maybeSingle(),
    ])

    if (!project) return errorResponse('Project not found', 404)
    if (!task) return errorResponse('Task not found', 404)

    const isCoordinator = await canCoordinate(supabase, project, user.id)
    const isAssignee = task.assigned_to === user.id

    if (!isCoordinator && !isAssignee) {
      return forbiddenResponse('Not authorized to update this task.')
    }

    const updates: Record<string, unknown> = {}
    const nextStatus = body.status as YouthTaskStatus | undefined

    if (nextStatus) {
      if (nextStatus === 'verified') {
        if (!isCoordinator) {
          return forbiddenResponse('Only coordinators can verify tasks.')
        }
        updates.status = 'verified'
        updates.verified_by = user.id
        updates.verified_at = new Date().toISOString()
        if (!task.completed_at) {
          updates.completed_at = new Date().toISOString()
        }
      } else if (['todo', 'in_progress', 'completed'].includes(nextStatus)) {
        if (!isAssignee && !isCoordinator) {
          return forbiddenResponse('Only the assignee can update task progress.')
        }
        updates.status = nextStatus
        if (nextStatus === 'completed') {
          updates.completed_at = new Date().toISOString()
        }
        if (nextStatus === 'todo' || nextStatus === 'in_progress') {
          updates.completed_at = null
          updates.verified_by = null
          updates.verified_at = null
        }
      } else {
        return errorResponse('Invalid task status.', 400)
      }
    }

    if (isCoordinator) {
      for (const key of [
        'title',
        'description',
        'priority',
        'due_date',
        'assigned_to',
      ] as const) {
        if (body[key] !== undefined) updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data, error } = await supabase
      .from('youth_project_tasks')
      .update(updates)
      .eq('id', taskId)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update task', 500)
  }
}
