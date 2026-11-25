'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import BusinessProfileDetailPanel from '@/features/gsch/components/panels/BusinessProfileDetailPanel'

export default function GlobalHubBusinessDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      <Suspense fallback={null}>
        {id ? <BusinessProfileDetailPanel id={id} /> : null}
      </Suspense>
    </GschPageShell>
  )
}
