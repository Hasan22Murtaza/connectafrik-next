'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { BarChart3, Flag, MoreVertical } from '@/shared/icons'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import type { YouthProjectTask, YouthTaskStatus } from '@/shared/types/youthLeadership'

export type TaskCardRow = YouthProjectTask & {
  assignee?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

export type TaskMemberOption = {
  user_id: string
  label: string
}

const STATUS_OPTIONS: { id: YouthTaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Ready for QA' },
  { id: 'verified', label: 'Completed' },
]

const PRIORITY_TONE: Record<string, string> = {
  high: 'text-red-500',
  medium: 'text-amber-500',
  low: 'text-content-tertiary',
}

function formatDue(date: string | null) {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isOverdue(date: string | null, status: YouthTaskStatus) {
  if (!date || status === 'verified') return false
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return false
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return end.getTime() < Date.now()
}

export default function TaskCard({
  task,
  canProgress,
  isCoordinator,
  busy,
  members,
  onUpdate,
  draggable = false,
  overlay = false,
}: {
  task: TaskCardRow
  canProgress: boolean
  isCoordinator: boolean
  busy?: boolean
  members: TaskMemberOption[]
  onUpdate: (taskId: string, body: Record<string, unknown>) => void
  draggable?: boolean
  overlay?: boolean
}) {
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)

  const canDrag = draggable && !overlay && canProgress && !busy
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !canDrag,
    data: { status: task.status },
  })

  const assigneeName =
    task.assignee?.full_name || task.assignee?.username || 'Unassigned'
  const dueLabel = formatDue(task.due_date)
  const overdue = isOverdue(task.due_date, task.status)
  const createdLabel = formatDue(task.created_at)

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <article
      ref={(node) => {
        rootRef.current = node
        if (!overlay) setNodeRef(node)
      }}
      className={`relative rounded-xl border border-border/70 bg-surface p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        canDrag ? 'cursor-grab touch-none active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-30' : ''} ${overlay ? 'shadow-xl ring-1 ring-border' : ''}`}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
    >
      <h4 className="text-sm font-semibold leading-snug text-content line-clamp-2">
        {task.title}
      </h4>

      <div className="mt-2.5 flex items-center gap-2">
        <YouthAvatar
          src={task.assignee?.avatar_url}
          name={assigneeName}
          size="sm"
          className="!h-6 !w-6 text-[9px]"
        />
        <span className="min-w-0 flex-1 truncate text-xs text-content-secondary">
          {createdLabel ? (
            <>
              <span>{createdLabel}</span>
              {dueLabel ? (
                <>
                  <span className="text-content-tertiary"> — </span>
                  <span className={overdue ? 'font-medium text-red-500' : undefined}>
                    {dueLabel}
                  </span>
                </>
              ) : null}
            </>
          ) : dueLabel ? (
            <span className={overdue ? 'font-medium text-red-500' : undefined}>{dueLabel}</span>
          ) : (
            'No due date'
          )}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-content-tertiary" aria-hidden>
          <BarChart3
            className={`h-3.5 w-3.5 ${PRIORITY_TONE[task.priority] || PRIORITY_TONE.medium}`}
          />
          <Flag
            className={`h-3.5 w-3.5 ${PRIORITY_TONE[task.priority] || PRIORITY_TONE.medium}`}
          />
        </span>
        {!overlay && (canProgress || isCoordinator) ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-content-tertiary transition hover:bg-surface-secondary hover:text-content"
            aria-label="Task actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            disabled={busy}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((o) => !o)
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {task.description ? (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-content-secondary">
          {task.description}
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium capitalize text-amber-800 dark:text-amber-200">
          {task.priority}
        </span>
        {!overlay && task.status === 'completed' && isCoordinator ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-500/25 dark:text-emerald-300"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onUpdate(task.id, { status: 'verified' })
            }}
          >
            Verify
          </button>
        ) : null}
      </div>

      {!overlay && menuOpen ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-2 top-10 z-20 w-48 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
            Move to
          </p>
          {STATUS_OPTIONS.map(({ id, label }) => {
            const active = task.status === id
            const blocked =
              !canProgress || (id === 'verified' && !isCoordinator) || active
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                disabled={busy || blocked}
                className={
                  active
                    ? 'flex w-full items-center px-3 py-1.5 text-left text-sm font-medium text-primary'
                    : 'flex w-full items-center px-3 py-1.5 text-left text-sm text-content transition hover:bg-surface-secondary disabled:opacity-40'
                }
                onClick={() => {
                  setMenuOpen(false)
                  if (!active) onUpdate(task.id, { status: id })
                }}
              >
                {label}
              </button>
            )
          })}
          {isCoordinator ? (
            <>
              <div className="my-1 border-t border-border" />
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
                Assign
              </p>
              <button
                type="button"
                role="menuitem"
                disabled={busy || !task.assigned_to}
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-content transition hover:bg-surface-secondary disabled:opacity-40"
                onClick={() => {
                  setMenuOpen(false)
                  onUpdate(task.id, { assigned_to: null })
                }}
              >
                Unassigned
              </button>
              {members.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  role="menuitem"
                  disabled={busy || task.assigned_to === m.user_id}
                  className={
                    task.assigned_to === m.user_id
                      ? 'flex w-full items-center px-3 py-1.5 text-left text-sm font-medium text-primary'
                      : 'flex w-full items-center px-3 py-1.5 text-left text-sm text-content transition hover:bg-surface-secondary disabled:opacity-40'
                  }
                  onClick={() => {
                    setMenuOpen(false)
                    onUpdate(task.id, { assigned_to: m.user_id })
                  }}
                >
                  <span className="truncate">{m.label}</span>
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
