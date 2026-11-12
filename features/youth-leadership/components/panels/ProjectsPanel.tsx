'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Search } from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import { YOUTH_CARD_INTERACTIVE } from '@/features/youth-leadership/constants/nav'
import type { YouthOrganization, YouthProject } from '@/shared/types/youthLeadership'

type OrgRow = YouthOrganization & { my_role?: string | null }

const EMPTY_FORM = {
  title: '',
  description: '',
  objective: '',
  organization_id: '',
  skills_required: '',
  max_participants: '',
}

export default function ProjectsPanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState<YouthProject[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const coordinatorOrgs = orgs.filter(
    (o) => o.my_role === 'admin' || o.my_role === 'coordinator'
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projectList, orgList] = await Promise.all([
        apiClient.get<YouthProject[]>('/api/youth-leadership/projects', {
          search: search || undefined,
          mine: mineOnly ? 1 : undefined,
        }),
        apiClient.get<OrgRow[]>('/api/youth-leadership/organizations'),
      ])
      setProjects(Array.isArray(projectList) ? projectList : [])
      setOrgs(Array.isArray(orgList) ? orgList : [])
    } catch (err) {
      setProjects([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [search, mineOnly])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, load])

  async function joinProject(projectId: string) {
    setBusy(true)
    try {
      await apiClient.post(`/api/youth-leadership/projects/${projectId}/members`, {
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

  async function createProject() {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    setBusy(true)
    try {
      const created = await apiClient.post<YouthProject>('/api/youth-leadership/projects', {
        title: form.title.trim(),
        description: form.description || null,
        objective: form.objective || null,
        organization_id: form.organization_id || null,
        skills_required: form.skills_required
          ? form.skills_required.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        max_participants: form.max_participants ? Number(form.max_participants) : null,
        status: form.organization_id ? 'pending_approval' : 'draft',
      })
      toast.success('Project created')
      setShowCreate(false)
      setForm(EMPTY_FORM)
      router.push(`/youth-leadership/projects/${created.id}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create project')
    } finally {
      setBusy(false)
    }
  }

  function closeCreate() {
    if (busy) return
    setShowCreate(false)
  }

  if (authLoading) return <YouthSkeleton count={4} />
  if (!user) return <EmptyState title="Sign in required" />

  return (
    <>
      <YouthSectionHeader
        title="Community projects"
        badge={
          !loading ? (
            <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
              {projects.length} listed
            </span>
          ) : null
        }
      >
        <button
          type="button"
          className={`btn-secondary ${mineOnly ? 'ring-1 ring-primary' : ''}`}
          onClick={() => setMineOnly((v) => !v)}
        >
          {mineOnly ? 'Showing mine' : 'My projects'}
        </button>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          Create project
        </button>
      </YouthSectionHeader>

      {loading ? (
        <YouthSkeleton count={4} />
      ) : (
        <div className="space-y-6">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput.trim())
            }}
          >
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search projects</span>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary"
                aria-hidden
              />
              <input
                className={`${YOUTH_FIELD} h-11 rounded-xl border-border/80 bg-surface pl-10 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search projects"
              />
            </label>
            <button type="submit" className="btn-secondary h-11 shrink-0 px-5">
              Search
            </button>
          </form>

          {projects.length === 0 ? (
            <EmptyState
              title="No projects found"
              description="Open community projects will appear here once approved and active."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((project) => {
                const isMember = Boolean(
                  project.my_membership &&
                    ['active', 'invited'].includes(project.my_membership.status)
                )
                return (
                  <article key={project.id} className={YOUTH_CARD_INTERACTIVE}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-content-tertiary">
                          {project.organization?.name || 'Community project'}
                        </p>
                        <Link
                          href={`/youth-leadership/projects/${project.id}`}
                          className="mt-0.5 block truncate text-base font-semibold text-content hover:text-primary"
                        >
                          {project.title}
                        </Link>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-content-secondary">
                        {project.description}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-content-tertiary">
                      {project.member_count ?? 0} members
                      {project.max_participants != null
                        ? ` · max ${project.max_participants}`
                        : ''}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/youth-leadership/projects/${project.id}`}
                        className="btn-secondary flex-1 text-sm"
                      >
                        View
                      </Link>
                      {!isMember && ['approved', 'active'].includes(project.status) ? (
                        <button
                          type="button"
                          className="btn-primary flex-1 text-sm"
                          disabled={busy}
                          onClick={() => joinProject(project.id)}
                        >
                          Join
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      <YouthFormModal
        open={showCreate}
        title="Create project"
        onClose={closeCreate}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={closeCreate}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={createProject}
            >
              {busy ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="project-title">Project name</YouthFieldLabel>
            <input
              id="project-title"
              className={YOUTH_FIELD}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Neighborhood clean-up drive"
              autoFocus
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="project-description">Description</YouthFieldLabel>
            <textarea
              id="project-description"
              className={`${YOUTH_FIELD} min-h-[88px] resize-y`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What is this project about?"
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="project-objective">Objective</YouthFieldLabel>
            <textarea
              id="project-objective"
              className={`${YOUTH_FIELD} min-h-[80px] resize-y`}
              value={form.objective}
              onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
              placeholder="What outcome are you aiming for?"
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="project-org">Organization (optional)</YouthFieldLabel>
            <select
              id="project-org"
              className={YOUTH_FIELD}
              value={form.organization_id}
              onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value }))}
            >
              <option value="">None</option>
              {coordinatorOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <YouthFieldLabel htmlFor="project-max">Max participants</YouthFieldLabel>
            <input
              id="project-max"
              className={YOUTH_FIELD}
              type="number"
              min={1}
              value={form.max_participants}
              onChange={(e) => setForm((f) => ({ ...f, max_participants: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="project-skills">
              Skills required (comma-separated)
            </YouthFieldLabel>
            <input
              id="project-skills"
              className={YOUTH_FIELD}
              value={form.skills_required}
              onChange={(e) => setForm((f) => ({ ...f, skills_required: e.target.value }))}
              placeholder="e.g. organizing, public speaking"
            />
          </div>
        </div>
      </YouthFormModal>
    </>
  )
}
