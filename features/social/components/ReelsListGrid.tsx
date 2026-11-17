'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Home } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useReels } from '@/shared/hooks/useReels'
import { REEL_CATEGORIES, ReelCategory, ReelFeedType } from '@/shared/types/reels'
import { ReelCard } from '@/features/social/components/ReelCard'
import { ReelsNav } from '@/features/social/components/ReelsNav'
import { ReelsBrowseHeader } from '@/features/social/components/ReelsBrowseHeader'
import { reelsFeedHref } from '@/lib/reels/feedHref'
import {
  ReelsGridLoadMoreShimmer,
  ReelsGridShimmer,
} from '@/shared/components/ui/ShimmerLoaders'

type Props = {
  feed: Extract<ReelFeedType, 'foryou' | 'following' | 'explore'>
}

function ListBody({ feed }: Props) {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  const exploreCategory =
    feed === 'explore' &&
    categoryParam &&
    REEL_CATEGORIES.some((c) => c.value === categoryParam)
      ? (categoryParam as ReelCategory)
      : undefined

  const sentinelRef = useRef<HTMLDivElement>(null)

  const reelFilters = useMemo(() => {
    const f: { feed: ReelFeedType; category?: ReelCategory } = { feed }
    if (feed === 'explore' && exploreCategory) f.category = exploreCategory
    return f
  }, [feed, exploreCategory])

  const sortOptions = useMemo(
    () =>
      feed === 'foryou'
        ? ({ field: 'engagement_score' as const, order: 'desc' as const })
        : ({ field: 'created_at' as const, order: 'desc' as const }),
    [feed]
  )

  const enabled = !(feed === 'following' && !user?.id)
  const { reels, loading, error, hasMore, loadMore, refresh } = useReels(reelFilters, sortOptions, {
    enabled,
  })

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '480px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, loadMore, reels.length])

  const feedHrefFor = useCallback(
    (reelId: string) =>
      reelsFeedHref({ start: reelId, feed, category: exploreCategory }),
    [feed, exploreCategory]
  )

  const gridClass =
    'columns-3 gap-2 sm:columns-4 sm:gap-2.5 lg:columns-5 xl:columns-6 2xl:columns-7 [column-fill:_balance]'

  if (!enabled) {
    return (
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col bg-surface text-content">
        <ReelsBrowseHeader feed={feed} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <h2 className="text-lg font-semibold">Following</h2>
          <p className="mt-2 max-w-sm text-sm text-content-secondary">Sign in to see reels from creators you follow.</p>
          <Link href="/signin" className="btn-primary mt-5 inline-flex rounded-full px-8 py-2.5 text-sm font-semibold">
            Log in
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col bg-surface text-content">
        <ReelsBrowseHeader feed={feed} activeCategory={exploreCategory} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-content-secondary">{error}</p>
          <button type="button" onClick={refresh} className="btn-primary mt-4 inline-flex rounded-full text-sm">
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto w-full max-w-[1600px] min-h-[calc(100dvh-4.5rem)] bg-surface pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-content lg:pb-10">
      <ReelsBrowseHeader feed={feed} activeCategory={exploreCategory} />

      <div>
        {loading && reels.length === 0 ? (
          <ReelsGridShimmer />
        ) : reels.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
            <Home className="mb-3 h-12 w-12 text-content-tertiary" />
            <p className="text-sm text-content-secondary">
              {feed === 'following' ? 'No reels from people you follow yet.' : 'No reels here yet.'}
            </p>
          </div>
        ) : (
          <div className={`px-2.5 pt-2 sm:px-4 lg:px-5 ${gridClass}`}>
            {reels.map((reel, i) => (
              <div key={reel.id} className="mb-2.5 break-inside-avoid sm:mb-3 rounded-lg overflow-hidden">
                <ReelCard reel={reel} index={i} href={feedHrefFor(reel.id)} />
              </div>
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

        {loading && reels.length > 0 && <ReelsGridLoadMoreShimmer />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[46] border-t border-border bg-surface/90 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 lg:hidden">
        <div className="mx-auto max-w-lg">
          <ReelsNav variant="video-bottom" />
        </div>
      </div>
    </div>
  )
}

function Fallback() {
  return (
    <div className="relative mx-auto w-full max-w-[1600px] min-h-[calc(100dvh-4.5rem)] bg-surface pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-content lg:pb-10">
      <ReelsGridShimmer />
    </div>
  )
}

export function ReelsListGrid(props: Props) {
  return (
    <Suspense fallback={<Fallback />}>
      <ListBody {...props} />
    </Suspense>
  )
}
