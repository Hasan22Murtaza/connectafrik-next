'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import TourismInitiativeDetailPanel from '@/features/gsch/components/panels/TourismInitiativeDetailPanel'

export default function GlobalHubTourismDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      <Suspense fallback={null}>
        {id ? <TourismInitiativeDetailPanel id={id} /> : null}
      </Suspense>
    </GschPageShell>
  )
}
