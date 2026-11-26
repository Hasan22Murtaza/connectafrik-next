'use client'

import { Suspense } from 'react'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import PartnershipsPanel from '@/features/gsch/components/panels/PartnershipsPanel'

export default function GlobalHubPartnershipsPage() {
  return (
    <GschPageShell
      title="Partnerships"
      subtitle="Review inbound requests, track outbound proposals, and manage active sister-city collaborations."
    >
      <Suspense fallback={null}>
        <PartnershipsPanel />
      </Suspense>
    </GschPageShell>
  )
}
