'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Users } from '@/shared/icons'
import type { YouthProject } from '@/shared/types/youthLeadership'
import { YOUTH_CARD_INTERACTIVE, YOUTH_CHIP } from '@/features/youth-leadership/constants/nav'

function memberLabel(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`
}

export default function ProjectCard({
  project,
  busy = false,
  canManage = false,
  onJoin,
  onEdit,
  onDelete,
}: {
  project: YouthProject
  busy?: boolean
  canManage?: boolean
  onJoin?: (projectId: string) => void
  onEdit?: (project: YouthProject) => void
  onDelete?: (project: YouthProject) => void
}) {
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const members = project.member_count ?? 0
  const capacity = project.max_participants
  const fillPct =
    capacity != null && capacity > 0
      ? Math.min(100, Math.round((members / capacity) * 100))
      : null
  const seatsLeft =
    capacity == null ? null : Math.max(capacity - members, 0)
  const isMember = Boolean(
    project.my_membership &&
      ['active', 'invited', 'completed'].includes(project.my_membership.status)
  )
  const canJoin =
    Boolean(onJoin) &&
    !isMember &&
    ['approved', 'active'].includes(project.status)
  const skills = (project.skills_required || []).filter(Boolean).slice(0, 3)

  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
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
    <article className={`${YOUTH_CARD_INTERACTIVE} group relative flex h-full flex-col`}>
      {canManage ? (
        <div className="absolute right-3 top-3 z-10" ref={menuRef}>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-content-secondary transition hover:bg-surface-secondary hover:text-content disabled:opacity-50"
            aria-label={`Actions for ${project.title}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls={menuId}
            disabled={busy}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-border bg-surface py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-content transition hover:bg-surface-hover"
                onClick={() => {
                  setMenuOpen(false)
                  onEdit?.(project)
                }}
              >
                <Pencil className="h-4 w-4 shrink-0" />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete?.(project)
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Link
        href={`/youth-leadership/projects/${project.id}`}
        className={`block min-w-0 focus-visible:outline-none ${canManage ? 'pr-10' : ''}`}
      >
        <h3 className="text-[0.98rem] font-semibold leading-snug tracking-tight text-content transition group-hover:text-primary">
          {project.title}
        </h3>
        {project.description ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-content-secondary">
            {project.description}
          </p>
        ) : null}
      </Link>

      {skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span key={skill} className={YOUTH_CHIP}>
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        {fillPct != null ? (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-content-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Team capacity
              </span>
              <span className="tabular-nums">
                {members}
                {capacity != null ? ` / ${capacity}` : ''} ({fillPct}%)
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
              <div
                className={`h-full rounded-full ${
                  fillPct >= 90 ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            {seatsLeft != null ? (
              <p className="mt-1.5 text-xs text-content-tertiary">
                {seatsLeft === 0
                  ? 'Team full'
                  : `${seatsLeft} spot${seatsLeft === 1 ? '' : 's'} left`}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mb-4 inline-flex items-center gap-1.5 text-xs text-content-tertiary">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {memberLabel(members)}
          </p>
        )}

        <div className="flex gap-2 border-t border-border pt-3">
          <Link
            href={`/youth-leadership/projects/${project.id}`}
            className={`${
              canJoin ? 'btn-secondary' : 'btn-primary'
            } flex-1 text-sm`}
          >
            View project
          </Link>
          {canJoin ? (
            <button
              type="button"
              className="btn-primary flex-1 text-sm"
              disabled={busy}
              onClick={() => onJoin?.(project.id)}
            >
              Join
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
