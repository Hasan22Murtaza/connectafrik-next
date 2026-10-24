'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Home, Plus } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useReels } from '@/shared/hooks/useReels'
import { REEL_CATEGORIES, ReelCategory, ReelFeedType } from '@/shared/types/reels'
import { ReelCard } from '@/features/social/components/ReelCard'
import { ReelsNav } from '@/features/social/components/ReelsNav'
import { ReelsBrowseHeader } from '@/features/social/components/ReelsBrowseHeader'

type Props = {
  feed: Extract<ReelFeedType, 'foryou' | 'following' | 'explore'>
}

function feedListPath(feed: Props['feed']) {
  if (feed === 'following') return '/reels/following'
  if (feed === 'explore') return '/reels/explore'
  return '/reels/foryou'
}

function feedWatchPath(feed: Props['feed']) {
  return `${feedListPath(feed)}/feed`
}

function ListBody({ feed }: Props) {
  const router = useRouter()
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

  const setCategory = useCallback(
    (cat: ReelCategory | null) => {
      const p = new URLSearchParams()
      if (cat) p.set('category', cat)
      router.push(`/reels/explore${p.toString() ? `?${p.toString()}` : ''}`, { scroll: false })
    },
    [router]
  )

  const feedHrefFor = useCallback(
    (reelId: string) => {
      const p = new URLSearchParams()
      if (exploreCategory) p.set('category', exploreCategory)
      p.set('start', reelId)
      return `${feedWatchPath(feed)}?${p.toString()}`
    },
    [feed, exploreCategory]
  )

  const gridClass =
    'columns-2 gap-2.5 sm:columns-3 sm:gap-3 lg:columns-4 xl:columns-5 [column-fill:_balance]'

  const exploreCategories =
    feed === 'explore' ? (
      <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            !exploreCategory
              ? 'bg-[var(--african-orange)] text-white'
              : 'bg-surface-secondary text-content-secondary ring-1 ring-border hover:bg-surface-hover'
          }`}
        >
          All
        </button>
        {REEL_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              exploreCategory === c.value
                ? 'bg-[var(--african-orange)] text-white'
                : 'bg-surface-secondary text-content-secondary ring-1 ring-border hover:bg-surface-hover'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    ) : null

  if (!enabled) {
    return (
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col bg-white text-content">
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
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col bg-white text-content">
        <ReelsBrowseHeader feed={feed} exploreCategories={exploreCategories} />
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
    <div className="relative mx-auto w-full max-w-[1600px] min-h-[calc(100dvh-4.5rem)] bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-content lg:pb-10">
      <ReelsBrowseHeader feed={feed} exploreCategories={exploreCategories} />

      <div>
        {loading && reels.length === 0 ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--african-orange)]" />
          </div>
        ) : reels.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
            <Home className="mb-3 h-12 w-12 text-content-tertiary" />
            <p className="text-sm text-content-secondary">
              {feed === 'following' ? 'No reels from people you follow yet.' : 'No reels here yet.'}
            </p>
            <Link
              href="/reels/create"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--african-orange)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Create reel
            </Link>
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

        {loading && reels.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-[var(--african-orange)]" />
          </div>
        )}
      </div>

<Link
  href="/reels/create"
  aria-label="Create reel"
  className="fixed left-[56vw] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[47] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--african-orange)] text-white shadow-lg ring-2 ring-black/5 lg:bottom-8"
>
  <Plus
    className="h-7 w-7 shrink-0"
    strokeWidth={2.5}
  />
</Link>



      <div className="fixed bottom-0 left-0 right-0 z-[46] border-t border-border bg-white/90 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 lg:hidden">
        <div className="mx-auto max-w-lg">
          <ReelsNav variant="video-bottom" />
        </div>
      </div>
    </div>
  )
}

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--african-orange)]" />
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
