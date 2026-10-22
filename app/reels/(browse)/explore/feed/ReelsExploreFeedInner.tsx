'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { ReelsVerticalFeed } from '@/features/social/components/ReelsVerticalFeed'
import { REEL_CATEGORIES, ReelCategory } from '@/shared/types/reels'

export function ReelsExploreFeedInner() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  const start = searchParams.get('start')
  const exploreCategory =
    categoryParam && REEL_CATEGORIES.some((c) => c.value === categoryParam)
      ? (categoryParam as ReelCategory)
      : undefined

  const backHref = useMemo(() => {
    const p = new URLSearchParams()
    if (exploreCategory) p.set('category', exploreCategory)
    const q = p.toString()
    return `/reels/explore${q ? `?${q}` : ''}`
  }, [exploreCategory])

  return (
    <ReelsVerticalFeed
      feed="explore"
      category={exploreCategory}
      exploreBackHref={backHref}
      listBackLabel="Explore"
      startReelId={start}
    />
  )
}
