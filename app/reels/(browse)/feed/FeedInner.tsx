'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { ReelsVerticalFeed } from '@/features/social/components/ReelsVerticalFeed'
import { REEL_CATEGORIES, ReelCategory, ReelFeedType } from '@/shared/types/reels'

const FEEDS: readonly ReelFeedType[] = [
  'foryou',
  'explore',
  'following',
  'mine',
  'saved',
  'liked',
  'reposted',
]

function parseFeed(raw: string | null): ReelFeedType {
  if (raw && (FEEDS as readonly string[]).includes(raw)) return raw as ReelFeedType
  return 'foryou'
}

export function FeedInner() {
  const searchParams = useSearchParams()
  const start = searchParams.get('start')
  const feed = parseFeed(searchParams.get('feed'))
  const categoryParam = searchParams.get('category')
  const exploreCategory =
    feed === 'explore' &&
    categoryParam &&
    REEL_CATEGORIES.some((c) => c.value === categoryParam)
      ? (categoryParam as ReelCategory)
      : undefined

  const { backHref, listBackLabel } = useMemo(() => {
    switch (feed) {
      case 'following':
        return { backHref: '/reels/following', listBackLabel: 'Following' }
      case 'explore': {
        const p = new URLSearchParams()
        if (exploreCategory) p.set('category', exploreCategory)
        const q = p.toString()
        return {
          backHref: `/reels/explore${q ? `?${q}` : ''}`,
          listBackLabel: 'Explore',
        }
      }
      case 'mine':
        return { backHref: '/reels/my-videos', listBackLabel: 'My videos' }
      case 'saved':
        return { backHref: '/reels/saved', listBackLabel: 'Saved' }
      case 'liked':
        return { backHref: '/reels/liked', listBackLabel: 'Liked' }
      case 'reposted':
        return { backHref: '/reels/reposted', listBackLabel: 'Reposted' }
      default:
        return { backHref: '/reels/foryou', listBackLabel: 'For you' }
    }
  }, [feed, exploreCategory])

  return (
    <ReelsVerticalFeed
      feed={feed}
      category={exploreCategory}
      exploreBackHref={backHref}
      listBackLabel={listBackLabel}
      startReelId={start}
    />
  )
}
