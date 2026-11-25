'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import ComingSoonPanel from '@/features/gsch/components/ComingSoonPanel'

function ComingSoonContent() {
  const searchParams = useSearchParams()
  const module = searchParams.get('m')

  return (
    <GschPageShell title="Coming soon" subtitle="This Global Hub module is planned for a later phase.">
      <ComingSoonPanel module={module} />
    </GschPageShell>
  )
}

export default function GlobalHubComingSoonPage() {
  return (
    <Suspense
      fallback={
        <GschPageShell title="Coming soon">
          <ComingSoonPanel />
        </GschPageShell>
      }
    >
      <ComingSoonContent />
    </Suspense>
  )
}
