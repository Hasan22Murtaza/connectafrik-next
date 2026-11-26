'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import InvestmentMarketplacePanel from '@/features/gsch/components/panels/InvestmentMarketplacePanel'

export default function GlobalHubInvestmentPage() {
  return (
    <GschPageShell
      title="Investment marketplace"
      subtitle="Browse partnership and funding opportunities across sister cities. Express interest and connect off-platform."
    >
      <InvestmentMarketplacePanel />
    </GschPageShell>
  )
}
