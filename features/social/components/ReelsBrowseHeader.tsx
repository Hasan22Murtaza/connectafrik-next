'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bookmark,
  ChevronDown,
  Compass,
  Heart,
  Users,
} from '@/shared/icons'

function isFeedPath(pathname: string) {
  return (
    pathname.startsWith('/reels/foryou') ||
    pathname.startsWith('/reels/following') ||
    pathname.startsWith('/reels/explore') ||
    pathname === '/reels'
  )
}

function ForYouTab({
  active,
  feed,
}: {
  active: boolean
  feed?: 'foryou' | 'following' | 'explore'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const label = feed === 'following' ? 'Following' : 'For you'
  const Icon = feed === 'following' ? Users : Compass

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const tabClass = `relative inline-flex items-center gap-1.5 pb-2.5 pt-2 text-[13px] font-medium transition sm:text-sm ${
    active ? 'text-content' : 'text-content-tertiary hover:text-content'
  }`

  return (
    <div ref={rootRef} className="relative flex flex-1 justify-center">
      {active ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={tabClass}
          aria-expanded={open}
          aria-current="page"
        >
          <Icon className="h-4 w-4 text-[var(--african-orange)]" strokeWidth={1.75} />
          <span>{label}</span>
          <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition ${open ? 'rotate-180' : ''}`} />
          <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[var(--african-orange)]" />
        </button>
      ) : (
        <Link href="/reels/foryou" scroll={false} className={tabClass}>
          <Compass className="h-4 w-4" strokeWidth={1.75} />
          <span>For you</span>
        </Link>
      )}

      {open && active && (
        <div className="absolute left-1/2 top-full z-40 mt-1 min-w-[11.5rem] -translate-x-1/2 overflow-hidden rounded-xl bg-surface shadow-xl ring-1 ring-border sm:left-0 sm:translate-x-0">
          <Link
            href="/reels/foryou"
            scroll={false}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium ${
              feed === 'foryou' || feed === 'explore' || !feed
                ? 'bg-surface-secondary text-content'
                : 'text-content-secondary hover:bg-surface-hover'
            }`}
          >
            <Compass className="h-4 w-4 text-[var(--african-orange)]" strokeWidth={2} />
            For you
          </Link>
          <Link
            href="/reels/following"
            scroll={false}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium ${
              feed === 'following'
                ? 'bg-surface-secondary text-content'
                : 'text-content-secondary hover:bg-surface-hover'
            }`}
          >
            <Users className="h-4 w-4" strokeWidth={2} />
            Following
          </Link>
        </div>
      )}
    </div>
  )
}

type TabLinkProps = {
  href: string
  label: string
  icon: typeof Bookmark
  active: boolean
}

function TabLink({ href, label, icon: Icon, active }: TabLinkProps) {
  return (
    <Link
      href={href}
      className={`relative flex flex-1 items-center justify-center gap-1.5 pb-2.5 pt-2 text-[13px] font-medium transition sm:text-sm ${
        active ? 'text-content' : 'text-content-tertiary hover:text-content'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        className={`h-4 w-4 ${active ? 'text-[var(--african-orange)]' : 'text-current'}`}
        strokeWidth={1.75}
      />
      <span>{label}</span>
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-[var(--african-orange)] sm:inset-x-4" />
      )}
    </Link>
  )
}

export function ReelsMainTabs({
  feed,
}: {
  feed?: 'foryou' | 'following' | 'explore'
}) {
  const pathname = usePathname() || ''
  const feedActive = isFeedPath(pathname)
  const savedActive = pathname.startsWith('/reels/saved')
  const likedActive = pathname.startsWith('/reels/liked')
  const analyticsActive = pathname.startsWith('/reels/analytics')

  return (
    <nav
      aria-label="Reels sections"
      className="flex w-full items-stretch border-b border-border px-1 sm:px-2"
    >
      <ForYouTab active={feedActive} feed={feed} />
      <TabLink href="/reels/saved" label="Saved" icon={Bookmark} active={savedActive} />
      <TabLink href="/reels/liked" label="Liked" icon={Heart} active={likedActive} />
      <TabLink href="/reels/analytics" label="Analytics" icon={BarChart3} active={analyticsActive} />
    </nav>
  )
}

type BrowseHeaderProps = {
  feed: 'foryou' | 'following' | 'explore'
  exploreCategories?: ReactNode
}

export function ReelsBrowseHeader({ feed, exploreCategories }: BrowseHeaderProps) {
  return (
    <header className="sticky top-[4.5rem] z-20 w-full bg-white/95 backdrop-blur-md lg:top-0">
      <div className="mx-auto w-full max-w-[1600px]">
        <ReelsMainTabs feed={feed} />
        {exploreCategories ? (
          <div className="border-b border-border px-3 py-2 sm:px-4 lg:px-5">{exploreCategories}</div>
        ) : null}
      </div>
    </header>
  )
}
