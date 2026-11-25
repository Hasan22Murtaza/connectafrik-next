'use client'

import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD } from '@/features/gsch/constants/styles'
import type { GschPartnershipRequest } from '@/shared/types/gsch'

export default function PartnershipRequestCard({
  request,
  busy,
  onAccept,
  onDecline,
  onWithdraw,
}: {
  request: GschPartnershipRequest
  busy?: boolean
  onAccept?: () => void
  onDecline?: () => void
  onWithdraw?: () => void
}) {
  const counterpart =
    request.direction === 'sent'
      ? request.target_organization?.name ||
        request.target_city?.name ||
        'Target partner'
      : request.requesting_organization?.name ||
        request.requesting_city?.name ||
        'Requesting partner'

  const canRespond =
    request.direction === 'received' && request.status === 'pending'
  const canWithdraw =
    request.direction === 'sent' &&
    (request.status === 'pending' || request.status === 'draft')

  return (
    <article className={GSCH_CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-content">{request.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {request.partnership_type.replace(/_/g, ' ')} · {counterpart}
            {request.direction ? ` · ${request.direction}` : ''}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {request.message ? (
        <p className="mt-3 line-clamp-3 text-sm text-content-secondary">
          {request.message}
        </p>
      ) : null}

      {(canRespond || canWithdraw) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canRespond ? (
            <>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={busy}
                onClick={onAccept}
              >
                Accept
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={busy}
                onClick={onDecline}
              >
                Decline
              </button>
            </>
          ) : null}
          {canWithdraw ? (
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={onWithdraw}
            >
              Withdraw
            </button>
          ) : null}
        </div>
      )}
    </article>
  )
}
