'use client'

import Link from 'next/link'
import {
  Plus,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Film,
  TrendingUp,
  Bookmark,
  ChevronRight,
  Play,
} from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useReelStats } from '@/shared/hooks/useReels'
import type { ReelAnalyticsTopReel } from '@/shared/types/reels'
import { ReelsNav } from '@/features/social/components/ReelsNav'
import { ReelsMainTabs } from '@/features/social/components/ReelsBrowseHeader'
import { reelsFeedHref } from '@/lib/reels/feedHref'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

const KPI_META = [
  { key: 'total_reels' as const, label: 'Reels', icon: Film, accent: 'text-[var(--african-orange)]' },
  { key: 'total_views' as const, label: 'Views', icon: Eye, accent: 'text-sky-600' },
  { key: 'total_likes' as const, label: 'Likes', icon: Heart, accent: 'text-rose-600' },
  { key: 'total_comments' as const, label: 'Comments', icon: MessageSquare, accent: 'text-emerald-600' },
  { key: 'total_shares' as const, label: 'Shares', icon: Share2, accent: 'text-amber-600' },
  { key: 'avg_engagement' as const, label: 'Avg score', icon: TrendingUp, accent: 'text-[var(--african-orange)]', raw: true },
]

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl bg-surface-secondary px-4 py-4 ring-1 ring-border"
        >
          <div className="h-3 w-16 rounded bg-border/70" />
          <div className="mt-3 h-7 w-12 rounded bg-border/70" />
        </div>
      ))}
    </div>
  )
}

function EngagementBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-content-secondary">{label}</span>
        <span className="tabular-nums text-content-tertiary">
          {formatCount(value)} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-secondary ring-1 ring-border/60">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${color}`}
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  )
}

