'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { YOUTH_NAV_ITEMS, YOUTH_PAGE_SHELL } from '@/features/youth-leadership/constants/nav'

function isActive(pathname: string, href: string) {
  if (href === '/youth-leadership') {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function YouthShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className={YOUTH_PAGE_SHELL}>
      <header className="mb-5 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-primary via-surface-primary to-primary/5 px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Youth Leadership
            </p>
            {title ? (
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-content-primary sm:text-3xl">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-secondary">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </header>

      <nav
        className="mb-6 -mx-1 flex gap-1 overflow-x-auto pb-1"
        aria-label="Youth Leadership sections"
      >
        {YOUTH_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? 'whitespace-nowrap rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm'
                  : 'whitespace-nowrap rounded-full px-3.5 py-2 text-sm text-content-secondary transition hover:bg-surface-hover hover:text-content-primary'
              }
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
