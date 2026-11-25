'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD, GSCH_FIELD } from '@/features/gsch/constants/styles'
import type { GschOrganization, GschVerification } from '@/shared/types/gsch'

export default function VerificationPanel() {
  const { user, loading: authLoading } = useAuth()
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [items, setItems] = useState<GschVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [organizationId, setOrganizationId] = useState('')
  const [notes, setNotes] = useState('')
  const [documentUrls, setDocumentUrls] = useState('')

  const load = useCallback(async () => {
    const [orgData, verData] = await Promise.all([
      apiClient.get<GschOrganization[]>('/api/gsch/organizations'),
      apiClient.get<GschVerification[]>('/api/gsch/verifications'),
    ])
    const orgList = Array.isArray(orgData) ? orgData : []
    setOrgs(orgList)
    setItems(Array.isArray(verData) ? verData : [])
    if (!organizationId && orgList[0]?.id) setOrganizationId(orgList[0].id)
  }, [organizationId])

  useEffect(() => {
    if (authLoading || !user) return
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load verification data')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id])

  async function submit(submitNow: boolean) {
    if (!organizationId) {
      toast.error('Select an organization')
      return
    }
    setBusy(true)
    try {
      await apiClient.post('/api/gsch/verifications', {
        organization_id: organizationId,
        notes: notes.trim() || null,
        document_urls: documentUrls
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        submit: submitNow,
      })
      toast.success(
        submitNow
          ? 'Verification submitted for human review'
          : 'Verification draft saved'
      )
      setNotes('')
      setDocumentUrls('')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save verification')
    } finally {
      setBusy(false)
    }
  }

  async function resubmit(id: string) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/verifications/${id}`, { submit: true })
      toast.success('Verification resubmitted')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resubmit')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }

  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-6">
      <div className={`${GSCH_CARD} border-amber-500/20 bg-amber-500/5`}>
        <p className="text-sm text-content-secondary">
          Verification is reviewed by CribsTalk platform admins. Organizations are never
          auto-verified — including municipalities. Upload supporting documents and wait for
          a human decision.
        </p>
      </div>

      {orgs.length === 0 ? (
        <EmptyState
          title="Create an organization first"
          description="You need an organization before you can submit verification."
        />
      ) : (
        <div className={`${GSCH_CARD} space-y-3`}>
          <h3 className="font-semibold text-content">Submit verification</h3>
          <div>
            <label htmlFor="gsch-ver-org" className="mb-1 block text-sm font-medium text-content">
              Organization
            </label>
            <select
              id="gsch-ver-org"
              className={GSCH_FIELD}
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.verification_status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gsch-ver-docs" className="mb-1 block text-sm font-medium text-content">
              Document URLs (one per line)
            </label>
            <textarea
              id="gsch-ver-docs"
              className={`${GSCH_FIELD} min-h-[88px]`}
              value={documentUrls}
              onChange={(e) => setDocumentUrls(e.target.value)}
              placeholder="https://… (upload to Bunny gsch-docs folder first)"
            />
          </div>
          <div>
            <label htmlFor="gsch-ver-notes" className="mb-1 block text-sm font-medium text-content">
              Notes for reviewers
            </label>
            <textarea
              id="gsch-ver-notes"
              className={`${GSCH_FIELD} min-h-[72px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => submit(false)}
            >
              Save draft
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy}
              onClick={() => submit(true)}
            >
              Submit for review
            </button>
          </div>
        </div>
      )}

      <section>
        <h3 className="mb-3 font-semibold text-content">Your verification requests</h3>
        {items.length === 0 ? (
          <EmptyState title="No verification requests yet" />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className={GSCH_CARD}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-content">
                      {item.organization?.name || 'Organization'}
                    </p>
                    <p className="mt-1 text-xs text-content-tertiary">
                      Updated {new Date(item.updated_at).toLocaleString()}
                    </p>
                    {item.admin_notes ? (
                      <p className="mt-2 text-sm text-content-secondary">
                        Admin notes: {item.admin_notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    {['draft', 'additional_info_required'].includes(item.status) ? (
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        disabled={busy}
                        onClick={() => resubmit(item.id)}
                      >
                        Submit
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
