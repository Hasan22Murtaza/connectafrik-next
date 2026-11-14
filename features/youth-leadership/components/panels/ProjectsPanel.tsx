'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Search } from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import ProjectCard from '@/features/youth-leadership/components/ProjectCard'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
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

  const loadOrgs = useCallback(async () => {
    try {
      const orgList = await apiClient.get<OrgRow[]>('/api/youth-leadership/organizations')
      setOrgs(Array.isArray(orgList) ? orgList : [])
    } catch {
      /* create modal can still open without org options */
    }
  }, [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const projectList = await apiClient.get<YouthProject[]>('/api/youth-leadership/projects', {
        search: search || undefined,
        mine: mineOnly ? 1 : undefined,
        limit: 40,
      })
      setProjects(Array.isArray(projectList) ? projectList : [])
    } catch (err) {
      if (!opts?.silent) setProjects([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load projects')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [search, mineOnly])

  useEffect(() => {
    if (authLoading || !user) return
    loadOrgs()
  }, [authLoading, user?.id, loadOrgs])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function joinProject(projectId: string) {
    setBusy(true)
    try {
      await apiClient.post(`/api/youth-leadership/projects/${projectId}/members`, {
        action: 'join',
      })
      toast.success('Joined project')
      const now = new Date().toISOString()
      setProjects((list) =>
        list.map((p) => {
          if (p.id !== projectId) return p
          const next: YouthProject = {
            ...p,
            member_count: (p.member_count ?? 0) + 1,
            my_membership: {
              id: p.my_membership?.id || `local-${projectId}`,
              project_id: projectId,
              user_id: user?.id || '',
              role: 'participant',
              status: 'active',
              joined_at: p.my_membership?.joined_at || now,
              created_at: p.my_membership?.created_at || now,
              updated_at: now,
            },
          }
          return next
        })
      )
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
      setProjects((list) => {
        if (list.some((p) => p.id === created.id)) return list
        const now = new Date().toISOString()
        const next: YouthProject = {
          ...created,
          member_count: created.member_count ?? 1,
          my_membership: created.my_membership || {
            id: `local-${created.id}`,
            project_id: created.id,
            user_id: user?.id || '',
            role: 'coordinator',
            status: 'active',
            joined_at: now,
            created_at: now,
            updated_at: now,
          },
        }
        return [next, ...list]
      })
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
          aria-pressed={mineOnly}
          className={
            mineOnly
              ? 'btn-secondary ring-1 ring-primary/40 bg-primary/10 text-primary'
              : 'btn-secondary'
          }
          onClick={() => setMineOnly((v) => !v)}
        >
          {mineOnly ? 'Showing mine' : 'My projects'}
        </button>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-1.5"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create project
        </button>
      </YouthSectionHeader>

      {loading ? (
        <YouthSkeleton count={4} />
      ) : (
        <div className="space-y-5">
          <form
            className="flex overflow-hidden rounded-xl border border-border/80 bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15"
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
                className="h-11 w-full border-0 bg-transparent pl-10 pr-3 text-sm text-content outline-none placeholder:text-content-tertiary"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by title, skill, or organization"
              />
            </label>
            <button
              type="submit"
              className="shrink-0 border-l border-border/80 px-5 text-sm font-semibold text-content-secondary transition hover:bg-surface-secondary hover:text-content"
            >
              Search
            </button>
          </form>

          {projects.length === 0 ? (
            <EmptyState
              title={mineOnly || search ? 'No matching projects' : 'No projects yet'}
              description={
                mineOnly || search
                  ? 'Try clearing filters or search for a different keyword.'
                  : 'Create a community project or wait for organizations to publish open ones.'
              }
              action={
                !mineOnly && !search ? (
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-1.5"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Create project
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  busy={busy}
                  onJoin={joinProject}
                />
              ))}
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
