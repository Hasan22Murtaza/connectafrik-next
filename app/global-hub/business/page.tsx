'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import BusinessCentrePanel from '@/features/gsch/components/panels/BusinessCentrePanel'

export default function GlobalHubBusinessPage() {
  return (
    <GschPageShell
      title="Business Connection Centre"
      subtitle="Discover trade profiles, publish what you seek and offer, and manage inbound enquiries."
    >
      <BusinessCentrePanel />
    </GschPageShell>
  )
}
