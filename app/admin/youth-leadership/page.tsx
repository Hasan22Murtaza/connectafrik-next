'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Award,
  Building2,
  Flag,
  RefreshCw,
  UserCheck,
  Users,
} from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { AdminLoading } from '@/features/admin/components/AdminLoading'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { AdminStatCard } from '@/features/admin/components/AdminStatCard'
import { AdminEmptyState } from '@/features/admin/components/AdminEmptyState'
import { AdminStatusBadge } from '@/features/admin/components/AdminStatusBadge'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from '@/features/admin/components/AdminTable'
import { useAdminAuth } from '@/features/admin/hooks/useAdminAuth'
import { AP } from '@/features/admin/constants/adminLayout'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'

type AdminSummary = {
  pending_organizations: number
  published_programs: number
  pending_programs: number
  pending_mentors: number
  open_safety_reports: number
  total_applications: number
  active_enrollments: number
}

type AdminPayload = {
  summary: AdminSummary
  organizations: Array<{
    id: string
    name: string
    country: string | null
    verification_status: string
    created_at: string
  }>
  programs: Array<{
    id: string
    title: string
    status: string
    created_at: string
    organization?: { id: string; name: string } | null
  }>
  mentors_pending: Array<{
    id: string
    verification_status: string
    created_at: string
    bio: string | null
    profile?: {
      id: string
      username: string | null
      full_name: string | null
      avatar_url: string | null
    } | null
  }>
  safety_reports: Array<{
    id: string
    report_type: string
    description: string
    status: string
    created_at: string
  }>
}

type YouthAdminTab = 'organizations' | 'mentors' | 'programs' | 'safety'

const SELECT_CLASS =
  'rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500/30'

const TAB_META: Record<
  YouthAdminTab,
  { label: string; description: string; emptyTitle: string }
