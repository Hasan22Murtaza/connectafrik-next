'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Users } from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import SafetyReportButton from '@/features/youth-leadership/components/SafetyReportButton'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import TasksBoard from '@/features/youth-leadership/components/TasksBoard'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import {
  YOUTH_CARD,
  YOUTH_CHIP,
  YOUTH_SECTION_TITLE,
} from '@/features/youth-leadership/constants/nav'
import type {
  YouthOrganization,
  YouthProject,
  YouthProjectMember,
  YouthProjectTask,
} from '@/shared/types/youthLeadership'

type OrgRow = YouthOrganization & { my_role?: string | null }

const EMPTY_TASK_FORM = {
  title: '',
  description: '',
  assigned_to: '',
  priority: 'medium',
  due_date: '',
}

type MemberRow = YouthProjectMember & {
  profile?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

type ProjectDetail = YouthProject & {
  members?: MemberRow[]
}

type TaskRow = YouthProjectTask & {
  assignee?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

function memberLabel(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`
}

export default function YouthProjectDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const { user, loading: authLoading } = useAuth()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM)

  const isCoordinator = useMemo(() => {
    if (!project || !user) return false
    if (project.created_by === user.id) return true
    return Boolean(
      project.my_membership &&
        project.my_membership.role === 'coordinator' &&
        project.my_membership.status === 'active'
    )
  }, [project, user])

  const canApproveProject = useMemo(() => {
    if (!project?.organization_id) return false
    const org = orgs.find((o) => o.id === project.organization_id)
    return org?.my_role === 'admin' || org?.my_role === 'coordinator'
  }, [project, orgs])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return
    if (!opts?.silent) setLoading(true)
    try {
      const [proj, taskList, orgList] = await Promise.all([
        apiClient.get<ProjectDetail>(`/api/youth-leadership/projects/${id}`),
        apiClient.get<TaskRow[]>(`/api/youth-leadership/projects/${id}/tasks`),
        apiClient.get<OrgRow[]>('/api/youth-leadership/organizations'),
      ])
      setProject(proj)
      setTasks(Array.isArray(taskList) ? taskList : [])
      setOrgs(Array.isArray(orgList) ? orgList : [])
    } catch (err) {
      if (!opts?.silent) setProject(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load project')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user || !id) return
    load()
  }, [authLoading, user?.id, id, load])

  async function join() {
    setBusy(true)
    try {
      await apiClient.post(`/api/youth-leadership/projects/${id}/members`, {
        action: 'join',
      })
      toast.success('Joined project')
      setProject((prev) => {
        if (!prev || !user) return prev
        const membership = {
          id: `local-${user.id}`,
          project_id: prev.id,
          user_id: user.id,
          role: 'participant' as const,
          status: 'active' as const,
          joined_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          profile: {
            id: user.id,
            username: null,
            full_name: null,
            avatar_url: null,
          },
        }
        const existing = (prev.members || []).filter((m) => m.user_id !== user.id)
        return {
          ...prev,
          member_count: (prev.member_count ?? existing.length) + 1,
          my_membership: membership,
          members: [...existing, membership],
        }
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to join')
    } finally {
      setBusy(false)
    }
  }

  async function approveProject() {
    setBusy(true)
    try {
      await apiClient.patch(`/api/youth-leadership/projects/${id}`, { status: 'approved' })
      toast.success('Project approved')
      setProject((prev) => (prev ? { ...prev, status: 'approved' } : prev))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update project')
    } finally {
      setBusy(false)
    }
  }

  async function createTask() {
    if (!taskForm.title.trim()) {
      toast.error('Task title is required')
      return
    }
    const assignedTo = taskForm.assigned_to || null
    setBusy(true)
    try {
      const created = await apiClient.post<TaskRow>(
        `/api/youth-leadership/projects/${id}/tasks`,
        {
          title: taskForm.title.trim(),
          description: taskForm.description || null,
          assigned_to: assignedTo,
          priority: taskForm.priority,
          due_date: taskForm.due_date || null,
        }
      )
      toast.success('Task created')
      setTaskForm(EMPTY_TASK_FORM)
      setShowTaskModal(false)
      const assignee = assignedTo
        ? (project?.members || []).find((m) => m.user_id === assignedTo)?.profile
        : null
      setTasks((list) => {
        if (list.some((t) => t.id === created.id)) return list
        return [
          {
            ...created,
            assignee: created.assignee || (assignee
              ? {
                  id: assignedTo,
                  username: assignee.username,
                  full_name: assignee.full_name,
                  avatar_url: assignee.avatar_url,
                }
              : null),
          },
          ...list,
        ]
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create task')
    } finally {
      setBusy(false)
    }
  }

  function closeTaskModal() {
    if (busy) return
    setShowTaskModal(false)
  }

  async function updateTask(taskId: string, body: Record<string, unknown>) {
    const previous = tasks
    setTasks((list) =>
      list.map((task) => {
        if (task.id !== taskId) return task
        const next: TaskRow = { ...task, ...(body as Partial<TaskRow>) }

        if ('assigned_to' in body) {
          const uid = (body.assigned_to as string | null) || null
          next.assigned_to = uid
          if (!uid) {
            next.assignee = null
          } else {
            const member = (project?.members || []).find((m) => m.user_id === uid)
            next.assignee = member?.profile
              ? {
                  id: member.user_id,
                  username: member.profile.username,
                  full_name: member.profile.full_name,
                  avatar_url: member.profile.avatar_url,
                }
              : task.assignee
          }
        }

        if (typeof body.status === 'string') {
          next.status = body.status as TaskRow['status']
          if (body.status === 'completed' || body.status === 'verified') {
            next.completed_at = task.completed_at || new Date().toISOString()
          }
          if (body.status === 'todo' || body.status === 'in_progress') {
            next.completed_at = null
            next.verified_by = null
            next.verified_at = null
          }
          if (body.status === 'verified') {
            next.verified_by = user?.id || task.verified_by
            next.verified_at = new Date().toISOString()
          }
        }

        return next
      })
    )

    try {
      await apiClient.patch(
        `/api/youth-leadership/projects/${id}/tasks/${taskId}`,
        body
      )
    } catch (err) {
      setTasks(previous)
      toast.error(err instanceof ApiError ? err.message : 'Failed to update task')
    }
  }

  if (authLoading || loading) {
    return (
      <YouthShell title="Project">
        <YouthSkeleton count={2} />
      </YouthShell>
    )
  }

  if (!user) {
    return (
      <YouthShell title="Project">
        <EmptyState title="Sign in required" />
      </YouthShell>
    )
  }

  if (!project) {
    return (
      <YouthShell title="Project">
        <EmptyState
          title="Project not found"
          action={
            <Link href="/youth-leadership/community?tab=projects" className="btn-primary">
              Back to projects
            </Link>
          }
        />
      </YouthShell>
    )
  }

  const isMember = Boolean(
    project.my_membership &&
      ['active', 'invited', 'completed'].includes(project.my_membership.status)
  )
  const memberCount = project.member_count ?? project.members?.length ?? 0
  const capacity = project.max_participants
  const fillPct =
    capacity != null && capacity > 0
      ? Math.min(100, Math.round((memberCount / capacity) * 100))
      : null
  const skills = (project.skills_required || []).filter(Boolean)
  const completedTasks = tasks.filter((t) => t.status === 'verified').length
  const taskMembers = (project.members || [])
    .filter((m) => m.status === 'active')
    .map((m) => ({
      user_id: m.user_id,
      label: m.profile?.full_name || m.profile?.username || m.user_id,
    }))

  return (
    <YouthShell
      title={project.title}
      subtitle={project.organization?.name || 'Community project'}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/youth-leadership/community?tab=projects"
            className="btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Projects
          </Link>
          <SafetyReportButton
            context={{
              project_id: project.id,
              organization_id: project.organization_id,
            }}
          />
        </div>
      }
    >
      {project.status === 'pending_approval' ? (
        <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <p>
            This project is waiting for organization approval. Members and tasks can still be
            prepared while it is under review.
          </p>
          {canApproveProject ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={busy}
                onClick={approveProject}
              >
                Approve project
              </button>
              <Link
                href="/youth-leadership/organization?tab=projects"
                className="btn-secondary text-sm"
              >
                Review in Organization
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className={YOUTH_CARD}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            {isCoordinator ? (
              <span className={`${YOUTH_CHIP} font-medium text-content`}>Coordinator</span>
            ) : null}
            {isMember && !isCoordinator ? (
              <span className={`${YOUTH_CHIP} font-medium capitalize text-content`}>
                {project.my_membership?.role || 'Member'}
              </span>
            ) : null}
          </div>

          {project.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
              {project.description}
            </p>
          ) : (
            <p className="mt-4 text-sm text-content-tertiary">No description yet.</p>
          )}

          {project.objective ? (
            <div className="mt-5 rounded-xl bg-surface-secondary/70 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                Objective
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content">
                {project.objective}
              </p>
            </div>
          ) : null}

          {skills.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span key={skill} className={YOUTH_CHIP}>
                  {skill}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm text-content-secondary">
              <span className="inline-flex items-center gap-1.5 font-medium text-content">
                <Users className="h-4 w-4 shrink-0 text-content-tertiary" aria-hidden />
                {memberLabel(memberCount)}
              </span>
              {capacity != null ? (
                <span className="tabular-nums text-content-tertiary">
                  max {capacity}
                  {fillPct != null ? ` · ${fillPct}%` : ''}
                </span>
              ) : null}
            </div>
            {fillPct != null ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                <div
                  className={`h-full rounded-full ${
                    fillPct >= 90 ? 'bg-emerald-500' : 'bg-primary'
                  }`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            ) : null}
          </div>

          {!isMember && ['approved', 'active'].includes(project.status) ? (
            <button
              type="button"
              className="btn-primary mt-5"
              disabled={busy}
              onClick={join}
            >
              Join project
            </button>
          ) : null}
          {project.my_membership?.status === 'invited' ? (
            <button
              type="button"
              className="btn-primary mt-5"
              disabled={busy}
              onClick={join}
            >
              Accept invitation
            </button>
          ) : null}
        </section>

        <section className={`${YOUTH_CARD} flex flex-col`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={YOUTH_SECTION_TITLE}>Members</h2>
            <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium tabular-nums text-content-secondary">
              {memberCount}
            </span>
          </div>

          {!project.members?.length ? (
            <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 px-4 py-10 text-center">
              <Users className="mb-3 h-5 w-5 text-content-tertiary" aria-hidden />
              <p className="text-sm font-medium text-content">No members yet</p>
              <p className="mt-1 text-xs text-content-tertiary">
                Invite teammates or open the project for join requests.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border/70">
              {project.members.map((m) => {
                const memberName =
                  m.profile?.full_name || m.profile?.username || 'Member'
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-sm text-content">
                      <YouthAvatar
                        src={m.profile?.avatar_url}
                        name={memberName}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{memberName}</span>
                        <span className="block truncate text-xs capitalize text-content-tertiary">
                          {m.status}
                        </span>
                      </span>
                    </span>
                    <span className={`${YOUTH_CHIP} shrink-0 capitalize`}>{m.role}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className={`${YOUTH_CARD} mt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className={YOUTH_SECTION_TITLE}>Tasks</h2>
            <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
              {tasks.length === 0
                ? 'none yet'
                : `${completedTasks}/${tasks.length} done`}
            </span>
          </div>
          {isCoordinator ? (
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 text-sm"
              onClick={() => setShowTaskModal(true)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add task
            </button>
          ) : null}
        </div>

        {tasks.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No tasks yet"
              description={
                isCoordinator
                  ? 'Break the project into clear tasks and assign them to active members.'
                  : 'Tasks will show up here once a coordinator adds them.'
              }
              action={
                isCoordinator ? (
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-1.5"
                    onClick={() => setShowTaskModal(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add task
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <TasksBoard
            tasks={tasks}
            currentUserId={user?.id}
            isCoordinator={isCoordinator}
            busy={busy}
            members={taskMembers}
            onUpdate={updateTask}
          />
        )}
      </section>

      <YouthFormModal
        open={showTaskModal}
        title="Add task"
        description="Assign work items to active project members."
        onClose={closeTaskModal}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={closeTaskModal}
            >
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={createTask}>
              {busy ? 'Adding…' : 'Add task'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="task-title">Task title</YouthFieldLabel>
            <input
              id="task-title"
              className={YOUTH_FIELD}
              value={taskForm.title}
              onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="task-description">Description</YouthFieldLabel>
            <textarea
              id="task-description"
              className={`${YOUTH_FIELD} min-h-[72px]`}
              value={taskForm.description}
              onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="task-assignee">Assign to</YouthFieldLabel>
            <select
              id="task-assignee"
              className={YOUTH_FIELD}
              value={taskForm.assigned_to}
              onChange={(e) => setTaskForm((f) => ({ ...f, assigned_to: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {(project.members || [])
                .filter((m) => m.status === 'active')
                .map((m) => (
                  <option key={m.id} value={m.user_id}>
                    {m.profile?.full_name || m.profile?.username || m.user_id}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <YouthFieldLabel htmlFor="task-priority">Priority</YouthFieldLabel>
            <select
              id="task-priority"
              className={YOUTH_FIELD}
              value={taskForm.priority}
              onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <YouthFieldLabel htmlFor="task-due">Due date</YouthFieldLabel>
            <input
              id="task-due"
              className={YOUTH_FIELD}
              type="date"
              value={taskForm.due_date}
              onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
        </div>
      </YouthFormModal>
    </YouthShell>
  )
}
