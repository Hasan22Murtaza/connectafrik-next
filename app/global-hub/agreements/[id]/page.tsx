'use client'

import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import AgreementDetailPanel from '@/features/gsch/components/panels/AgreementDetailPanel'

export default function GlobalHubAgreementDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      {id ? <AgreementDetailPanel id={id} /> : null}
    </GschPageShell>
  )
}