function TopReelRow({ reel, rank }: { reel: ReelAnalyticsTopReel; rank: number }) {
  return (
    <Link
      href={reelsFeedHref({ start: reel.id, feed: 'mine' })}
      className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-secondary"
    >
      <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-content-tertiary">
        {rank}
      </span>
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-secondary ring-1 ring-border">
        {reel.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reel.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-4 w-4 text-content-tertiary" />
          </div>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-px text-center text-[9px] font-medium text-white">
          {formatDuration(reel.duration)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content group-hover:text-[var(--african-orange)]">
          {reel.title || 'Untitled reel'}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-content-tertiary">
          <span className="inline-flex items-center gap-0.5">
            <Eye className="h-3 w-3" /> {formatCount(reel.views_count ?? 0)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Heart className="h-3 w-3" /> {formatCount(reel.likes_count ?? 0)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" /> {formatCount(reel.comments_count ?? 0)}
          </span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-content-tertiary opacity-0 transition group-hover:opacity-100" />
    </Link>
  )
}

export function ReelsAnalyticsPanel() {
  const { user } = useAuth()
  const { stats, loading, error, refresh } = useReelStats(Boolean(user?.id))

  const mix = stats?.engagement_mix
  const mixTotal =
    (mix?.likes ?? 0) + (mix?.comments ?? 0) + (mix?.shares ?? 0) + (mix?.saves ?? 0)
  const topReels = stats?.top_reels ?? []
  const categories = Object.entries(stats?.by_category ?? {}).sort((a, b) => b[1] - a[1])
  const hasReels = (stats?.total_reels ?? 0) > 0

  return (
    <div className="relative w-full min-h-[calc(100dvh-4.5rem)] bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-content lg:pb-10">
      <header className="sticky top-[4.5rem] z-20 w-full bg-white/95 backdrop-blur-md lg:top-0">
        <div className="mx-auto w-full max-w-[1600px]">
          <ReelsMainTabs />
          <div className="flex items-end justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4 lg:px-5">
            <div>
              <h1 className="text-[15px] font-semibold text-content">Analytics</h1>
              <p className="mt-0.5 text-xs text-content-tertiary">Performance across your reels</p>
            </div>
            {user?.id && (
              <Link
                href="/reels/my-videos"
                className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-[var(--african-orange)] sm:inline-flex"
              >
                My videos <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-4 lg:px-5">
        {!user?.id ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--african-orange)_12%,transparent)]">
              <TrendingUp className="h-7 w-7 text-[var(--african-orange)]" />
            </div>
            <p className="text-sm font-medium text-content">See how your reels perform</p>
            <p className="mt-1 max-w-sm text-sm text-content-secondary">
              Sign in to view views, likes, and top-performing videos.
            </p>
            <Link
              href="/signin"
              className="btn-primary mt-5 inline-flex rounded-full px-8 py-2.5 text-sm font-semibold"
            >
              Log in
            </Link>
          </div>
        ) : error ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
            <p className="text-sm text-content-secondary">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="btn-primary mt-4 inline-flex rounded-full text-sm"
            >
              Try again
            </button>
          </div>
        ) : loading && !stats ? (
          <div className="space-y-6">
            <div className="h-24 animate-pulse rounded-2xl bg-surface-secondary ring-1 ring-border" />
            <KpiSkeleton />
          </div>
        ) : !hasReels ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center px-4 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--african-orange)_12%,transparent)]">
              <Film className="h-7 w-7 text-[var(--african-orange)]" />
            </div>
            <h2 className="text-base font-semibold text-content">No reels yet</h2>
            <p className="mt-1.5 max-w-sm text-sm text-content-secondary">
              Publish your first reel to unlock views, engagement, and rankings here.
            </p>
            <Link
              href="/reels/create"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--african-orange)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Create reel
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[color-mix(in_srgb,var(--african-orange)_14%,white)] via-white to-surface-secondary px-4 py-5 ring-1 ring-border sm:px-5">
              <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[color-mix(in_srgb,var(--african-orange)_18%,transparent)] blur-2xl" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--african-orange)]">
                    Overview
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-content sm:text-3xl">
                    {formatCount(stats?.total_views ?? 0)}{' '}
                    <span className="text-base font-medium text-content-secondary sm:text-lg">
                      total views
                    </span>
                  </p>
                  <p className="mt-1.5 max-w-md text-sm text-content-secondary">
                    Across {formatCount(stats?.total_reels ?? 0)} reel
                    {(stats?.total_reels ?? 0) === 1 ? '' : 's'} ·{' '}
                    {stats?.engagement_rate ?? 0}% engagement rate
                    {mixTotal > 0 ? ` · ${formatCount(mixTotal)} interactions` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/reels/my-videos"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--african-orange)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    View my videos
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/reels/create"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-content ring-1 ring-border hover:bg-surface-secondary"
                  >
                    <Plus className="h-4 w-4" />
                    New reel
                  </Link>
                </div>
              </div>
            </section>

            {/* KPIs */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {KPI_META.map((meta) => {
                const Icon = meta.icon
                const raw = stats?.[meta.key] ?? 0
                return (
                  <div
                    key={meta.key}
                    className="rounded-2xl bg-surface-secondary px-3.5 py-3.5 ring-1 ring-border sm:px-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-content-tertiary">
                        {meta.label}
                      </p>
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.accent}`} />
                    </div>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-content">
                      {'raw' in meta && meta.raw
                        ? Number(raw).toFixed(1)
                        : formatCount(Number(raw))}
                    </p>
                  </div>
                )
              })}
            </section>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* Engagement mix */}
              <section className="rounded-2xl bg-surface-secondary/60 p-4 ring-1 ring-border lg:col-span-2 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-content">Engagement mix</h2>
                    <p className="mt-0.5 text-xs text-content-tertiary">
                      How people interact with your reels
                    </p>
                  </div>
                  <Bookmark className="h-4 w-4 text-content-tertiary" />
                </div>
                {mixTotal === 0 ? (
                  <p className="py-8 text-center text-sm text-content-secondary">
                    No likes, comments, or shares yet. Keep posting!
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    <EngagementBar
                      label="Likes"
                      value={mix?.likes ?? 0}
                      total={mixTotal}
                      color="bg-rose-500"
                    />
                    <EngagementBar
                      label="Comments"
                      value={mix?.comments ?? 0}
                      total={mixTotal}
                      color="bg-emerald-500"
                    />
                    <EngagementBar
                      label="Shares"
                      value={mix?.shares ?? 0}
                      total={mixTotal}
                      color="bg-amber-500"
                    />
                    <EngagementBar
                      label="Saves"
                      value={mix?.saves ?? 0}
                      total={mixTotal}
                      color="bg-sky-500"
                    />
                  </div>
                )}

                {categories.length > 0 && (
                  <div className="mt-6 border-t border-border pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                      By category
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {categories.slice(0, 6).map(([name, count]) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-content ring-1 ring-border"
                        >
                          <span className="capitalize">{name}</span>
                          <span className="tabular-nums text-content-tertiary">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Top reels */}
              <section className="rounded-2xl bg-surface-secondary/60 p-4 ring-1 ring-border lg:col-span-3 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-content">Top reels</h2>
                    <p className="mt-0.5 text-xs text-content-tertiary">Ranked by views</p>
                  </div>
                  <Link
                    href="/reels/my-videos"
                    className="text-xs font-semibold text-[var(--african-orange)]"
                  >
                    See all
                  </Link>
                </div>
                {topReels.length === 0 ? (
                  <p className="py-10 text-center text-sm text-content-secondary">
                    Your top videos will show up here.
                  </p>
                ) : (
                  <div className="-mx-1 divide-y divide-border/70">
                    {topReels.map((reel, i) => (
                      <TopReelRow key={reel.id} reel={reel} rank={i + 1} />
                    ))}
                  </div>
                )}
              </section>
            </div>
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
