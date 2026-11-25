'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { GSCH_NAV_ITEMS, type GschNavItem } from '@/features/gsch/constants/nav'
import { GschSidebar } from './GschSidebar'

function isActive(pathname: string, search: string, item: GschNavItem) {
  if (item.external) return false
  if (item.comingSoon) {
    if (!pathname.startsWith('/global-hub/coming-soon')) return false
    const module = new URL(item.href, 'http://local').searchParams.get('m')
    return new URLSearchParams(search).get('m') === module
  }
  if (item.href === '/global-hub') return pathname === item.href
  if (item.match?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function GschMobileNav() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : ''
  const primary = GSCH_NAV_ITEMS.filter((item) => !item.comingSoon)

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-border/70 px-4 pb-px pt-3 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      aria-label="Global Sister Cities sections"
    >
      {primary.map((item) => {
        const active = isActive(pathname, search, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? '-mb-px whitespace-nowrap border-b-2 border-content px-3.5 py-2.5 text-sm font-semibold text-content'
                : '-mb-px whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-content-secondary transition hover:border-border hover:text-content'
            }
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function GschShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 min-w-0 w-full lg:min-h-[calc(100dvh-4.5rem)]">
      <aside className="fixed top-[73px] z-20 hidden h-[calc(100dvh-73px)] w-52 shrink-0 self-start overflow-y-auto bg-background md:block">
        <Suspense fallback={null}>
          <GschSidebar />
        </Suspense>
      </aside>

      <main className="min-w-0 flex-1 md:ml-52">
        <Suspense fallback={null}>
          <GschMobileNav />
        </Suspense>
        {children}
      </main>
    </div>
  )
}
