'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import ClimateMarketplacePanel from '@/features/gsch/components/panels/ClimateMarketplacePanel'

export default function GlobalHubClimatePage() {
  return (
    <GschPageShell
      title="Climate & Sustainability Marketplace"
      subtitle="Projects in energy, carbon, water, waste, and climate adaptation seeking partners."
    >
      <ClimateMarketplacePanel />
    </GschPageShell>
  )
}
