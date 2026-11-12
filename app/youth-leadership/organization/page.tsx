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
import { YOUTH_CARD, YOUTH_SECTION_TITLE } from '@/features/youth-leadership/constants/nav'
import type {
  YouthOrganization,
  YouthProgram,
  YouthProgramApplication,
  YouthProgramCategory,
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

function YouthOrganizationPageInner() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const programQuery = searchParams.get('program') || ''

  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [programs, setPrograms] = useState<YouthProgram[]>([])
  const [categories, setCategories] = useState<YouthProgramCategory[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [applications, setApplications] = useState<ApplicationWithApplicant[]>([])
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

  const loadOrgData = useCallback(async (orgId: string) => {
    if (!orgId) {
      setPrograms([])
      setAnalytics(null)
      return
    }
    const [progPayload, analyticsData, cats] = await Promise.all([
      apiClient.get<ProgramsPayload>('/api/youth-leadership/programs', {
        organization_id: orgId,
        limit: 50,
      }),
      apiClient.get<Analytics>(`/api/youth-leadership/organizations/${orgId}/analytics`),
      apiClient.get<YouthProgramCategory[]>('/api/youth-leadership/categories'),
    ])
    const list = progPayload?.data || (Array.isArray(progPayload) ? (progPayload as unknown as YouthProgram[]) : [])
    setPrograms(list)
    setAnalytics(analyticsData)
    setCategories(Array.isArray(cats) ? cats : [])
    setSelectedProgramId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev
      return list[0]?.id || ''
    })
  }, [])

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
        const list = await loadOrgs()
        if (list[0]?.id) await loadOrgData(list[0].id)
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load organization')
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, user, loadOrgs, loadOrgData])

  useEffect(() => {
    if (!selectedOrgId || authLoading || !user) return
    ;(async () => {
      try {
        await loadOrgData(selectedOrgId)
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load org data')
      }
    })()
  }, [selectedOrgId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedProgramId || !canCoordinate) {
      setApplications([])
      return
    }
    ;(async () => {
      try {
        await loadApplications(selectedProgramId)
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load applications')
      }
    })()
  }, [selectedProgramId, canCoordinate, loadApplications])

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
      await loadOrgs()
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
      await apiClient.post('/api/youth-leadership/programs', {
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
      await loadOrgData(selectedOrgId)
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
      await loadOrgData(selectedOrgId)
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
      await loadApplications(selectedProgramId)
      if (selectedOrgId) await loadOrgData(selectedOrgId)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update application')
    } finally {
      setBusy(false)
    }
  }

  function closeOrgModal() {
    if (busy) return
    setShowOrgModal(false)
  }

  function closeProgramModal() {
    if (busy) return
    setShowProgramModal(false)
  }

  if (authLoading || loading) {
    return (
      <YouthShell title="Organization">
        <div className={`${YOUTH_CARD} h-48 animate-pulse bg-surface-secondary`} />
      </YouthShell>
    )
  }

  if (!user) {
    return (
      <YouthShell title="Organization">
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
      description="Save a draft or publish immediately for applications."
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
      subtitle="Create an organization, publish programs, and review applications."
      actions={
        orgs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
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
            {canCoordinate ? (
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => setShowProgramModal(true)}
              >
                Create program
              </button>
            ) : null}
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
        <div className="space-y-6">
          <section className={YOUTH_CARD}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={YOUTH_SECTION_TITLE}>{selectedOrg?.name}</h2>
                <p className="mt-1 text-sm text-content-secondary">
                  {selectedOrg?.description || 'No description yet.'}
                </p>
              </div>
              {selectedOrg ? <StatusBadge status={selectedOrg.verification_status} /> : null}
            </div>
            {analytics ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Programs', value: analytics.total_programs },
                  { label: 'Active programs', value: analytics.active_programs },
                  { label: 'Applications', value: analytics.total_applications },
                  { label: 'Pending reviews', value: analytics.pending_applications },
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
          </section>

          <section className={YOUTH_CARD}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={YOUTH_SECTION_TITLE}>Programs</h2>
              {canCoordinate ? (
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => setShowProgramModal(true)}
                >
                  Create program
                </button>
              ) : null}
            </div>
            {programs.length === 0 ? (
              <p className="mt-3 text-sm text-content-secondary">No programs yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {programs.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/youth-leadership/programs/${p.id}`}
                        className="font-medium text-content-primary hover:text-primary"
                      >
                        {p.title}
                      </Link>
                      <div className="mt-1">
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => setSelectedProgramId(p.id)}
                      >
                        Review apps
                      </button>
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
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canCoordinate ? (
            <section className={YOUTH_CARD}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={YOUTH_SECTION_TITLE}>Applications</h2>
                <select
                  className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm"
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                >
                  <option value="">Select program</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              {!selectedProgramId ? (
                <p className="mt-3 text-sm text-content-secondary">
                  Select a program to review applications.
                </p>
              ) : applications.length === 0 ? (
                <p className="mt-3 text-sm text-content-secondary">No applications yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {applications.map((app) => {
                    const applicantName =
                      app.applicant?.full_name ||
                      app.applicant?.username ||
                      'Applicant'
                    return (
                    <li key={app.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <YouthAvatar
                            src={app.applicant?.avatar_url}
                            name={applicantName}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-content-primary">
                              {applicantName}
                            </p>
                            <p className="text-xs text-content-tertiary">
                              {app.submitted_at
                                ? new Date(app.submitted_at).toLocaleString()
                                : new Date(app.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                      {['submitted', 'under_review', 'waitlisted'].includes(app.status) ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-secondary text-sm"
                            disabled={busy}
                            onClick={() => reviewApplication(app.id, 'under_review')}
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
            </section>
          ) : null}
        </div>
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
          <div className={`${YOUTH_CARD} h-48 animate-pulse bg-surface-secondary`} />
        </YouthShell>
      }
    >
      <YouthOrganizationPageInner />
    </Suspense>
  )
}
