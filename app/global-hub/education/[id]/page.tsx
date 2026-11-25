'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import EducationProgramDetailPanel from '@/features/gsch/components/panels/EducationProgramDetailPanel'

export default function GlobalHubEducationDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      <Suspense fallback={null}>
        {id ? <EducationProgramDetailPanel id={id} /> : null}
      </Suspense>
    </GschPageShell>
  )
}
