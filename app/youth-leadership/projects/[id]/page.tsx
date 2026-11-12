'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import SafetyReportButton from '@/features/youth-leadership/components/SafetyReportButton'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import { YOUTH_CARD, YOUTH_SECTION_TITLE } from '@/features/youth-leadership/constants/nav'
import type {
  YouthProject,
  YouthProjectMember,
  YouthProjectTask,
  YouthTaskStatus,
} from '@/shared/types/youthLeadership'

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

export default function YouthProjectDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const { user, loading: authLoading } = useAuth()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
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

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [proj, taskList] = await Promise.all([
        apiClient.get<ProjectDetail>(`/api/youth-leadership/projects/${id}`),
        apiClient.get<TaskRow[]>(`/api/youth-leadership/projects/${id}/tasks`),
      ])
      setProject(proj)
      setTasks(Array.isArray(taskList) ? taskList : [])
    } catch (err) {
      setProject(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user || !id) return
    load()
  }, [authLoading, user, id, load])

  async function join() {
    setBusy(true)
    try {
      await apiClient.post(`/api/youth-leadership/projects/${id}/members`, {
        action: 'join',
      })
      toast.success('Joined project')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to join')
    } finally {
      setBusy(false)
    }
  }

  async function createTask() {
    if (!taskForm.title.trim()) {
      toast.error('Task title is required')
      return
    }
    setBusy(true)
    try {
      await apiClient.post(`/api/youth-leadership/projects/${id}/tasks`, {
        title: taskForm.title.trim(),
        description: taskForm.description || null,
        assigned_to: taskForm.assigned_to || null,
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
      })
      toast.success('Task created')
      setTaskForm(EMPTY_TASK_FORM)
      setShowTaskModal(false)
      await load()
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
    setBusy(true)
    try {
      await apiClient.patch(
        `/api/youth-leadership/projects/${id}/tasks/${taskId}`,
        body
      )
      toast.success('Task updated')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update task')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || loading) {
    return (
      <YouthShell title="Project">
        <div className={`${YOUTH_CARD} h-56 animate-pulse bg-surface-secondary`} />
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
            <Link href="/youth-leadership/projects" className="btn-primary">
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

  return (
    <YouthShell
      title={project.title}
      subtitle={project.organization?.name || 'Community project'}
      actions={
        <SafetyReportButton
          context={{
            project_id: project.id,
            organization_id: project.organization_id,
          }}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className={YOUTH_CARD}>
          <StatusBadge status={project.status} />
          {project.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-content-secondary">
              {project.description}
            </p>
          ) : null}
          {project.objective ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-content-primary">Objective</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-content-secondary">
                {project.objective}
              </p>
            </div>
          ) : null}
          <p className="mt-4 text-sm text-content-secondary">
            Members: {project.member_count ?? project.members?.length ?? 0}
            {project.max_participants != null ? ` / ${project.max_participants}` : ''}
          </p>
          {!isMember && ['approved', 'active'].includes(project.status) ? (
            <button
              type="button"
              className="btn-primary mt-4"
              disabled={busy}
              onClick={join}
            >
              Join project
            </button>
          ) : null}
          {project.my_membership?.status === 'invited' ? (
            <button
              type="button"
              className="btn-primary mt-4"
              disabled={busy}
              onClick={join}
            >
              Accept invitation
            </button>
          ) : null}
        </section>

        <section className={YOUTH_CARD}>
          <h2 className={YOUTH_SECTION_TITLE}>Members</h2>
          {!project.members?.length ? (
            <p className="mt-3 text-sm text-content-secondary">No members yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {project.members.map((m) => {
                const memberName =
                  m.profile?.full_name || m.profile?.username || 'Member'
                return (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-content-primary">
                    <YouthAvatar
                      src={m.profile?.avatar_url}
                      name={memberName}
                      size="sm"
                    />
                    <span className="truncate">{memberName}</span>
                  </span>
                  <span className="shrink-0 text-xs capitalize text-content-tertiary">
                    {m.role} · {m.status}
                  </span>
                </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className={`${YOUTH_CARD} mt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={YOUTH_SECTION_TITLE}>Tasks</h2>
          {isCoordinator ? (
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => setShowTaskModal(true)}
            >
              Add task
            </button>
          ) : null}
        </div>

        {tasks.length === 0 ? (
          <p className="mt-4 text-sm text-content-secondary">No tasks yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tasks.map((task) => {
              const canProgress =
                isCoordinator || (user && task.assigned_to === user.id)
              return (
                <li key={task.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <YouthAvatar
                        src={task.assignee?.avatar_url}
                        name={
                          task.assignee?.full_name ||
                          task.assignee?.username ||
                          'Unassigned'
                        }
                        size="sm"
                      />
                      <div>
                        <p className="font-medium text-content-primary">{task.title}</p>
                        {task.description ? (
                          <p className="mt-1 text-sm text-content-secondary">
                            {task.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-content-tertiary">
                          {task.assignee?.full_name ||
                            task.assignee?.username ||
                            'Unassigned'}
                          {task.due_date
                            ? ` · due ${new Date(task.due_date).toLocaleDateString()}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                  {canProgress ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(
                        [
                          'todo',
                          'in_progress',
                          'completed',
                        ] as YouthTaskStatus[]
                      ).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="btn-secondary text-sm capitalize"
                          disabled={busy || task.status === status}
                          onClick={() => updateTask(task.id, { status })}
                        >
                          {status.replace(/_/g, ' ')}
                        </button>
                      ))}
                      {isCoordinator && task.status === 'completed' ? (
                        <button
                          type="button"
                          className="btn-primary text-sm"
                          disabled={busy}
                          onClick={() => updateTask(task.id, { status: 'verified' })}
                        >
                          Verify
                        </button>
                      ) : null}
                      {isCoordinator ? (
                        <select
                          className="rounded-lg border border-border bg-surface-primary px-2 py-1 text-sm"
                          value={task.assigned_to || ''}
                          disabled={busy}
                          onChange={(e) =>
                            updateTask(task.id, {
                              assigned_to: e.target.value || null,
                            })
                          }
                        >
                          <option value="">Unassigned</option>
                          {(project.members || [])
                            .filter((m) => m.status === 'active')
                            .map((m) => (
                              <option key={m.id} value={m.user_id}>
                                {m.profile?.full_name ||
                                  m.profile?.username ||
                                  m.user_id}
                              </option>
                            ))}
                        </select>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
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
