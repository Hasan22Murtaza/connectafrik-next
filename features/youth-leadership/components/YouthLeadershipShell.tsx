'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import {
  YOUTH_NAV_ITEMS,
  isYouthNavActive,
} from '@/features/youth-leadership/constants/nav'
import { YOUTH_TOURS } from '@/features/youth-leadership/onboarding/tours'
import {
  OnboardingProvider,
  ScreenOnboarding,
} from '@/shared/onboarding'
import 'driver.js/dist/driver.css'
import '@/shared/onboarding/styles.css'
import { YouthLeadershipSidebar } from './YouthLeadershipSidebar'

function youthNavTourKey(href: string) {
  if (href === '/youth-leadership') return 'programs'
  return href.replace('/youth-leadership/', '').split('/')[0] || 'programs'
}

function YouthMobileNav() {
  const pathname = usePathname() || ''

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-border/70 px-4 pb-px pt-3 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      aria-label="Youth Leadership sections"
    >
      {YOUTH_NAV_ITEMS.map((item) => {
        const active = isYouthNavActive(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={`youth-nav-${youthNavTourKey(item.href)}`}
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

export function YouthLeadershipShell({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider module="youth_leadership" tours={YOUTH_TOURS}>
      <div className="relative flex min-h-0 min-w-0 w-full lg:min-h-[calc(100dvh-4.5rem)]">
        <aside className="fixed top-[73px] z-20 hidden h-[calc(100dvh-73px)] w-48 shrink-0 self-start overflow-y-auto bg-background md:block">
          <Suspense fallback={null}>
            <YouthLeadershipSidebar />
          </Suspense>
        </aside>

        <main className="min-w-0 flex-1 md:ml-48">
          <Suspense fallback={null}>
            <YouthMobileNav />
          </Suspense>

          {children}
        </main>
      </div>
      <ScreenOnboarding />
    </OnboardingProvider>
  )
}
