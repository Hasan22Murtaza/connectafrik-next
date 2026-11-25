'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import ClimateProjectDetailPanel from '@/features/gsch/components/panels/ClimateProjectDetailPanel'

export default function GlobalHubClimateDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      <Suspense fallback={null}>
        {id ? <ClimateProjectDetailPanel id={id} /> : null}
      </Suspense>
    </GschPageShell>
  )
}
