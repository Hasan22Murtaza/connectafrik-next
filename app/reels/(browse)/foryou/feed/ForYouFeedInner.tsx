'use client'

import { useSearchParams } from 'next/navigation'
import { ReelsVerticalFeed } from '@/features/social/components/ReelsVerticalFeed'

export function ForYouFeedInner() {
  const searchParams = useSearchParams()
  const start = searchParams.get('start')

  return (
    <ReelsVerticalFeed
      feed="foryou"
      exploreBackHref="/reels/foryou"
      listBackLabel="For you"
      startReelId={start}
    />
  )
}
