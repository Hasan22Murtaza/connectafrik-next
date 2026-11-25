'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import {
  GschDataTable,
  GschTableBody,
  GschTableCell,
  GschTableHead,
  GschTableHeadCell,
  GschTableRow,
} from '@/features/gsch/components/GschDataTable'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD } from '@/features/gsch/constants/styles'
import type { GschPaginated, GschTradeEnquiry } from '@/shared/types/gsch'

export default function TradeEnquiriesPanel() {
  const { user, loading: authLoading } = useAuth()
  const [enquiries, setEnquiries] = useState<GschTradeEnquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschPaginated<GschTradeEnquiry>>(
        '/api/gsch/trade-enquiries?limit=40'
      )
      setEnquiries(data.data || [])
    } catch (err) {
      setEnquiries([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load enquiries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function enquiryAction(
    id: string,
    action: 'respond' | 'withdraw' | 'close',
    response_notes?: string
  ) {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/gsch/trade-enquiries/${id}`, {
        action,
        response_notes,
      })
      toast.success('Enquiry updated')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }
  if (!user) return <EmptyState title="Sign in required" />
  if (enquiries.length === 0) {
    return (
      <EmptyState
        title="No trade enquiries yet"
        description="Open a published business profile to send a trade enquiry."
      />
    )
  }

  return (
    <GschDataTable>
      <GschTableHead>
        <GschTableHeadCell>Subject</GschTableHeadCell>
        <GschTableHeadCell>Type</GschTableHeadCell>
        <GschTableHeadCell>Counterpart</GschTableHeadCell>
        <GschTableHeadCell>Status</GschTableHeadCell>
        <GschTableHeadCell align="right">Actions</GschTableHeadCell>
      </GschTableHead>
      <GschTableBody>
        {enquiries.map((enquiry) => {
          const counterpart =
            enquiry.direction === 'sent'
              ? enquiry.to_organization?.name ||
                enquiry.to_business_profile?.display_name
              : enquiry.from_organization?.name
          const busy = busyId === enquiry.id
          return (
            <GschTableRow key={enquiry.id}>
              <GschTableCell className="min-w-[160px]">
                <p className="font-semibold text-content">{enquiry.subject}</p>
                {enquiry.direction ? (
                  <p className="mt-0.5 text-xs capitalize text-content-tertiary">
                    {enquiry.direction}
                  </p>
                ) : null}
              </GschTableCell>
              <GschTableCell className="capitalize">
                {enquiry.enquiry_type.replace(/_/g, ' ')}
              </GschTableCell>
              <GschTableCell>{counterpart || '—'}</GschTableCell>
              <GschTableCell>
                <StatusBadge status={enquiry.status} />
              </GschTableCell>
              <GschTableCell align="right">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {enquiry.direction === 'received' &&
                  enquiry.status === 'open' ? (
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => {
                        const notes = window.prompt('Response notes (optional)') || ''
                        enquiryAction(enquiry.id, 'respond', notes)
                      }}
                    >
                      Respond
                    </button>
                  ) : null}
                  {enquiry.direction === 'sent' && enquiry.status === 'open' ? (
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:opacity-50"
                      disabled={busy}
                      onClick={() => enquiryAction(enquiry.id, 'withdraw')}
                    >
                      Withdraw
                    </button>
                  ) : null}
                  {enquiry.status !== 'closed' && enquiry.status !== 'withdrawn' ? (
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:opacity-50"
                      disabled={busy}
                      onClick={() => enquiryAction(enquiry.id, 'close')}
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              </GschTableCell>
            </GschTableRow>
          )
        })}
      </GschTableBody>
    </GschDataTable>
  )
}
