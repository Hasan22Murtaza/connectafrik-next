'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import EducationExchangePanel from '@/features/gsch/components/panels/EducationExchangePanel'

export default function GlobalHubEducationPage() {
  return (
    <GschPageShell
      title="Education Exchange"
      subtitle="University and school exchanges, research collaborations, scholarships, and international programs."
    >
      <EducationExchangePanel />
    </GschPageShell>
  )
}
