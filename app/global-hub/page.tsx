'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import HomePanel from '@/features/gsch/components/panels/HomePanel'

export default function GlobalHubHomePage() {
  return (
    <GschPageShell
      title="Global Sister Cities Hub"
      subtitle="Connect municipalities, institutions, and partners for cross-border collaboration."
    >
      <HomePanel />
    </GschPageShell>
  )
}
