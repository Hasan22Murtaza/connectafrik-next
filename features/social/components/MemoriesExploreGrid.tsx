'use client'

import { Suspense, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useReels } from '@/shared/hooks/useReels'
import { REEL_CATEGORIES, ReelCategory } from '@/shared/types/reels'
import { MemoriesNav } from '@/features/social/components/MemoriesNav'
import { ReelCard } from '@/features/social/components/ReelCard'

function ExploreGridBody() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  const exploreCategory =
    categoryParam && REEL_CATEGORIES.some((c) => c.value === categoryParam)
      ? (categoryParam as ReelCategory)
      : undefined

  const reelFilters = useMemo(() => {
    const f: { feed: 'explore'; category?: ReelCategory } = { feed: 'explore' }
    if (exploreCategory) f.category = exploreCategory
    return f
  }, [exploreCategory])

  const sortOptions = useMemo(() => ({ field: 'created_at' as const, order: 'desc' as const }), [])
  const { reels, loading, error, hasMore, loadMore, refresh } = useReels(reelFilters, sortOptions)

  const setCategory = useCallback(
    (cat: ReelCategory | null) => {
      const p = new URLSearchParams()
      if (cat) p.set('category', cat)
      router.push(`/memories/explore${p.toString() ? `?${p.toString()}` : ''}`, { scroll: false })
    },
    [router]
  )

  const feedHrefFor = useCallback(
    (reelId: string) => {
      const p = new URLSearchParams()
      if (exploreCategory) p.set('category', exploreCategory)
      p.set('start', reelId)
      return `/memories/explore/feed?${p.toString()}`
    },
    [exploreCategory]
  )

  if (error) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-6 text-center lg:min-h-[calc(100dvh-4.5rem)]">
        <p className="text-sm text-gray-600">{error}</p>
        <button type="button" onClick={refresh} className="btn-primary mt-4 inline-flex rounded-full text-sm">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh-4.5rem)] bg-neutral-50 pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-6">
      <div className="sticky top-[4.5rem] z-20 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur-sm lg:top-0">
        <div className="flex gap-2 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              !exploreCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {REEL_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                exploreCategory === c.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading && reels.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-8.5rem)] items-center justify-center lg:min-h-[calc(100dvh-10rem)]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
        </div>
      ) : reels.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col items-center justify-center px-6 text-center lg:min-h-[calc(100dvh-10rem)]">
          <p className="text-sm text-gray-600">No memories in this category yet.</p>
          <Link href="/memories/create" className="btn-primary mt-4 inline-flex items-center gap-2 rounded-full text-sm">
            <Plus className="h-4 w-4" />
            Create memory
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-3">
          {reels.map((reel) => (
            <ReelCard key={reel.id} reel={reel} href={feedHrefFor(reel.id)} />
          ))}
        </div>
      )}

      {hasMore && reels.length > 0 && (
        <div className="flex justify-center py-6">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" />
          ) : (
            <button type="button" onClick={() => loadMore()} className="text-sm font-medium text-primary-600 hover:underline">
              Load more
            </button>
          )}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-[46] border-t border-white/10 bg-black/90 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 text-white lg:hidden">
        <div className="mx-auto max-w-lg">
          <MemoriesNav variant="video-bottom" />
        </div>
      </div>
    </div>
  )
}

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
    </div>
  )
}

export function MemoriesExploreGrid() {
  return (
    <Suspense fallback={<Fallback />}>
      <ExploreGridBody />
    </Suspense>
  )
}
