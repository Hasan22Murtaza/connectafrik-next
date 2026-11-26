'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  GSCH_NAV_ITEMS,
  isGschNavActive,
} from '@/features/gsch/constants/nav'
import { GSCH_TOURS } from '@/features/gsch/onboarding/tours'
import {
  OnboardingProvider,
  ScreenOnboarding,
} from '@/shared/onboarding'
import 'driver.js/dist/driver.css'
import '@/shared/onboarding/styles.css'
import { GschSidebar } from './GschSidebar'

function gschNavTourKey(href: string) {
  if (href === '/global-hub') return 'home'
  return href.replace('/global-hub/', '').split('/')[0] || 'home'
}

function GschMobileNav() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : ''
  const primary = GSCH_NAV_ITEMS.filter((item) => !item.comingSoon)

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-border/70 bg-background/95 px-3 pb-px pt-2.5 backdrop-blur [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      aria-label="Global Sister Cities sections"
    >
      {primary.map((item) => {
        const active = isGschNavActive(pathname, item, search)
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={`gsch-nav-${gschNavTourKey(item.href.split('?')[0])}`}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? '-mb-px whitespace-nowrap rounded-t-lg border-b-2 border-content px-3 py-2.5 text-sm font-semibold text-content'
                : '-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-content-secondary transition hover:border-border hover:text-content'
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
    <OnboardingProvider module="gsch" tours={GSCH_TOURS}>
      <div className="relative flex min-h-0 min-w-0 w-full lg:min-h-[calc(100dvh-4.5rem)]">
        <aside className="fixed top-[73px] z-20 hidden h-[calc(100dvh-73px)] w-56 shrink-0 self-start overflow-y-auto bg-background md:block">
          <Suspense fallback={null}>
            <GschSidebar />
          </Suspense>
        </aside>

        <main className="min-w-0 flex-1 md:ml-56">
          <Suspense fallback={null}>
            <GschMobileNav />
          </Suspense>
          {children}
        </main>
      </div>
      <ScreenOnboarding />
    </OnboardingProvider>
  )
}
