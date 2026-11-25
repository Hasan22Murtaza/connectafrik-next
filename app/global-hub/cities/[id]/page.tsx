'use client'

import { useParams } from 'next/navigation'
import GschPageShell from '@/features/gsch/components/GschPageShell'
import CityDetailPanel from '@/features/gsch/components/panels/CityDetailPanel'

export default function GlobalHubCityDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')

  return (
    <GschPageShell
      title="City profile"
      subtitle="Explore collaboration details and save cities you care about."
    >
      {id ? <CityDetailPanel cityId={id} /> : null}
    </GschPageShell>
  )
}
