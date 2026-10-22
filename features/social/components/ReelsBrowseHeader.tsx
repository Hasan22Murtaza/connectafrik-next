'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bookmark,
  Compass,
  Heart,
  Users,
} from '@/shared/icons'

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
      className={`relative flex items-center justify-center gap-1.5 pb-2.5 pt-2 px-3.5 text-[13px] font-medium transition sm:text-sm ${
        active ? 'text-orange-500' : 'text-content-tertiary hover:text-content'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        className={`h-4 w-4 ${active ? 'text-orange-500' : 'text-current'}`}
        strokeWidth={1.75}
      />
      <span>{label}</span>
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-[3px] bg-orange-500 sm:inset-x-4" />
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
  const forYouActive =
    feed === 'foryou' ||
    feed === 'explore' ||
    pathname === '/reels' ||
    pathname.startsWith('/reels/foryou') ||
    pathname.startsWith('/reels/explore')
  const followingActive = feed === 'following' || pathname.startsWith('/reels/following')
  const savedActive = pathname.startsWith('/reels/saved')
  const likedActive = pathname.startsWith('/reels/liked')
  const analyticsActive = pathname.startsWith('/reels/analytics')

  return (
    <nav
      aria-label="Reels sections"
      className="flex justify-around w-full  border-b border-border px-1 sm:px-2  "
    >
      <TabLink active={forYouActive} href="/reels/foryou" label="For you" icon={Compass} />
      <TabLink active={followingActive} href="/reels/following" label="Following" icon={Users} />
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
    <header className="sticky top-16 z-20 w-full bg-white/95 py-2 backdrop-blur-md">
      <div>
        <ReelsMainTabs feed={feed} />
        {exploreCategories ? (
          <div className="border-b border-border px-3 py-2 sm:px-4 lg:px-5">{exploreCategories}</div>
        ) : null}
      </div>
    </header>
  )
}
