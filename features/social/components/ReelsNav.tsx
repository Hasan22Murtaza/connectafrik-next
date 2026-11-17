'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Compass, Home, Plus, Video, Users } from '@/shared/icons'

export type ReelsTabId = 'foryou' | 'explore' | 'following' | 'mine'

const HREF: Record<ReelsTabId, string> = {
  foryou: '/reels/foryou',
  explore: '/reels/explore',
  following: '/reels/following',
  mine: '/reels/my-videos',
}

const items: { id: ReelsTabId; label: string; icon: ReactNode }[] = [
  { id: 'foryou', label: 'For You', icon: <Home className="h-5 w-5 shrink-0" strokeWidth={1.75} /> },
  { id: 'explore', label: 'Explore', icon: <Compass className="h-5 w-5 shrink-0" strokeWidth={1.75} /> },
  { id: 'following', label: 'Following', icon: <Users className="h-5 w-5 shrink-0" strokeWidth={1.75} /> },
  { id: 'mine', label: 'My videos', icon: <Video className="h-5 w-5 shrink-0" strokeWidth={1.75} /> },
]

const itemBase =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-content transition-colors hover:bg-surface-hover'
const itemActive = 'bg-surface-secondary text-content'

function isExplorePath(pathname: string) {
  return pathname === '/reels/explore' || pathname.startsWith('/reels/explore/')
}

function resolveActive(pathname: string, feedParam: string | null): ReelsTabId {
  if (pathname.startsWith('/reels/foryou')) return 'foryou'
  if (isExplorePath(pathname)) return 'explore'
  if (pathname.startsWith('/reels/following')) return 'following'
  if (pathname.startsWith('/reels/my-videos')) return 'mine'
  if (pathname === '/reels/feed' || pathname.endsWith('/feed')) {
    if (feedParam === 'explore') return 'explore'
    if (feedParam === 'following') return 'following'
    if (feedParam === 'mine') return 'mine'
    return 'foryou'
  }
  return 'foryou'
}

type Props = {
  variant: 'sidebar' | 'mobile' | 'video-top' | 'video-bottom'
}

export function ReelsNav({ variant }: Props) {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const active = resolveActive(pathname, searchParams.get('feed'))

  if (variant === 'video-top') {
    return (
      <div className="flex w-full items-center justify-between gap-1">
        {items.map(({ id, label }) => (
          <Link
            key={id}
            href={HREF[id]}
            scroll={false}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-full px-2 py-1.5 text-xs font-semibold transition-colors active:opacity-90 ${
              active === id ? 'bg-surface-secondary text-content' : 'text-content-secondary'
            }`}
          >
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
      </div>
    )
  }

  if (variant === 'video-bottom') {
    return (
      <div className="grid w-full grid-cols-5 items-end gap-0.5 text-[11px]">
        <Link
          href={HREF.foryou}
          scroll={false}
          className={`flex flex-col items-center gap-0.5 py-1 ${active === 'foryou' ? 'text-content' : 'text-content-secondary'}`}
        >
          <Home className="h-4 w-4" strokeWidth={2} />
          <span>For You</span>
        </Link>
        <Link
          href={HREF.explore}
          scroll={false}
          className={`flex flex-col items-center gap-0.5 py-1 ${active === 'explore' ? 'text-content' : 'text-content-secondary'}`}
        >
          <Compass className="h-4 w-4" strokeWidth={2} />
          <span>Explore</span>
        </Link>
        <Link
          href="/reels/create"
          scroll={false}
          aria-label="Create reel"
          className="flex flex-col items-center justify-center pb-0.5"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--african-orange)] text-white shadow-md shadow-[color-mix(in_srgb,var(--african-orange)_35%,transparent)] ring-2 ring-surface">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </span>
        </Link>
        <Link
          href={HREF.following}
          scroll={false}
          className={`flex flex-col items-center gap-0.5 py-1 ${active === 'following' ? 'text-content' : 'text-content-secondary'}`}
        >
          <Users className="h-4 w-4" strokeWidth={2} />
          <span>Following</span>
        </Link>
        <Link
          href={HREF.mine}
          scroll={false}
          className={`flex flex-col items-center gap-0.5 py-1 ${active === 'mine' ? 'text-content' : 'text-content-secondary'}`}
        >
          <Video className="h-4 w-4" strokeWidth={2} />
          <span>My videos</span>
        </Link>
      </div>
    )
  }

  if (variant === 'mobile') {
    return (
      <div className="flex w-full items-end justify-between gap-0.5">
        {items.slice(0, 2).map(({ id, label, icon }) => (
          <Link
            key={id}
            href={HREF[id]}
            scroll={false}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-semibold sm:text-xs ${
              active === id ? 'text-content' : 'text-content-tertiary'
            }`}
          >
            <span className={active === id ? 'text-content' : 'text-content-secondary'}>{icon}</span>
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
        <Link
          href="/reels/create"
          scroll={false}
          aria-label="Create reel"
          className="flex min-w-0 flex-1 flex-col items-center justify-center pb-0.5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--african-orange)] text-white shadow-md">
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </span>
        </Link>
        {items.slice(2).map(({ id, label, icon }) => (
          <Link
            key={id}
            href={HREF[id]}
            scroll={false}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-semibold sm:text-xs ${
              active === id ? 'text-content' : 'text-content-tertiary'
            }`}
          >
            <span className={active === id ? 'text-content' : 'text-content-secondary'}>{icon}</span>
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <nav className="flex w-full flex-col gap-0.5 px-2 py-2">
      {items.map(({ id, label, icon }) => (
        <Link
          key={id}
          href={HREF[id]}
          scroll={false}
          className={`${itemBase} ${active === id ? itemActive : ''}`}
        >
          <span className={active === id ? 'text-content' : 'text-content-secondary'}>{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  )
}
