'use client'

import Link from 'next/link'
import { Plus } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useReelStats } from '@/shared/hooks/useReels'
import { ReelsNav } from '@/features/social/components/ReelsNav'
import { ReelsMainTabs } from '@/features/social/components/ReelsBrowseHeader'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

export function ReelsAnalyticsPanel() {
  const { user } = useAuth()
  const { stats, loading, error, refresh } = useReelStats(Boolean(user?.id))

  const cards = [
    { label: 'Reels', value: stats?.total_reels ?? 0 },
    { label: 'Views', value: stats?.total_views ?? 0 },
    { label: 'Likes', value: stats?.total_likes ?? 0 },
    { label: 'Comments', value: stats?.total_comments ?? 0 },
    { label: 'Shares', value: stats?.total_shares ?? 0 },
    { label: 'Avg engagement', value: stats?.avg_engagement ?? 0, raw: true },
  ]

  return (
    <div className="relative w-full min-h-[calc(100dvh-4.5rem)] bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-content lg:pb-10">
      <header className="sticky top-[4.5rem] z-20 w-full bg-white/95 backdrop-blur-md lg:top-0">
        <div className="mx-auto w-full max-w-[1600px]">
          <ReelsMainTabs />
          <div className="border-b border-border px-3 py-2.5 sm:px-4 lg:px-5">
            <h1 className="text-[15px] font-semibold text-content">Analytics</h1>
            <p className="mt-0.5 text-xs text-content-tertiary">Performance across your reels</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-4 lg:px-5">
        {!user?.id ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
            <p className="text-sm text-content-secondary">Sign in to view analytics.</p>
            <Link href="/signin" className="btn-primary mt-5 inline-flex rounded-full px-8 py-2.5 text-sm font-semibold">
              Log in
            </Link>
          </div>
        ) : error ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
            <p className="text-sm text-content-secondary">{error}</p>
            <button type="button" onClick={refresh} className="btn-primary mt-4 inline-flex rounded-full text-sm">
              Try again
            </button>
          </div>
        ) : loading && !stats ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--african-orange)]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl bg-surface-secondary px-4 py-4 ring-1 ring-border"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-content-tertiary">{c.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-content">
                  {c.raw ? Number(c.value).toFixed(1) : formatCount(Number(c.value))}
                </p>
              </div>
            ))}
          </div>
        )}

        {user?.id && (
          <div className="mt-6">
            <Link
              href="/reels/my-videos"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--african-orange)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              View my videos
            </Link>
          </div>
        )}
      </div>

      <Link
        href="/reels/create"
        aria-label="Create reel"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-[47] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--african-orange)] text-white shadow-lg ring-2 ring-black/5 lg:bottom-8"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </Link>

      <div className="fixed bottom-0 left-0 right-0 z-[46] border-t border-border bg-white/90 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 lg:hidden">
        <div className="mx-auto max-w-lg">
          <ReelsNav variant="video-bottom" />
        </div>
      </div>
    </div>
  )
}
