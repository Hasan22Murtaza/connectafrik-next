'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import VerificationPanel from '@/features/gsch/components/panels/VerificationPanel'

export default function GlobalHubVerificationPage() {
  return (
    <GschPageShell
      title="Verification"
      subtitle="Submit documents for human review. Organizations are never auto-verified."
    >
      <VerificationPanel />
    </GschPageShell>
  )
}
