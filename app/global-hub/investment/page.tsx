'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import InvestmentMarketplacePanel from '@/features/gsch/components/panels/InvestmentMarketplacePanel'

export default function GlobalHubInvestmentPage() {
  return (
    <GschPageShell
      title="Investment marketplace"
      subtitle="Discover partnership and investment projects across sister cities. No payments are processed on this platform."
    >
      <InvestmentMarketplacePanel />
    </GschPageShell>
  )
}
