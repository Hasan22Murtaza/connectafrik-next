'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import BusinessCentrePanel from '@/features/gsch/components/panels/BusinessCentrePanel'

export default function GlobalHubBusinessPage() {
  return (
    <GschPageShell
      title="Business Connection Centre"
      subtitle="Publish your trade profile and send enquiries to buyers, suppliers, and partners."
    >
      <BusinessCentrePanel />
    </GschPageShell>
  )
}
