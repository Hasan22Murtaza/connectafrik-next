'use client'

import Link from 'next/link'
import { Users } from '@/shared/icons'
import type { YouthProject } from '@/shared/types/youthLeadership'
import { YOUTH_CARD_INTERACTIVE, YOUTH_CHIP } from '@/features/youth-leadership/constants/nav'
import StatusBadge from './StatusBadge'
import YouthAvatar from './YouthAvatar'

function memberLabel(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`
}

export default function ProjectCard({
  project,
  busy = false,
  onJoin,
}: {
  project: YouthProject
  busy?: boolean
  onJoin?: (projectId: string) => void
}) {
  const orgName = project.organization?.name || 'Community project'
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

  return (
    <article className={`${YOUTH_CARD_INTERACTIVE} group flex h-full flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <YouthAvatar name={orgName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-content">{orgName}</p>
            {isMember ? (
              <p className="mt-0.5 text-xs capitalize text-content-tertiary">
                Your role · {project.my_membership?.role || 'member'}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-content-tertiary">Open community project</p>
            )}
          </div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <Link
        href={`/youth-leadership/projects/${project.id}`}
        className="mt-4 block min-w-0 focus-visible:outline-none"
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
