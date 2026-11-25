'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import ProjectDetailPanel from '@/features/gsch/components/panels/ProjectDetailPanel'

export default function GlobalHubInvestmentDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      <Suspense fallback={null}>
        {id ? <ProjectDetailPanel id={id} /> : null}
      </Suspense>
    </GschPageShell>
  )
}
