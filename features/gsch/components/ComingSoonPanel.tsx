'use client'

import Link from 'next/link'
import { Sparkles } from '@/shared/icons'
import { GSCH_CARD } from '@/features/gsch/constants/styles'

const LABELS: Record<string, string> = {
  'opportunity-map': 'Opportunity Map',
  'partner-matching': 'Partner Matching',
  investment: 'Investment',
  business: 'Business',
  education: 'Education',
  tourism: 'Tourism',
  'smart-cities': 'Smart Cities',
  climate: 'Climate',
  'partnership-builder': 'Partnership Builder',
  events: 'Events',
  analytics: 'Analytics',
}

export default function ComingSoonPanel({ module }: { module?: string | null }) {
  const label = (module && LABELS[module]) || 'This module'

  return (
    <div className={`${GSCH_CARD} mx-auto max-w-xl text-center`}>
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"
        aria-hidden
      >
        <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.75} />
      </div>
      <h2 className="text-lg font-semibold text-content">{label} is coming soon</h2>
      <p className="mt-2 text-sm leading-relaxed text-content-secondary">
        Phase 1 of the Global Sister Cities Partnership Hub focuses on organizations,
        verification, and city profiles. This section will unlock in a later release.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/global-hub" className="btn-primary text-sm">
          Back to Home
        </Link>
        <Link href="/global-hub/discover" className="btn-secondary text-sm">
          Discover cities
        </Link>
      </div>
    </div>
  )
}