> = {
  organizations: {
    label: 'Organizations',
    description: 'Verify, reject, or suspend youth partner organizations.',
    emptyTitle: 'No organizations for this filter',
  },
  mentors: {
    label: 'Mentors',
    description: 'Review mentor verification requests before they appear in matching.',
    emptyTitle: 'No mentors for this filter',
  },
  programs: {
    label: 'Programs',
    description: 'Publish pending programs or suspend ones that need intervention.',
    emptyTitle: 'No programs for this filter',
  },
  safety: {
    label: 'Safety',
    description: 'Triage CribsSafe reports from youth leadership spaces.',
    emptyTitle: 'No safety reports for this filter',
  },
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function parseTab(value: string | null): YouthAdminTab {
  if (value === 'mentors' || value === 'programs' || value === 'safety') return value
  return 'organizations'
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      className={variant === 'primary' ? AP.btnPrimary : AP.btnSecondary}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function AdminYouthLeadershipInner() {
  const { isReady, authLoading } = useAdminAuth('/admin/youth-leadership')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))

  const [data, setData] = useState<AdminPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [orgStatus, setOrgStatus] = useState('pending')
  const [programStatus, setProgramStatus] = useState('pending_review')
  const [mentorStatus, setMentorStatus] = useState('pending')
  const [safetyStatus, setSafetyStatus] = useState('open')

  const setTab = useCallback(
    (next: YouthAdminTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'organizations') params.delete('tab')
      else params.set('tab', next)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await apiClient.get<AdminPayload>('/api/youth-leadership/admin', {
        org_status: orgStatus || undefined,
        program_status: programStatus || undefined,
        mentor_status: mentorStatus || undefined,
        safety_status: safetyStatus || undefined,
      })
      setData(payload)
    } catch (err) {
      setData(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load moderation queue')
    } finally {
      setLoading(false)
    }
  }, [orgStatus, programStatus, mentorStatus, safetyStatus])

  useEffect(() => {
    if (!isReady) return
    load()
  }, [isReady, load])

  async function patchEntity(
    entity: string,
    id: string,
    body: Record<string, unknown>,
    successMessage: string
  ) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/youth-leadership/admin/${entity}/${id}`, body)
      toast.success(successMessage)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const tabCounts = useMemo(() => {
    if (!data) {
      return {
        organizations: 0,
        mentors: 0,
        programs: 0,
        safety: 0,
      }
    }
    return {
      organizations: data.summary.pending_organizations,
      mentors: data.summary.pending_mentors,
      programs: data.summary.pending_programs,
      safety: data.summary.open_safety_reports,
    }
  }, [data])

  const activeCount = data
    ? tab === 'organizations'
      ? data.organizations.length
      : tab === 'mentors'
        ? data.mentors_pending.length
        : tab === 'programs'
          ? data.programs.length
          : data.safety_reports.length
    : 0

  if (authLoading || !isReady) {
    return <AdminLoading variant="users" />
  }

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Youth Leadership"
        description={TAB_META[tab].description}
        action={
          <button
            type="button"
            className={AP.btnSecondary}
            onClick={load}
            disabled={loading || busy}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {loading && !data ? (
        <AdminLoading variant="users" />
      ) : !data ? (
        <AdminEmptyState
          icon={Award}
          title="Unable to load Youth Leadership admin data"
          description="Confirm you have platform youth admin access."
        />
      ) : (
        <>
          <div className={`${AP.statsGrid} mb-6`}>
            <button
              type="button"
              className="text-left"
              onClick={() => setTab('organizations')}
            >
              <AdminStatCard
                label="Pending orgs"
                value={data.summary.pending_organizations}
                icon={Building2}
                highlight={data.summary.pending_organizations > 0 && tab === 'organizations'}
              />
            </button>
            <button type="button" className="text-left" onClick={() => setTab('programs')}>
              <AdminStatCard
                label="Published programs"
                value={data.summary.published_programs}
                icon={Award}
                highlight={tab === 'programs'}
              />
            </button>
            <button type="button" className="text-left" onClick={() => setTab('mentors')}>
              <AdminStatCard
                label="Pending mentors"
                value={data.summary.pending_mentors}
                icon={UserCheck}
                highlight={data.summary.pending_mentors > 0 && tab === 'mentors'}
              />
            </button>
            <button type="button" className="text-left" onClick={() => setTab('safety')}>
              <AdminStatCard
                label="Open safety"
                value={data.summary.open_safety_reports}
                icon={Flag}
                highlight={data.summary.open_safety_reports > 0}
              />
            </button>
            <AdminStatCard
              label="Applications"
              value={data.summary.total_applications}
              icon={Users}
            />
            <AdminStatCard
              label="Active enrollments"
              value={data.summary.active_enrollments}
            />
          </div>

          <div
            className="mb-5 inline-flex max-w-full flex-wrap rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
            role="tablist"
            aria-label="Youth Leadership moderation sections"
          >
            {(Object.keys(TAB_META) as YouthAdminTab[]).map((id) => {
              const active = tab === id
              const count = tabCounts[id]
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {TAB_META[id].label}
                  {count > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-primary-50 text-primary-700'
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                {TAB_META[tab].label}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {activeCount} {activeCount === 1 ? 'item' : 'items'} in current filter
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tab === 'organizations' ? (
                <select
                  className={SELECT_CLASS}
                  value={orgStatus}
                  onChange={(e) => setOrgStatus(e.target.value)}
                  aria-label="Organization filter"
                >
                  <option value="">All orgs</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                </select>
              ) : null}

              {tab === 'mentors' ? (
                <select
                  className={SELECT_CLASS}
                  value={mentorStatus}
                  onChange={(e) => setMentorStatus(e.target.value)}
                  aria-label="Mentor filter"
                >
                  <option value="">All mentors</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                </select>
              ) : null}

              {tab === 'programs' ? (
                <select
                  className={SELECT_CLASS}
                  value={programStatus}
                  onChange={(e) => setProgramStatus(e.target.value)}
                  aria-label="Program filter"
                >
                  <option value="">All programs</option>
                  <option value="pending_review">Pending review</option>
                  <option value="published">Published</option>
                  <option value="suspended">Suspended</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              ) : null}

              {tab === 'safety' ? (
                <select
                  className={SELECT_CLASS}
                  value={safetyStatus}
                  onChange={(e) => setSafetyStatus(e.target.value)}
                  aria-label="Safety filter"
                >
                  <option value="">All reports</option>
                  <option value="open">Open</option>
                  <option value="under_review">Under review</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              ) : null}
            </div>
          </div>

          {tab === 'organizations' ? (
            data.organizations.length === 0 ? (
              <div className={AP.card}>
                <AdminEmptyState icon={Building2} title={TAB_META.organizations.emptyTitle} />
              </div>
            ) : (
              <AdminTable>
                <AdminTableHead>
                  <AdminTableHeadCell>Name</AdminTableHeadCell>
                  <AdminTableHeadCell>Country</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Created</AdminTableHeadCell>
                  <AdminTableHeadCell>Actions</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {data.organizations.map((org) => (
                    <AdminTableRow key={org.id}>
                      <AdminTableCell className="font-medium text-gray-900">
                        {org.name}
                      </AdminTableCell>
                      <AdminTableCell>{org.country || '—'}</AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={org.verification_status} />
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-gray-600">
                        {formatDate(org.created_at)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <ActionButton
                            variant="primary"
                            disabled={busy || org.verification_status === 'verified'}
                            onClick={() =>
                              patchEntity(
                                'organizations',
                                org.id,
                                { verification_status: 'verified' },
                                'Organization verified'
                              )
                            }
                          >
                            Verify
                          </ActionButton>
                          <ActionButton
                            disabled={busy || org.verification_status === 'rejected'}
                            onClick={() =>
                              patchEntity(
                                'organizations',
                                org.id,
                                { verification_status: 'rejected' },
                                'Organization rejected'
                              )
                            }
                          >
                            Reject
                          </ActionButton>
                          <ActionButton
                            disabled={busy || org.verification_status === 'suspended'}
                            onClick={() =>
                              patchEntity(
                                'organizations',
                                org.id,
                                { verification_status: 'suspended' },
                                'Organization suspended'
                              )
                            }
                          >
                            Suspend
                          </ActionButton>
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )
          ) : null}

          {tab === 'mentors' ? (
            data.mentors_pending.length === 0 ? (
              <div className={AP.card}>
                <AdminEmptyState icon={UserCheck} title={TAB_META.mentors.emptyTitle} />
              </div>
            ) : (
              <AdminTable>
                <AdminTableHead>
                  <AdminTableHeadCell>Mentor</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Created</AdminTableHeadCell>
                  <AdminTableHeadCell>Actions</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {data.mentors_pending.map((mentor) => {
                    const mentorName =
                      mentor.profile?.full_name || mentor.profile?.username || 'Mentor'
                    return (
                      <AdminTableRow key={mentor.id}>
                        <AdminTableCell>
                          <div className="flex items-center gap-3">
                            <YouthAvatar
                              src={mentor.profile?.avatar_url}
                              name={mentorName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{mentorName}</p>
                              {mentor.bio ? (
                                <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                                  {mentor.bio}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </AdminTableCell>
                        <AdminTableCell>
                          <AdminStatusBadge status={mentor.verification_status} />
                        </AdminTableCell>
                        <AdminTableCell className="whitespace-nowrap text-gray-600">
                          {formatDate(mentor.created_at)}
                        </AdminTableCell>
                        <AdminTableCell>
                          <div className="flex flex-wrap gap-1.5">
                            <ActionButton
                              variant="primary"
                              disabled={busy || mentor.verification_status === 'verified'}
                              onClick={() =>
                                patchEntity(
                                  'mentors',
                                  mentor.id,
                                  { verification_status: 'verified' },
                                  'Mentor verified'
                                )
                              }
                            >
                              Verify
                            </ActionButton>
                            <ActionButton
                              disabled={busy || mentor.verification_status === 'rejected'}
                              onClick={() =>
                                patchEntity(
                                  'mentors',
                                  mentor.id,
                                  { verification_status: 'rejected' },
                                  'Mentor rejected'
                                )
                              }
                            >
                              Reject
                            </ActionButton>
                            <ActionButton
                              disabled={busy || mentor.verification_status === 'suspended'}
                              onClick={() =>
                                patchEntity(
                                  'mentors',
                                  mentor.id,
                                  { verification_status: 'suspended' },
                                  'Mentor suspended'
                                )
                              }
                            >
                              Suspend
                            </ActionButton>
                          </div>
                        </AdminTableCell>
                      </AdminTableRow>
                    )
                  })}
                </AdminTableBody>
              </AdminTable>
            )
          ) : null}

          {tab === 'programs' ? (
            data.programs.length === 0 ? (
              <div className={AP.card}>
                <AdminEmptyState icon={Award} title={TAB_META.programs.emptyTitle} />
              </div>
            ) : (
              <AdminTable>
                <AdminTableHead>
                  <AdminTableHeadCell>Program</AdminTableHeadCell>
                  <AdminTableHeadCell>Organization</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Created</AdminTableHeadCell>
                  <AdminTableHeadCell>Actions</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {data.programs.map((program) => (
                    <AdminTableRow key={program.id}>
                      <AdminTableCell className="font-medium text-gray-900">
                        {program.title}
                      </AdminTableCell>
                      <AdminTableCell>{program.organization?.name || '—'}</AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={program.status} />
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-gray-600">
                        {formatDate(program.created_at)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <ActionButton
                            variant="primary"
                            disabled={busy || program.status === 'published'}
                            onClick={() =>
                              patchEntity(
                                'programs',
                                program.id,
                                { status: 'published' },
                                'Program published'
                              )
                            }
                          >
                            Publish
                          </ActionButton>
                          <ActionButton
                            disabled={busy || program.status === 'suspended'}
                            onClick={() =>
                              patchEntity(
                                'programs',
                                program.id,
                                { status: 'suspended' },
                                'Program suspended'
                              )
                            }
                          >
                            Suspend
                          </ActionButton>
                          <ActionButton
                            disabled={busy || program.status === 'archived'}
                            onClick={() =>
                              patchEntity(
                                'programs',
                                program.id,
                                { status: 'archived' },
                                'Program archived'
                              )
                            }
                          >
                            Archive
                          </ActionButton>
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )
          ) : null}

          {tab === 'safety' ? (
            data.safety_reports.length === 0 ? (
              <div className={AP.card}>
                <AdminEmptyState icon={Flag} title={TAB_META.safety.emptyTitle} />
              </div>
            ) : (
              <AdminTable>
                <AdminTableHead>
                  <AdminTableHeadCell>Type</AdminTableHeadCell>
                  <AdminTableHeadCell>Description</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Created</AdminTableHeadCell>
                  <AdminTableHeadCell>Actions</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {data.safety_reports.map((report) => (
                    <AdminTableRow key={report.id}>
                      <AdminTableCell className="capitalize">
                        {report.report_type.replace(/_/g, ' ')}
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="line-clamp-2 max-w-md text-sm text-gray-700">
                          {report.description}
                        </p>
                      </AdminTableCell>
                      <AdminTableCell>
                        <AdminStatusBadge status={report.status} />
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-gray-600">
                        {formatDate(report.created_at)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <ActionButton
                            disabled={busy || report.status === 'under_review'}
                            onClick={() =>
                              patchEntity(
                                'safety-reports',
                                report.id,
                                { status: 'under_review' },
                                'Marked under review'
                              )
                            }
                          >
                            Review
                          </ActionButton>
                          <ActionButton
                            variant="primary"
                            disabled={busy || report.status === 'resolved'}
                            onClick={() =>
                              patchEntity(
                                'safety-reports',
                                report.id,
                                { status: 'resolved' },
                                'Report resolved'
                              )
                            }
                          >
                            Resolve
                          </ActionButton>
                          <ActionButton
                            disabled={busy || report.status === 'dismissed'}
                            onClick={() =>
                              patchEntity(
                                'safety-reports',
                                report.id,
                                { status: 'dismissed' },
                                'Report dismissed'
                              )
                            }
                          >
                            Dismiss
                          </ActionButton>
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )
          ) : null}
        </>
      )}
    </div>
  )
}

export default function AdminYouthLeadershipPage() {
  return (
    <Suspense fallback={<AdminLoading variant="users" />}>
      <AdminYouthLeadershipInner />
    </Suspense>
  )
}
