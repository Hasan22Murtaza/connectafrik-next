'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Home, SquarePlus, Video, Users } from 'lucide-react'

export type MemoriesTabId = 'foryou' | 'explore' | 'following' | 'mine'

const HREF: Record<MemoriesTabId, string> = {
  foryou: '/memories/foryou',
  explore: '/memories/explore',
  following: '/memories/following',
  mine: '/memories/my-videos',
}

const items: { id: MemoriesTabId; label: string; icon: ReactNode }[] = [
  { id: 'foryou', label: 'For You', icon: <Home className="h-5 w-5 shrink-0" strokeWidth={1.75} /> },
  { id: 'explore', label: 'Explore', icon: <Compass className="h-5 w-5 shrink-0" strokeWidth={1.75} /> },
  { id: 'following', label: 'Following', icon: <Users className="h-5 w-5 shrink-0" strokeWidth={1.75} /> },
  { id: 'mine', label: 'My videos', icon: <Video className="h-5 w-5 shrink-0" strokeWidth={1.75} /> },
]

const itemBase =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100'
const itemActive = 'bg-primary-50 text-primary-700'

function isExplorePath(pathname: string) {
  return pathname === '/memories/explore' || pathname.startsWith('/memories/explore/')
}

function resolveActive(pathname: string): MemoriesTabId {
  if (pathname.startsWith('/memories/foryou')) return 'foryou'
  if (isExplorePath(pathname)) return 'explore'
  if (pathname.startsWith('/memories/following')) return 'following'
  if (pathname.startsWith('/memories/my-videos')) return 'mine'
  return 'foryou'
}

type Props = {
  variant: 'sidebar' | 'mobile' | 'video-top' | 'video-bottom'
}

export function MemoriesNav({ variant }: Props) {
  const pathname = usePathname() || ''
  const active = resolveActive(pathname)

  if (variant === 'video-top') {
    return (
      <div className="flex w-full items-center justify-between gap-1">
        {items.map(({ id, label }) => (
          <Link
            key={id}
            href={HREF[id]}
            scroll={false}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-full px-2 py-1.5 text-xs font-semibold transition-colors active:opacity-90 ${
              active === id ? 'bg-primary-50 text-primary-600' : 'text-gray-500'
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
      <div className="grid w-full grid-cols-5 items-center gap-1 text-[11px]">
        <Link
          href={HREF.foryou}
          scroll={false}
          className={`flex flex-col items-center gap-0.5 py-1 ${active === 'foryou' ? 'text-[#FF6900]' : 'text-white/90'}`}
        >
          <Home className="h-4 w-4" strokeWidth={2} />
          <span>For You</span>
        </Link>
        <Link
          href={HREF.explore}
          scroll={false}
          className={`flex flex-col items-center gap-0.5 py-1 ${active === 'explore' ? 'text-[#FF6900]' : 'text-white/90'}`}
        >
          <Compass className="h-4 w-4" strokeWidth={2} />
          <span>Explore</span>
        </Link>

        <Link href="/memories/create" className="flex items-center justify-center py-1" aria-label="Create memory">
          <span className="inline-flex h-8 w-11 items-center justify-center rounded-xl bg-[var(--african-orange)] text-white shadow-sm">
            <SquarePlus className="h-5 w-5" strokeWidth={2.5} />
          </span>
        </Link>

        <Link
          href={HREF.following}
          scroll={false}
          className={`flex flex-col items-center gap-0.5 py-1 ${active === 'following' ? 'text-[#FF6900]' : 'text-white/90'}`}
        >
          <Users className="h-4 w-4" strokeWidth={2} />
          <span>Following</span>
        </Link>
        <Link
          href={HREF.mine}
          scroll={false}
          className={`flex flex-col items-center gap-0.5 py-1 ${active === 'mine' ? 'text-[#FF6900]' : 'text-white/90'}`}
        >
          <Video className="h-4 w-4" strokeWidth={2} />
          <span>My videos</span>
        </Link>
      </div>
    )
  }

  if (variant === 'mobile') {
    return (
      <div className="flex w-full items-stretch justify-between gap-0.5">
        {items.map(({ id, label, icon }) => (
          <Link
            key={id}
            href={HREF[id]}
            scroll={false}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-semibold sm:text-xs ${
              active === id ? 'text-primary-600' : 'text-gray-400'
            }`}
          >
            <span className={active === id ? 'text-primary-600' : 'text-gray-500'}>{icon}</span>
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
          <span className={active === id ? 'text-primary-600' : 'text-gray-500'}>{icon}</span>
          {label}
        </Link>
      ))}
      <Link
        href="/memories/create"
        className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
      >
        <SquarePlus className="h-5 w-5 shrink-0 text-gray-500" strokeWidth={1.75} />
        Upload
      </Link>
    </nav>
  )
}
