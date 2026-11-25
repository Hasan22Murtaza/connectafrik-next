'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import AnalyticsDashboardPanel from '@/features/gsch/components/panels/AnalyticsDashboardPanel'

export default function GlobalHubAnalyticsPage() {
  return (
    <GschPageShell
      title="Analytics"
      subtitle="Live platform aggregates from CribsTalk GSCH tables."
    >
      <AnalyticsDashboardPanel />
    </GschPageShell>
  )
}
