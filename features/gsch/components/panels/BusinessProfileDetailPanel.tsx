'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschDetailHeader from '@/features/gsch/components/GschDetailHeader'
import GschFormModal from '@/features/gsch/components/GschFormModal'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import {
  GSCH_CARD,
  GSCH_CHIP,
  GSCH_FIELD,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_TRADE_ENQUIRY_TYPES,
  type GschBusinessProfile,
  type GschOrganization,
  type GschTradeEnquiryType,
} from '@/shared/types/gsch'

export default function BusinessProfileDetailPanel({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [item, setItem] = useState<GschBusinessProfile | null>(null)
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showEnquiry, setShowEnquiry] = useState(false)
  const [enquiry, setEnquiry] = useState({
    from_organization_id: '',
    enquiry_type: 'general' as GschTradeEnquiryType,
    subject: '',
    message: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschBusinessProfile>(
        `/api/gsch/business-profiles/${id}`
      )
      setItem(data)
    } catch (err) {
      setItem(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadOrgs = useCallback(async () => {
    try {
      const orgRes = await apiClient.get<GschOrganization[]>(
        '/api/gsch/organizations?mine=1'
      )
      setOrgs(orgRes || [])
      setEnquiry((e) => ({
        ...e,
        from_organization_id: e.from_organization_id || orgRes?.[0]?.id || '',
      }))
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    loadOrgs()
  }, [authLoading, user?.id, load, loadOrgs])

  useEffect(() => {
    if (loading || !item || searchParams.get('enquire') !== '1') return
    const allowed =
      item.is_published &&
      orgs.length > 0 &&
      !orgs.some((o) => o.id === item.organization_id)
    if (allowed) setShowEnquiry(true)
    router.replace(`/global-hub/business/${id}`, { scroll: false })
  }, [loading, item, orgs, searchParams, router, id])

  async function sendEnquiry(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    if (!enquiry.from_organization_id) {
      toast.error('Select your organization')
      return
    }
    if (enquiry.from_organization_id === item.organization_id) {
      toast.error('Cannot send an enquiry to your own organization')
      return
    }
    setBusy(true)
    try {
      await apiClient.post('/api/gsch/trade-enquiries', {
        from_organization_id: enquiry.from_organization_id,
        to_organization_id: item.organization_id,
        to_business_profile_id: item.id,
        enquiry_type: enquiry.enquiry_type,
        subject: enquiry.subject,
        message: enquiry.message,
      })
      toast.success('Trade enquiry sent')
      setShowEnquiry(false)
      setEnquiry((prev) => ({ ...prev, subject: '', message: '' }))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-48 animate-pulse`} />
  }
  if (!user) return <EmptyState title="Sign in required" />
  if (!item) return <EmptyState title="Business profile not found" />

  const location = [item.city, item.country].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/business"
        backLabel="Back to business"
        title={item.display_name}
        badges={<StatusBadge status={item.is_published ? 'published' : 'draft'} />}
        subtitle={item.tagline || undefined}
        meta={location || undefined}
      />

      {item.description ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>About</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
            {item.description}
          </p>
        </section>
      ) : null}

      <section className={GSCH_CARD}>
        <h3 className={GSCH_SECTION_TITLE}>Trade focus</h3>
        <div className="mt-3 space-y-3">
          {item.seeking?.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-content-tertiary">Seeking</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.seeking.map((s) => (
                  <span key={s} className={GSCH_CHIP}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {item.offering?.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-content-tertiary">Offering</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.offering.map((o) => (
                  <span key={o} className={GSCH_CHIP}>
                    {o}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {item.industry_sectors?.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-content-tertiary">Sectors</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.industry_sectors.map((s) => (
                  <span key={s} className={GSCH_CHIP}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-content-tertiary">Website</dt>
            <dd className="text-content">{item.website || '—'}</dd>
          </div>
          <div>
            <dt className="text-content-tertiary">Employees</dt>
            <dd className="text-content">{item.employee_range || '—'}</dd>
          </div>
          <div>
            <dt className="text-content-tertiary">Established</dt>
            <dd className="text-content">{item.year_established || '—'}</dd>
          </div>
          <div>
            <dt className="text-content-tertiary">Languages</dt>
            <dd className="text-content">
              {item.languages?.length ? item.languages.join(', ') : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <GschFormModal
        open={showEnquiry}
        title="Send trade enquiry"
        onClose={() => setShowEnquiry(false)}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => setShowEnquiry(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="gsch-trade-enquiry"
              className="btn-primary text-sm"
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Send enquiry'}
            </button>
          </>
        }
      >
        <form id="gsch-trade-enquiry" onSubmit={sendEnquiry} className="space-y-3">
          <select
            className={`${GSCH_SELECT} w-full`}
            value={enquiry.from_organization_id}
            onChange={(e) =>
              setEnquiry((f) => ({ ...f, from_organization_id: e.target.value }))
            }
            required
          >
            {orgs
              .filter((o) => o.id !== item.organization_id)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
          <select
            className={`${GSCH_SELECT} w-full`}
            value={enquiry.enquiry_type}
            onChange={(e) =>
              setEnquiry((f) => ({
                ...f,
                enquiry_type: e.target.value as GschTradeEnquiryType,
              }))
            }
          >
            {GSCH_TRADE_ENQUIRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className={GSCH_FIELD}
            placeholder="Subject"
            value={enquiry.subject}
            onChange={(e) => setEnquiry((f) => ({ ...f, subject: e.target.value }))}
            required
          />
          <textarea
            className={GSCH_FIELD}
            rows={4}
            placeholder="Message"
            value={enquiry.message}
            onChange={(e) => setEnquiry((f) => ({ ...f, message: e.target.value }))}
            required
          />
        </form>
      </GschFormModal>
    </div>
  )
}
