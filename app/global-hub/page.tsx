'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import HomePanel from '@/features/gsch/components/panels/HomePanel'

export default function GlobalHubHomePage() {
  return (
    <GschPageShell
      title="Global Hub Dashboard"
      subtitle="Overview of sister-city partnerships, verified organizations, investment opportunities, and international collaboration."
    >
      <HomePanel />
    </GschPageShell>
  )
}
