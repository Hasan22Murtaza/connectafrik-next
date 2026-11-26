'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import VerificationPanel from '@/features/gsch/components/panels/VerificationPanel'

export default function GlobalHubVerificationPage() {
  return (
    <GschPageShell
      title="Verification"
      subtitle="Upload supporting documents for admin review—organizations are verified by people, not automation."
    >
      <VerificationPanel />
    </GschPageShell>
  )
}
