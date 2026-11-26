'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import EducationExchangePanel from '@/features/gsch/components/panels/EducationExchangePanel'

export default function GlobalHubEducationPage() {
  return (
    <GschPageShell
      title="Education Exchange"
      subtitle="Programs, scholarships, and research partnerships between cities and institutions."
    >
      <EducationExchangePanel />
    </GschPageShell>
  )
}
