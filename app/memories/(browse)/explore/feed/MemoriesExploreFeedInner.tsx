'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { MemoriesVerticalFeed } from '@/features/social/components/MemoriesVerticalFeed'
import { REEL_CATEGORIES, ReelCategory } from '@/shared/types/reels'

export function MemoriesExploreFeedInner() {
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
    return `/memories/explore${q ? `?${q}` : ''}`
  }, [exploreCategory])

  return (
    <MemoriesVerticalFeed
      feed="explore"
      category={exploreCategory}
      exploreBackHref={backHref}
      startReelId={start}
    />
  )
}
