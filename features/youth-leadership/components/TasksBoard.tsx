'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CheckCircle2, Clock } from '@/shared/icons'
import TaskCard, {
  type TaskCardRow,
  type TaskMemberOption,
} from '@/features/youth-leadership/components/TaskCard'
import type { YouthTaskStatus } from '@/shared/types/youthLeadership'
import type { LucideIcon } from '@/shared/icons'

const COLUMNS: {
  id: YouthTaskStatus
  label: string
  icon: LucideIcon
  iconClass: string
}[] = [
  {
    id: 'todo',
    label: 'To Do',
    icon: Clock,
    iconClass: 'text-content-tertiary',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    icon: Clock,
    iconClass: 'text-amber-500',
  },
  {
    id: 'completed',
    label: 'Ready for QA',
    icon: Clock,
    iconClass: 'text-sky-500',
  },
  {
    id: 'verified',
    label: 'Completed',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
  },
]

const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.id))

function canDropStatus(
  status: YouthTaskStatus,
  canProgress: boolean,
  isCoordinator: boolean
) {
  if (status === 'verified') return isCoordinator
  return canProgress
}

function TaskColumn({
  id,
  label,
  icon: Icon,
  iconClass,
  tasks,
  currentUserId,
  isCoordinator,
  busy,
  members,
  onUpdate,
  isOver,
}: {
  id: YouthTaskStatus
  label: string
  icon: LucideIcon
  iconClass: string
  tasks: TaskCardRow[]
  currentUserId?: string | null
  isCoordinator: boolean
  busy?: boolean
  members: TaskMemberOption[]
  onUpdate: (taskId: string, body: Record<string, unknown>) => void | Promise<void>
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <section
      ref={setNodeRef}
      className={`flex w-[16.5rem] shrink-0 flex-col rounded-2xl transition sm:w-auto ${
        isOver
          ? 'bg-primary/10 ring-2 ring-primary/35'
          : 'bg-surface-secondary/80'
      }`}
      aria-label={`${label} column`}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-content">
          {label}{' '}
          <span className="font-medium text-content-tertiary">({tasks.length})</span>
        </h3>
      </header>

      <ul className="flex min-h-[6rem] max-h-[28rem] flex-col gap-2.5 overflow-y-auto px-2.5 pb-3">
        {tasks.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-content-tertiary">
            {isOver ? 'Drop here' : 'No tasks'}
          </li>
        ) : (
          tasks.map((task) => {
            const canProgress =
              isCoordinator ||
              Boolean(currentUserId && task.assigned_to === currentUserId)
            return (
              <li key={task.id}>
                <TaskCard
                  task={task}
                  canProgress={canProgress}
                  isCoordinator={isCoordinator}
                  busy={busy}
                  members={members}
                  onUpdate={onUpdate}
                  draggable
                />
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}

export default function TasksBoard({
  tasks,
  currentUserId,
  isCoordinator,
  busy,
  members,
  onUpdate,
}: {
  tasks: TaskCardRow[]
  currentUserId?: string | null
  isCoordinator: boolean
  busy?: boolean
  members: TaskMemberOption[]
  onUpdate: (taskId: string, body: Record<string, unknown>) => void | Promise<void>
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<YouthTaskStatus | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) || null : null

  function resolveColumnId(overId: string | number | undefined | null): YouthTaskStatus | null {
    if (overId == null) return null
    const id = String(overId)
    if (COLUMN_IDS.has(id)) return id as YouthTaskStatus
    const task = tasks.find((t) => t.id === id)
    return task?.status ?? null
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragOver(event: DragOverEvent) {
    setOverColumnId(resolveColumnId(event.over?.id))
  }

  function onDragCancel() {
    setActiveId(null)
    setOverColumnId(null)
  }

  function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id)
    const nextStatus = resolveColumnId(event.over?.id)
    const task = tasks.find((t) => t.id === taskId)
    setActiveId(null)
    setOverColumnId(null)

    if (!task || !nextStatus || nextStatus === task.status || busy) return

    const canProgress =
      isCoordinator || Boolean(currentUserId && task.assigned_to === currentUserId)

    if (!canDropStatus(nextStatus, canProgress, isCoordinator)) return

    void onUpdate(taskId, { status: nextStatus })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="mt-5 -mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-3 px-1 sm:min-w-0 sm:grid sm:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const columnTasks = tasks.filter(
              (t) => t.status === col.id && t.id !== activeId
            )
            return (
              <TaskColumn
                key={col.id}
                id={col.id}
                label={col.label}
                icon={col.icon}
                iconClass={col.iconClass}
                tasks={columnTasks}
                currentUserId={currentUserId}
                isCoordinator={isCoordinator}
                busy={busy}
                members={members}
                onUpdate={onUpdate}
                isOver={overColumnId === col.id}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[15.5rem] rotate-[2deg] opacity-95 shadow-lg">
            <TaskCard
              task={activeTask}
              canProgress={false}
              isCoordinator={false}
              members={[]}
              onUpdate={() => {}}
              overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
