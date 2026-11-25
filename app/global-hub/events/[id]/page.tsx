'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import EventDetailPanel from '@/features/gsch/components/panels/EventDetailPanel'

export default function GlobalHubEventDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      <Suspense fallback={null}>
        {id ? <EventDetailPanel id={id} /> : null}
      </Suspense>
    </GschPageShell>
  )
}
