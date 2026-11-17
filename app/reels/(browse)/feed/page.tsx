import { Suspense } from 'react'
import { FeedInner } from './FeedInner'
import { ReelsVerticalFeedShimmer } from '@/shared/components/ui/ShimmerLoaders'

function Fallback() {
  return <ReelsVerticalFeedShimmer />
}

export default function ReelsFeedPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <FeedInner />
    </Suspense>
  )
}
