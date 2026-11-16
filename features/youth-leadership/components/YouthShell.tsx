'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheck } from '@/shared/icons'
import {
  YOUTH_NAV_ITEMS,
  YOUTH_PAGE_SHELL,
  type YouthNavItem,
} from '@/features/youth-leadership/constants/nav'
import YouthHubTabs, { type YouthHubTab } from './YouthHubTabs'

function isActive(pathname: string, item: YouthNavItem) {
  if (item.match?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }
  if (item.href === '/youth-leadership') {
    return pathname === item.href
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function YouthShell({
  children,
  title,
  subtitle,
  actions,
  showSafetyBadge = true,
  tabs,
  activeTab,
  onTabChange,
}: {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  showSafetyBadge?: boolean
  tabs?: YouthHubTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
}) {
  const pathname = usePathname()

  return (
    <div className={YOUTH_PAGE_SHELL}>
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {title ? (
                <h1 className="text-2xl font-semibold tracking-tight text-content sm:text-[1.75rem]">
                  {title}
                </h1>
              ) : null}
             
            </div>
            {subtitle ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-content-secondary">
                {subtitle}
              </p>
            ) : null}
          </div>

          {actions ? (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
          ) : null}
        </div>

        <nav
          className="flex gap-1 overflow-x-auto border-b border-border/70 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Youth Leadership sections"
        >
          {YOUTH_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? '-mb-px whitespace-nowrap border-b-2 border-primary px-3.5 py-2.5 text-sm font-semibold text-primary'
                    : '-mb-px whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-content-secondary transition hover:border-border hover:text-content'
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {tabs && activeTab && onTabChange ? (
          <YouthHubTabs tabs={tabs} activeId={activeTab} onChange={onTabChange} />
        ) : null}
      </div>

      {children}
    </div>
  )
}
