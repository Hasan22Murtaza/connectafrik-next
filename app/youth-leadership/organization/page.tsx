'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import VerifiedBadge from '@/features/youth-leadership/components/VerifiedBadge'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import { useYouthTab } from '@/features/youth-leadership/hooks/useYouthTab'
import {
  YOUTH_CARD,
  YOUTH_ORGANIZATION_TABS,
  YOUTH_SECTION_TITLE,
  YOUTH_SELECT,
} from '@/features/youth-leadership/constants/nav'
import type {
  YouthOrganization,
  YouthProgram,
  YouthProgramApplication,
  YouthProgramCategory,
  YouthProject,
} from '@/shared/types/youthLeadership'

type OrgRow = YouthOrganization & { my_role?: string | null }

type ProgramsPayload = {
  data: YouthProgram[]
}

type Analytics = {
  organization_id: string
  total_programs: number
  active_programs: number
  total_applications: number
  accepted_applications: number
  pending_applications: number
  completion_rate: number
  upcoming_events: number
}

type ApplicationWithApplicant = YouthProgramApplication & {
  applicant?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

const EMPTY_ORG_FORM = {
  name: '',
  description: '',
  country: '',
  region: '',
  website: '',
}

const EMPTY_PROGRAM_FORM = {
  title: '',
  description: '',
  category_slug: '',
  format: 'hybrid',
  country: '',
  location_region: '',
  capacity: '',
  application_deadline: '',
  minimum_age: '',
  maximum_age: '',
}

const ORG_TAB_IDS = YOUTH_ORGANIZATION_TABS.map((t) => t.id)
type OrganizationTab = (typeof ORG_TAB_IDS)[number]

function YouthOrganizationPageInner() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const programQuery = searchParams.get('program') || ''
  const [tab, setTab] = useYouthTab(ORG_TAB_IDS, 'overview')

  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [programs, setPrograms] = useState<YouthProgram[]>([])
  const [categories, setCategories] = useState<YouthProgramCategory[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [applications, setApplications] = useState<ApplicationWithApplicant[]>([])
  const [projects, setProjects] = useState<YouthProject[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState(programQuery)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [showProgramModal, setShowProgramModal] = useState(false)

  const [orgForm, setOrgForm] = useState(EMPTY_ORG_FORM)
  const [programForm, setProgramForm] = useState(EMPTY_PROGRAM_FORM)

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) || null,
    [orgs, selectedOrgId]
  )

  const canCoordinate =
    selectedOrg?.my_role === 'admin' || selectedOrg?.my_role === 'coordinator'

  const loadOrgs = useCallback(async () => {
    const data = await apiClient.get<OrgRow[]>('/api/youth-leadership/organizations')
    const list = Array.isArray(data) ? data : []
    setOrgs(list)
    setSelectedOrgId((prev) => prev || list[0]?.id || '')
    return list
  }, [])

  const loadPrograms = useCallback(async (orgId: string) => {
    const progPayload = await apiClient.get<ProgramsPayload>('/api/youth-leadership/programs', {
      organization_id: orgId,
      limit: 50,
    })
    const list =
      progPayload?.data ||
      (Array.isArray(progPayload) ? (progPayload as unknown as YouthProgram[]) : [])
    setPrograms(list)
    setSelectedProgramId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev
      return list[0]?.id || ''
    })
    return list
  }, [])

  const loadAnalytics = useCallback(async (orgId: string) => {
    const analyticsData = await apiClient.get<Analytics>(
      `/api/youth-leadership/organizations/${orgId}/analytics`
    )
    setAnalytics(analyticsData)
  }, [])

  const loadProjects = useCallback(async (orgId: string) => {
    const projectList = await apiClient.get<YouthProject[]>('/api/youth-leadership/projects', {
      organization_id: orgId,
      limit: 50,
    })
    setProjects(Array.isArray(projectList) ? projectList : [])
  }, [])

  const loadCategories = useCallback(async () => {
    if (categories.length > 0) return
    const cats = await apiClient.get<YouthProgramCategory[]>('/api/youth-leadership/categories')
    setCategories(Array.isArray(cats) ? cats : [])
  }, [categories.length])

  const loadApplications = useCallback(async (programId: string) => {
    if (!programId) {
      setApplications([])
      return
    }
    const data = await apiClient.get<ApplicationWithApplicant[]>(
      `/api/youth-leadership/programs/${programId}/applications`
    )
    setApplications(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    ;(async () => {
      setLoading(true)
      try {
        await loadOrgs()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load organization')
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, user?.id, loadOrgs])

  // Overview + programs list (needed for program picker across tabs)
  useEffect(() => {
    if (!selectedOrgId || authLoading || !user) return
    let cancelled = false
    ;(async () => {
      try {
        await Promise.all([loadPrograms(selectedOrgId), loadAnalytics(selectedOrgId)])
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : 'Failed to load org data')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedOrgId, authLoading, user?.id, loadPrograms, loadAnalytics])

  // Projects tab on demand
  useEffect(() => {
    if (!selectedOrgId || tab !== 'projects') return
    loadProjects(selectedOrgId).catch((err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load projects')
    })
  }, [selectedOrgId, tab, loadProjects])

  // Categories only when creating a program
  useEffect(() => {
    if (!showProgramModal) return
    loadCategories().catch(() => {})
  }, [showProgramModal, loadCategories])

  useEffect(() => {
    if (tab !== 'applications' || !selectedProgramId || !canCoordinate) {
      if (tab !== 'applications') setApplications([])
      return
    }
    ;(async () => {
      try {
        await loadApplications(selectedProgramId)
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load applications')
      }
    })()
  }, [tab, selectedProgramId, canCoordinate, loadApplications])

  useEffect(() => {
    if (programQuery) setTab('applications')
  }, [programQuery, setTab])

  async function createOrg() {
    if (!orgForm.name.trim()) {
      toast.error('Organization name is required')
      return
    }
    setBusy(true)
    try {
      const org = await apiClient.post<OrgRow>('/api/youth-leadership/organizations', orgForm)
      toast.success('Organization created (pending verification)')
      setOrgForm(EMPTY_ORG_FORM)
      setShowOrgModal(false)
      setOrgs((list) => {
        if (list.some((o) => o.id === org.id)) return list
        return [...list, org]
      })
      setSelectedOrgId(org.id)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create organization')
    } finally {
      setBusy(false)
    }
  }

  async function createProgram(publish: boolean) {
    if (!selectedOrgId || !programForm.title.trim()) {
      toast.error('Program title is required')
      return
    }
    setBusy(true)
    try {
      const created = await apiClient.post<YouthProgram>('/api/youth-leadership/programs', {
        organization_id: selectedOrgId,
        title: programForm.title.trim(),
        description: programForm.description || null,
        category_slug: programForm.category_slug || null,
        format: programForm.format,
        country: programForm.country || null,
        location_region: programForm.location_region || null,
        capacity: programForm.capacity ? Number(programForm.capacity) : null,
        application_deadline: programForm.application_deadline || null,
        minimum_age: programForm.minimum_age ? Number(programForm.minimum_age) : null,
        maximum_age: programForm.maximum_age ? Number(programForm.maximum_age) : null,
        status: publish ? 'published' : 'draft',
      })
      toast.success(publish ? 'Program published' : 'Program draft created')
      setProgramForm(EMPTY_PROGRAM_FORM)
      setShowProgramModal(false)
      setPrograms((list) => {
        if (list.some((p) => p.id === created.id)) return list
        return [created, ...list]
      })
      setSelectedProgramId(created.id)
      setAnalytics((prev) =>
        prev
          ? {
              ...prev,
              total_programs: prev.total_programs + 1,
              active_programs:
                publish || created.status === 'published'
                  ? prev.active_programs + 1
                  : prev.active_programs,
            }
          : prev
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create program')
    } finally {
      setBusy(false)
    }
  }

  async function publishProgram(programId: string) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/youth-leadership/programs/${programId}`, {
        status: 'published',
      })
      toast.success('Program published')
      setPrograms((list) =>
        list.map((p) => (p.id === programId ? { ...p, status: 'published' } : p))
      )
      setAnalytics((prev) =>
        prev ? { ...prev, active_programs: prev.active_programs + 1 } : prev
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to publish')
    } finally {
      setBusy(false)
    }
  }

  async function reviewApplication(
    applicationId: string,
    status: 'accepted' | 'waitlisted' | 'rejected' | 'under_review'
  ) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/youth-leadership/applications/${applicationId}`, {
        status,
      })
      toast.success(`Application marked ${status.replace(/_/g, ' ')}`)
      setApplications((list) =>
        list.map((app) => (app.id === applicationId ? { ...app, status } : app))
      )
      setAnalytics((prev) => {
        if (!prev) return prev
        const next = { ...prev }
        if (status === 'accepted') {
          next.accepted_applications = prev.accepted_applications + 1
          next.pending_applications = Math.max(0, prev.pending_applications - 1)
        } else if (status === 'rejected' || status === 'waitlisted') {
          next.pending_applications = Math.max(0, prev.pending_applications - 1)
        }
        return next
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update application')
    } finally {
      setBusy(false)
    }
  }

  async function approveProject(projectId: string) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/youth-leadership/projects/${projectId}`, {
        status: 'approved',
      })
      toast.success('Project approved')
      setProjects((list) =>
        list.map((p) => (p.id === projectId ? { ...p, status: 'approved' } : p))
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update project')
    } finally {
      setBusy(false)
    }
  }

  const pendingProjects = useMemo(
    () => projects.filter((p) => p.status === 'pending_approval'),
    [projects]
  )

  function closeOrgModal() {
    if (busy) return
    setShowOrgModal(false)
  }

  function closeProgramModal() {
    if (busy) return
    setShowProgramModal(false)
  }

  const orgSubtitle =
    tab === 'programs'
      ? 'Draft, publish, and manage programs for your organization.'
      : tab === 'projects'
        ? 'Review community project requests linked to your organization.'
        : tab === 'applications'
          ? 'Review applications for the programs you coordinate.'
          : 'Create an organization, publish programs, and review applications.'

  if (authLoading || loading) {
    return (
      <YouthShell
        title="Organization"
        subtitle={orgSubtitle}
        tabs={[...YOUTH_ORGANIZATION_TABS]}
        activeTab={tab}
        onTabChange={(id) => setTab(id as OrganizationTab)}
      >
        <YouthSkeleton count={3} variant="stat" />
      </YouthShell>
    )
  }

  if (!user) {
    return (
      <YouthShell
        title="Organization"
        subtitle={orgSubtitle}
        tabs={[...YOUTH_ORGANIZATION_TABS]}
        activeTab={tab}
        onTabChange={(id) => setTab(id as OrganizationTab)}
      >
        <EmptyState title="Sign in required" />
      </YouthShell>
    )
  }

  const orgModal = (
    <YouthFormModal
      open={showOrgModal}
      title="Create organization"
      description="Organizations start as pending until platform verification."
      onClose={closeOrgModal}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" disabled={busy} onClick={closeOrgModal}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={createOrg}>
            {busy ? 'Creating…' : 'Create organization'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <YouthFieldLabel htmlFor="org-name">Name</YouthFieldLabel>
          <input
            id="org-name"
            className={YOUTH_FIELD}
            value={orgForm.name}
            onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <YouthFieldLabel htmlFor="org-description">Description</YouthFieldLabel>
          <textarea
            id="org-description"
            className={`${YOUTH_FIELD} min-h-[88px]`}
            value={orgForm.description}
            onChange={(e) => setOrgForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <YouthFieldLabel htmlFor="org-country">Country</YouthFieldLabel>
          <input
            id="org-country"
            className={YOUTH_FIELD}
            value={orgForm.country}
            onChange={(e) => setOrgForm((f) => ({ ...f, country: e.target.value }))}
          />
        </div>
        <div>
          <YouthFieldLabel htmlFor="org-region">Region</YouthFieldLabel>
          <input
            id="org-region"
            className={YOUTH_FIELD}
            value={orgForm.region}
            onChange={(e) => setOrgForm((f) => ({ ...f, region: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <YouthFieldLabel htmlFor="org-website">Website</YouthFieldLabel>
          <input
            id="org-website"
            className={YOUTH_FIELD}
            value={orgForm.website}
            onChange={(e) => setOrgForm((f) => ({ ...f, website: e.target.value }))}
          />
        </div>
      </div>
    </YouthFormModal>
  )

  const programModal = (
    <YouthFormModal
      open={showProgramModal}
      title="Create program"
      onClose={closeProgramModal}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={closeProgramModal}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => createProgram(false)}
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => createProgram(true)}
          >
            Publish program
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <YouthFieldLabel htmlFor="program-title">Title</YouthFieldLabel>
          <input
            id="program-title"
            className={YOUTH_FIELD}
            value={programForm.title}
            onChange={(e) => setProgramForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <YouthFieldLabel htmlFor="program-description">Description</YouthFieldLabel>
          <textarea
            id="program-description"
            className={`${YOUTH_FIELD} min-h-[88px]`}
            value={programForm.description}
            onChange={(e) => setProgramForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <YouthFieldLabel htmlFor="program-category">Category</YouthFieldLabel>
          <select
            id="program-category"
            className={YOUTH_FIELD}
            value={programForm.category_slug}
            onChange={(e) => setProgramForm((f) => ({ ...f, category_slug: e.target.value }))}
          >
            <option value="">Select</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <YouthFieldLabel htmlFor="program-format">Format</YouthFieldLabel>
          <select
            id="program-format"
            className={YOUTH_FIELD}
            value={programForm.format}
            onChange={(e) => setProgramForm((f) => ({ ...f, format: e.target.value }))}
          >
            <option value="online">Online</option>
            <option value="in_person">In person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div>
          <YouthFieldLabel htmlFor="program-country">Country</YouthFieldLabel>
          <input
            id="program-country"
            className={YOUTH_FIELD}
            value={programForm.country}
            onChange={(e) => setProgramForm((f) => ({ ...f, country: e.target.value }))}
          />
        </div>
        <div>
          <YouthFieldLabel htmlFor="program-region">Region</YouthFieldLabel>
          <input
            id="program-region"
            className={YOUTH_FIELD}
            value={programForm.location_region}
            onChange={(e) =>
              setProgramForm((f) => ({ ...f, location_region: e.target.value }))
            }
          />
        </div>
        <div>
          <YouthFieldLabel htmlFor="program-capacity">Capacity</YouthFieldLabel>
          <input
            id="program-capacity"
            className={YOUTH_FIELD}
            type="number"
            min={1}
            value={programForm.capacity}
            onChange={(e) => setProgramForm((f) => ({ ...f, capacity: e.target.value }))}
          />
        </div>
        <div>
          <YouthFieldLabel htmlFor="program-deadline">Deadline</YouthFieldLabel>
          <input
            id="program-deadline"
            className={YOUTH_FIELD}
            type="date"
            value={programForm.application_deadline}
            onChange={(e) =>
              setProgramForm((f) => ({
                ...f,
                application_deadline: e.target.value,
              }))
            }
          />
        </div>
        <div>
          <YouthFieldLabel htmlFor="program-min-age">Min age</YouthFieldLabel>
          <input
            id="program-min-age"
            className={YOUTH_FIELD}
            type="number"
            value={programForm.minimum_age}
            onChange={(e) => setProgramForm((f) => ({ ...f, minimum_age: e.target.value }))}
          />
        </div>
        <div>
          <YouthFieldLabel htmlFor="program-max-age">Max age</YouthFieldLabel>
          <input
            id="program-max-age"
            className={YOUTH_FIELD}
            type="number"
            value={programForm.maximum_age}
            onChange={(e) => setProgramForm((f) => ({ ...f, maximum_age: e.target.value }))}
          />
        </div>
      </div>
    </YouthFormModal>
  )

  return (
    <YouthShell
      title="Organization"
      subtitle={orgSubtitle}
      tabs={[...YOUTH_ORGANIZATION_TABS]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as OrganizationTab)}
      actions={
        orgs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={YOUTH_SELECT}
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              aria-label="Select organization"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setShowOrgModal(true)}
            >
              New organization
            </button>
          </div>
        ) : null
      }
    >
      {orgs.length === 0 ? (
        <EmptyState
          title="No organization yet"
          description="Create an organization to publish programs and review applications. Organizations start as pending until platform verification."
          action={
            <button type="button" className="btn-primary" onClick={() => setShowOrgModal(true)}>
              Create organization
            </button>
          }
        />
      ) : (
        <>
          {tab === 'overview' ? (
            <section>
              <YouthSectionHeader title="Organization overview" />
              <div className={YOUTH_CARD}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={YOUTH_SECTION_TITLE}>{selectedOrg?.name}</h3>
                      {selectedOrg?.verification_status === 'verified' ? (
                        <VerifiedBadge label="Verified organization" />
                      ) : selectedOrg ? (
                        <StatusBadge status={selectedOrg.verification_status} />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-content-secondary">
                      {selectedOrg?.description || 'No description yet.'}
                    </p>
                    {selectedOrg?.my_role ? (
                      <p className="mt-2 text-xs capitalize text-content-tertiary">
                        Your role: {selectedOrg.my_role.replace(/_/g, ' ')}
                      </p>
                    ) : null}
                  </div>
                </div>
                {analytics ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: 'Programs', value: analytics.total_programs },
                      { label: 'Active programs', value: analytics.active_programs },
                      { label: 'Applications', value: analytics.total_applications },
                      { label: 'Pending program reviews', value: analytics.pending_applications },
                      {
                        label: 'Pending project requests',
                        value: pendingProjects.length,
                      },
                      { label: 'Accepted', value: analytics.accepted_applications },
                      { label: 'Completion rate', value: `${analytics.completion_rate}%` },
                      { label: 'Upcoming events', value: analytics.upcoming_events },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl bg-surface-secondary/60 px-3 py-3"
                      >
                        <p className="text-xs text-content-secondary">{stat.label}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-content-primary">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {tab === 'programs' ? (
            <section>
              <YouthSectionHeader
                title="Programs"
                badge={
                  <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
                    {programs.length} total
                  </span>
                }
              >
                {canCoordinate ? (
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={() => setShowProgramModal(true)}
                  >
                    Create program
                  </button>
                ) : null}
              </YouthSectionHeader>
              {programs.length === 0 ? (
                <EmptyState
                  title="No programs yet"
                  description="Create a draft or publish a program for your organization."
                />
              ) : (
                <ul className="space-y-3">
                  {programs.map((p) => (
                    <li key={p.id} className={YOUTH_CARD}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Link
                            href={`/youth-leadership/programs/${p.id}`}
                            className="font-medium text-content hover:text-primary"
                          >
                            {p.title}
                          </Link>
                          <div className="mt-1">
                            <StatusBadge status={p.status} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canCoordinate ? (
                            <button
                              type="button"
                              className="btn-secondary text-sm"
                              onClick={() => {
                                setSelectedProgramId(p.id)
                                setTab('applications')
                              }}
                            >
                              Review apps
                            </button>
                          ) : null}
                          {canCoordinate && p.status === 'draft' ? (
                            <button
                              type="button"
                              className="btn-primary text-sm"
                              disabled={busy}
                              onClick={() => publishProgram(p.id)}
                            >
                              Publish
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {tab === 'projects' ? (
            <section>
              {!canCoordinate ? (
                <EmptyState
                  title="Coordinator access required"
                  description="Only organization admins and coordinators can review project requests."
                />
              ) : (
                <>
                  <YouthSectionHeader
                    title="Project requests"
                    badge={
                      <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
                        {pendingProjects.length} pending · {projects.length} total
                      </span>
                    }
                  />
                  {projects.length === 0 ? (
                    <EmptyState
                      title="No projects yet"
                      description="Community projects linked to this organization will appear here for approval."
                    />
                  ) : (
                    <ul className="space-y-3">
                      {projects.map((project) => (
                        <li key={project.id} className={YOUTH_CARD}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/youth-leadership/projects/${project.id}`}
                                  className="font-medium text-content hover:text-primary"
                                >
                                  {project.title}
                                </Link>
                                <StatusBadge status={project.status} />
                              </div>
                              {project.description ? (
                                <p className="mt-1 line-clamp-2 text-sm text-content-secondary">
                                  {project.description}
                                </p>
                              ) : null}
                              <p className="mt-2 text-xs text-content-tertiary">
                                {project.member_count ?? 0} member
                                {(project.member_count ?? 0) === 1 ? '' : 's'}
                                {project.created_at
                                  ? ` · ${new Date(project.created_at).toLocaleDateString()}`
                                  : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/youth-leadership/projects/${project.id}`}
                                className="btn-secondary text-sm"
                              >
                                View
                              </Link>
                              {project.status === 'pending_approval' ? (
                                <button
                                  type="button"
                                  className="btn-primary text-sm"
                                  disabled={busy}
                                  onClick={() => approveProject(project.id)}
                                >
                                  Approve
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          ) : null}

          {tab === 'applications' ? (
            <section>
              {!canCoordinate ? (
                <EmptyState
                  title="Coordinator access required"
                  description="Only organization admins and coordinators can review applications."
                />
              ) : (
                <>
                  <YouthSectionHeader
                    title="Applications"
                    badge={
                      selectedProgramId ? (
                        <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
                          {applications.length} shown
                        </span>
                      ) : null
                    }
                  >
                    <select
                      className={`${YOUTH_SELECT} h-10`}
                      value={selectedProgramId}
                      onChange={(e) => setSelectedProgramId(e.target.value)}
                      aria-label="Select program for application review"
                    >
                      <option value="">Select program</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </YouthSectionHeader>
                  {!selectedProgramId ? (
                    <EmptyState
                      title="Select a program"
                      description="Choose a program above to review its applications."
                    />
                  ) : applications.length === 0 ? (
                    <EmptyState
                      title="No applications yet"
                      description="Applications will appear here once participants apply."
                    />
                  ) : (
                    <ul className="space-y-3">
                      {applications.map((app) => {
                        const applicantName =
                          app.applicant?.full_name ||
                          app.applicant?.username ||
                          'Applicant'
                        return (
                          <li key={app.id} className={YOUTH_CARD}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-3">
                                <YouthAvatar
                                  src={app.applicant?.avatar_url}
                                  name={applicantName}
                                />
                                <div className="min-w-0">
                                  <p className="font-medium text-content">{applicantName}</p>
                                  <p className="text-xs text-content-tertiary">
                                    {app.submitted_at
                                      ? new Date(app.submitted_at).toLocaleString()
                                      : new Date(app.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <StatusBadge status={app.status} />
                            </div>
                            {['submitted', 'under_review', 'waitlisted'].includes(
                              app.status
                            ) ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="btn-secondary text-sm"
                                  disabled={busy}
                                  onClick={() =>
                                    reviewApplication(app.id, 'under_review')
                                  }
                                >
                                  Under review
                                </button>
                                <button
                                  type="button"
                                  className="btn-primary text-sm"
                                  disabled={busy}
                                  onClick={() => reviewApplication(app.id, 'accepted')}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary text-sm"
                                  disabled={busy}
                                  onClick={() => reviewApplication(app.id, 'waitlisted')}
                                >
                                  Waitlist
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary text-sm text-red-700"
                                  disabled={busy}
                                  onClick={() => reviewApplication(app.id, 'rejected')}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </section>
          ) : null}
        </>
      )}

      {orgModal}
      {programModal}
    </YouthShell>
  )
}

export default function YouthOrganizationPage() {
  return (
    <Suspense
      fallback={
        <YouthShell title="Organization">
          <YouthSkeleton count={3} variant="stat" />
        </YouthShell>
      }
    >
      <YouthOrganizationPageInner />
    </Suspense>
  )
}
