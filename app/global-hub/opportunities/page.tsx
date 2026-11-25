'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import OpportunitiesPanel from '@/features/gsch/components/panels/OpportunitiesPanel'

export default function GlobalHubOpportunitiesPage() {
  return (
    <GschPageShell
      title="Opportunities"
      subtitle="Discover grants, conferences, trade missions, and sister-city programs from verified partners."
    >
      <OpportunitiesPanel />
    </GschPageShell>
  )
}
