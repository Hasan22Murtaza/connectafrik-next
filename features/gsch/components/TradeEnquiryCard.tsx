'use client'

import { GSCH_CARD } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschTradeEnquiry } from '@/shared/types/gsch'

export default function TradeEnquiryCard({
  enquiry,
  onRespond,
  onWithdraw,
  onClose,
  busy = false,
}: {
  enquiry: GschTradeEnquiry
  onRespond?: (id: string, notes: string) => void
  onWithdraw?: (id: string) => void
  onClose?: (id: string) => void
  busy?: boolean
}) {
  const counterpart =
    enquiry.direction === 'sent'
      ? enquiry.to_organization?.name || enquiry.to_business_profile?.display_name
      : enquiry.from_organization?.name

  return (
    <article className={GSCH_CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{enquiry.subject}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {enquiry.enquiry_type.replace(/_/g, ' ')}
            {counterpart ? ` · ${counterpart}` : ''}
            {enquiry.direction ? ` · ${enquiry.direction}` : ''}
          </p>
        </div>
        <StatusBadge status={enquiry.status} />
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-content-secondary">
        {enquiry.message}
      </p>

      {enquiry.response_notes ? (
        <div className="mt-3 rounded-lg bg-surface-secondary/70 p-3 text-sm text-content-secondary">
          <p className="text-xs font-medium text-content-tertiary">Response</p>
          <p className="mt-1 whitespace-pre-wrap">{enquiry.response_notes}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {enquiry.direction === 'received' && enquiry.status === 'open' && onRespond ? (
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={busy}
            onClick={() => {
              const notes = window.prompt('Response notes (optional)') || ''
              onRespond(enquiry.id, notes)
            }}
          >
            Respond
          </button>
        ) : null}
        {enquiry.direction === 'sent' && enquiry.status === 'open' && onWithdraw ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={busy}
            onClick={() => onWithdraw(enquiry.id)}
          >
            Withdraw
          </button>
        ) : null}
        {enquiry.status !== 'closed' && enquiry.status !== 'withdrawn' && onClose ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={busy}
            onClick={() => onClose(enquiry.id)}
          >
            Close
          </button>
        ) : null}
      </div>
    </article>
  )
}
