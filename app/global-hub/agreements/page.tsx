'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import AgreementsPanel from '@/features/gsch/components/panels/AgreementsPanel'

export default function GlobalHubAgreementsPage() {
  return (
    <GschPageShell
      title="Partnership agreements"
      subtitle="Draft structured MOUs, track workflow status, and record approval intent — not legal e-signatures."
    >
      <AgreementsPanel />
    </GschPageShell>
  )
}
