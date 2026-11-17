'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { Reel } from '@/shared/types/reels'
import { ReelCard } from '@/features/social/components/ReelCard'
import { ReelsNav } from '@/features/social/components/ReelsNav'
import { reelsFeedHref } from '@/lib/reels/feedHref'
import { ReelsGridShimmer } from '@/shared/components/ui/ShimmerLoaders'

type Mode = 'saved' | 'liked' | 'reposted'

type Props = {
  mode: Mode
}

type ListPayload = {
  data: Reel[]
  hasMore?: boolean
  page?: number
}

const MODE_CONFIG: Record<Mode, { endpoint: string; emptyCopy: string }> = {
  saved: { endpoint: '/api/reels/saved', emptyCopy: 'No saved reels yet.' },
  liked: { endpoint: '/api/reels/liked', emptyCopy: 'No liked reels yet.' },
  reposted: { endpoint: '/api/reels/reposted', emptyCopy: 'No reposted reels yet.' },
}

export function ReelsLibraryGrid({ mode }: Props) {
  const { user } = useAuth()
  const [reels, setReels] = useState<Reel[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const fetchingRef = useRef(false)

  const { endpoint, emptyCopy } = MODE_CONFIG[mode]

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!user?.id || fetchingRef.current) return
      fetchingRef.current = true
      try {
        if (replace) setLoading(true)
        setError(null)
        const res = await apiClient.get<ListPayload>(endpoint, { page: nextPage, limit: 20 })
        const chunk = res.data || []
        setReels((prev) => (replace ? chunk : [...prev, ...chunk]))
        setHasMore(Boolean(res.hasMore))
        setPage(nextPage)
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to load ${mode} reels`)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    },
    [endpoint, mode, user?.id]
  )

  useEffect(() => {
    setReels([])
    setPage(0)
    setHasMore(true)
    if (!user?.id) {
      setLoading(false)
      return
    }
    void loadPage(0, true)
  }, [user?.id, loadPage])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading || !user?.id) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadPage(page + 1, false)
      },
      { rootMargin: '480px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, loadPage, page, user?.id])

  const gridClass =
    'columns-3 gap-2 sm:columns-4 sm:gap-2.5 lg:columns-5 xl:columns-6 2xl:columns-7 [column-fill:_balance]'

  const feedHref = (id: string) => reelsFeedHref({ start: id, feed: mode })

  return (
    <div className="relative mx-auto w-full max-w-[1600px]  min-h-[calc(100dvh-4.5rem)] bg-surface pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-content lg:pb-10">
      <div className="">
        {!user?.id ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-content-secondary">Sign in to see your {mode} reels.</p>
            <Link href="/signin" className="btn-primary mt-5 inline-flex rounded-full px-8 py-2.5 text-sm font-semibold">
              Log in
            </Link>
          </div>
        ) : error ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-content-secondary">{error}</p>
            <button
              type="button"
              onClick={() => void loadPage(0, true)}
              className="btn-primary mt-4 inline-flex rounded-full text-sm"
            >
              Try again
            </button>
          </div>
        ) : loading && reels.length === 0 ? (
          <ReelsGridShimmer />
        ) : reels.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-content-secondary">{emptyCopy}</p>
            <Link
              href="/reels/foryou"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--african-orange)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Browse reels
            </Link>
          </div>
        ) : (
          <div className={`px-2.5 pt-2 sm:px-4 lg:px-5 ${gridClass}`}>
            {reels.map((reel, i) => (
              <div key={reel.id} className="mb-2.5 break-inside-avoid sm:mb-3 rounded-lg overflow-hidden ">
                <ReelCard reel={reel} index={i} href={feedHref(reel.id)} />
              </div>
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[46] border-t border-border bg-surface/90 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 lg:hidden">        <div className="mx-auto max-w-lg">
          <ReelsNav variant="video-bottom" />
        </div>
      </div>
    </div>
  )
}
