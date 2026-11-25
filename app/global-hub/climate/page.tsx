'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import ClimateMarketplacePanel from '@/features/gsch/components/panels/ClimateMarketplacePanel'

export default function GlobalHubClimatePage() {
  return (
    <GschPageShell
      title="Climate & Sustainability Marketplace"
      subtitle="Connect on renewable energy, carbon reduction, waste, water, and climate adaptation projects."
    >
      <ClimateMarketplacePanel />
    </GschPageShell>
  )
}
