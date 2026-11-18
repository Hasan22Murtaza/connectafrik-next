import { Suspense } from 'react'
import { ReelsAnalyticsPanel } from '@/features/social/components/ReelsAnalyticsPanel'
import { ReelsAnalyticsShimmer } from '@/shared/components/ui/ShimmerLoaders'

export default function ReelsAnalyticsPage() {
  return (
    <Suspense fallback={<ReelsAnalyticsShimmer />}>
      <ReelsAnalyticsPanel />
    </Suspense>
  )
}