'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Award, Building2, Flag, RefreshCw, UserCheck } from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { AdminLoading } from '@/features/admin/components/AdminLoading'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { AdminStatCard } from '@/features/admin/components/AdminStatCard'
import { AdminEmptyState } from '@/features/admin/components/AdminEmptyState'
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export default function AdminYouthLeadershipPage() {
  const { isReady, authLoading } = useAdminAuth('/admin/youth-leadership')
  const [data, setData] = useState<AdminPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [orgStatus, setOrgStatus] = useState('pending')
  const [programStatus, setProgramStatus] = useState('')
  const [mentorStatus, setMentorStatus] = useState('pending')
  const [safetyStatus, setSafetyStatus] = useState('open')

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

  if (authLoading || !isReady) {
    return <AdminLoading variant="users" />
  }

  return (
    <div>
      <AdminPageHeader
        title="Youth Leadership"
        description="Moderate organizations, mentors, programs, and safety reports."
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
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AdminStatCard
              label="Pending orgs"
              value={data.summary.pending_organizations}
              icon={Building2}
            />
            <AdminStatCard
              label="Published programs"
              value={data.summary.published_programs}
              icon={Award}
            />
            <AdminStatCard
              label="Pending mentors"
              value={data.summary.pending_mentors}
              icon={UserCheck}
            />
            <AdminStatCard
              label="Open safety"
              value={data.summary.open_safety_reports}
              icon={Flag}
              highlight={data.summary.open_safety_reports > 0}
            />
            <AdminStatCard
              label="Applications"
              value={data.summary.total_applications}
            />
            <AdminStatCard
              label="Active enrollments"
              value={data.summary.active_enrollments}
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <select
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={orgStatus}
              onChange={(e) => setOrgStatus(e.target.value)}
              aria-label="Organization filter"
            >
              <option value="">All orgs</option>
              <option value="pending">Pending orgs</option>
              <option value="verified">Verified orgs</option>
              <option value="rejected">Rejected orgs</option>
              <option value="suspended">Suspended orgs</option>
            </select>
            <select
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={programStatus}
              onChange={(e) => setProgramStatus(e.target.value)}
              aria-label="Program filter"
            >
              <option value="">All programs</option>
              <option value="pending_review">Pending review</option>
              <option value="published">Published</option>
              <option value="suspended">Suspended</option>
              <option value="draft">Draft</option>
            </select>
            <select
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={mentorStatus}
              onChange={(e) => setMentorStatus(e.target.value)}
              aria-label="Mentor filter"
            >
              <option value="">All mentors</option>
              <option value="pending">Pending mentors</option>
              <option value="verified">Verified mentors</option>
              <option value="rejected">Rejected mentors</option>
              <option value="suspended">Suspended mentors</option>
            </select>
            <select
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              value={safetyStatus}
              onChange={(e) => setSafetyStatus(e.target.value)}
              aria-label="Safety filter"
            >
              <option value="">All safety reports</option>
              <option value="open">Open</option>
              <option value="under_review">Under review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Organizations</h2>
              {data.organizations.length === 0 ? (
                <div className={AP.card}>
                  <AdminEmptyState
                    icon={Building2}
                    title="No organizations for this filter"
                  />
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
                        <AdminTableCell>{org.name}</AdminTableCell>
                        <AdminTableCell>{org.country || '—'}</AdminTableCell>
                        <AdminTableCell className="capitalize">
                          {org.verification_status.replace(/_/g, ' ')}
                        </AdminTableCell>
                        <AdminTableCell>{formatDate(org.created_at)}</AdminTableCell>
                        <AdminTableCell>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                          </div>
                        </AdminTableCell>
                      </AdminTableRow>
                    ))}
                  </AdminTableBody>
                </AdminTable>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Mentors</h2>
              {data.mentors_pending.length === 0 ? (
                <div className={AP.card}>
                  <AdminEmptyState icon={UserCheck} title="No mentors for this filter" />
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
                        mentor.profile?.full_name ||
                        mentor.profile?.username ||
                        'Mentor'
                      return (
                      <AdminTableRow key={mentor.id}>
                        <AdminTableCell>
                          <div className="flex items-center gap-3">
                            <YouthAvatar
                              src={mentor.profile?.avatar_url}
                              name={mentorName}
                              size="sm"
                            />
                            <div>
                              <p>{mentorName}</p>
                              {mentor.bio ? (
                                <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                                  {mentor.bio}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </AdminTableCell>
                        <AdminTableCell className="capitalize">
                          {mentor.verification_status.replace(/_/g, ' ')}
                        </AdminTableCell>
                        <AdminTableCell>{formatDate(mentor.created_at)}</AdminTableCell>
                        <AdminTableCell>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                          </div>
                        </AdminTableCell>
                      </AdminTableRow>
                      )
                    })}
                  </AdminTableBody>
                </AdminTable>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Programs</h2>
              {data.programs.length === 0 ? (
                <div className={AP.card}>
                  <AdminEmptyState icon={Award} title="No programs for this filter" />
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
                        <AdminTableCell>{program.title}</AdminTableCell>
                        <AdminTableCell>
                          {program.organization?.name || '—'}
                        </AdminTableCell>
                        <AdminTableCell className="capitalize">
                          {program.status.replace(/_/g, ' ')}
                        </AdminTableCell>
                        <AdminTableCell>{formatDate(program.created_at)}</AdminTableCell>
                        <AdminTableCell>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                          </div>
                        </AdminTableCell>
                      </AdminTableRow>
                    ))}
                  </AdminTableBody>
                </AdminTable>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Safety reports</h2>
              {data.safety_reports.length === 0 ? (
                <div className={AP.card}>
                  <AdminEmptyState icon={Flag} title="No safety reports for this filter" />
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
                          <p className="line-clamp-2 max-w-md text-sm">
                            {report.description}
                          </p>
                        </AdminTableCell>
                        <AdminTableCell className="capitalize">
                          {report.status.replace(/_/g, ' ')}
                        </AdminTableCell>
                        <AdminTableCell>{formatDate(report.created_at)}</AdminTableCell>
                        <AdminTableCell>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                            <button
                              type="button"
                              className={AP.btnSecondary}
                              disabled={busy}
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
                            </button>
                          </div>
                        </AdminTableCell>
                      </AdminTableRow>
                    ))}
                  </AdminTableBody>
                </AdminTable>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
