'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import AgreementsPanel from '@/features/gsch/components/panels/AgreementsPanel'

export default function GlobalHubAgreementsPage() {
  return (
    <GschPageShell
      title="Partnership Builder"
      subtitle="Draft structured agreements, track milestones, and record approval intent — not legal e-signatures."
    >
      <AgreementsPanel />
    </GschPageShell>
  )
}
