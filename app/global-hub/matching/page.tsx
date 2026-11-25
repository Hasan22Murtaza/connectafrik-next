'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import MatchingPanel from '@/features/gsch/components/panels/MatchingPanel'

function MatchingPageInner() {
  const searchParams = useSearchParams()
  const cityId = searchParams?.get('city_id') || undefined

  return (
    <GschPageShell
      title="Partner matching"
      subtitle="Transparent weighted scores from real city profile overlap — no invented compatibility."
    >
      <MatchingPanel initialCityId={cityId} />
    </GschPageShell>
  )
}

export default function GlobalHubMatchingPage() {
  return (
    <Suspense fallback={null}>
      <MatchingPageInner />
    </Suspense>
  )
}
