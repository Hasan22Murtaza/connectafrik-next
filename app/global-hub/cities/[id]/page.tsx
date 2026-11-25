'use client'

import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import CityDetailPanel from '@/features/gsch/components/panels/CityDetailPanel'

export default function GlobalHubCityDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell>
      {id ? <CityDetailPanel cityId={id} /> : null}
    </GschPageShell>
  )
}
