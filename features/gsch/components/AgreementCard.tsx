'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschAgreement } from '@/shared/types/gsch'

export default function AgreementCard({ agreement }: { agreement: GschAgreement }) {
  const parties = [
    agreement.organization_a?.name,
    agreement.organization_b?.name,
  ]
    .filter(Boolean)
    .join(' ↔ ')

  return (
    <Link
      href={`/global-hub/agreements/${agreement.id}`}
      className={`${GSCH_CARD_INTERACTIVE} block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{agreement.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {agreement.template_type.replace(/_/g, ' ')}
            {parties ? ` · ${parties}` : ''}
          </p>
        </div>
        <StatusBadge status={agreement.status} />
      </div>
      {agreement.objectives ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">
          {agreement.objectives}
        </p>
      ) : null}
      {agreement.duration_label ? (
        <p className="mt-2 text-xs text-content-tertiary">
          Duration: {agreement.duration_label}
        </p>
      ) : null}
    </Link>
  )
}
