'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import AdminVerificationsPanel from '@/features/gsch/components/panels/AdminVerificationsPanel'

export default function GlobalHubAdminPage() {
  return (
    <GschPageShell
      title="Verification admin"
      subtitle="Review organization verification requests and assign badges."
    >
      <AdminVerificationsPanel />
    </GschPageShell>
  )
}
