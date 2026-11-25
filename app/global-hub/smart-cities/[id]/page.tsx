'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import InnovationChallengeDetailPanel from '@/features/gsch/components/panels/InnovationChallengeDetailPanel'

export default function GlobalHubSmartCitiesDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      <Suspense fallback={null}>
        {id ? <InnovationChallengeDetailPanel id={id} /> : null}
      </Suspense>
    </GschPageShell>
  )
}
