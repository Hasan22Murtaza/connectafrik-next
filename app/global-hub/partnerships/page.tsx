'use client'

import { Suspense } from 'react'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import PartnershipsPanel from '@/features/gsch/components/panels/PartnershipsPanel'

export default function GlobalHubPartnershipsPage() {
  return (
    <GschPageShell
      title="Partnerships"
      subtitle="Send and respond to partnership requests, and manage active sister-city collaborations."
    >
      <Suspense fallback={null}>
        <PartnershipsPanel />
      </Suspense>
    </GschPageShell>
  )
}
