'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { REEL_CATEGORIES, type ReelCategory } from '@/shared/types/reels'

function chipClass(active: boolean) {
  return `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition sm:text-[13px] ${
    active
      ? 'bg-surface-secondary text-content ring-1 ring-border'
      : 'text-content-secondary hover:bg-surface-secondary hover:text-content'
  }`
}

function ReelsCategoriesBarInner() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get('category')
  const onExplore = pathname.startsWith('/reels/explore')
  const allActive =
    onExplore &&
    (!activeCategory || !REEL_CATEGORIES.some((c) => c.value === activeCategory))

  return (
    <nav
      aria-label="Reel categories"
      className="flex gap-1.5 overflow-x-auto px-3 py-2 sm:gap-2 sm:px-4 lg:px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Link
        href="/reels/explore"
        aria-current={allActive ? 'page' : undefined}
        className={chipClass(allActive)}
      >
        All
      </Link>
      {REEL_CATEGORIES.map((cat) => {
        const isActive = onExplore && activeCategory === cat.value
        return (
          <Link
            key={cat.value}
            href={`/reels/explore?category=${cat.value}`}
            aria-current={isActive ? 'page' : undefined}
            className={chipClass(isActive)}
          >
            {cat.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function ReelsCategoriesBar() {
  return (
    <Suspense fallback={null}>
      <ReelsCategoriesBarInner />
    </Suspense>
  )
}

type BrowseHeaderProps = {
  feed: 'foryou' | 'following' | 'explore'
  activeCategory?: ReelCategory
}

/** Top category chips only — section tabs live in the Reels sub-sidebar. */
export function ReelsBrowseHeader(_props: BrowseHeaderProps) {
  return (
    <header className="sticky top-16 z-20 w-full border-b border-border bg-surface/95 backdrop-blur-md md:top-0">
      <ReelsCategoriesBar />
    </header>
  )
}
