'use client'

import { useSearchParams } from 'next/navigation'
import { ReelsVerticalFeed } from '@/features/social/components/ReelsVerticalFeed'

export function FollowingFeedInner() {
  const searchParams = useSearchParams()
  const start = searchParams.get('start')

  return (
    <ReelsVerticalFeed
      feed="following"
      exploreBackHref="/reels/following"
      listBackLabel="Following"
      startReelId={start}
    />
  )
}
