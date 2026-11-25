'use client'

import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import OpportunityDetailPanel from '@/features/gsch/components/panels/OpportunityDetailPanel'

export default function GlobalHubOpportunityDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      {id ? <OpportunityDetailPanel id={id} /> : null}
    </GschPageShell>
  )
}
