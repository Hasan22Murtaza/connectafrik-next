'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import OpportunitiesPanel from '@/features/gsch/components/panels/OpportunitiesPanel'

export default function GlobalHubOpportunitiesPage() {
  return (
    <GschPageShell
      title="Opportunities"
      subtitle="Discover grants, conferences, and trade programs — post listings from your verified organization."
    >
      <OpportunitiesPanel />
    </GschPageShell>
  )
}
