'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  ChartLine,
  FileText,
  Globe,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Link2,
  MapPin,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
} from '@/shared/icons'
import {
  GSCH_NAV_ITEMS,
  type GschNavItem,
} from '@/features/gsch/constants/nav'

const ICONS: Record<string, typeof Globe> = {
  '/global-hub': LayoutDashboard,
  '/global-hub/discover': Search,
  '/global-hub/organization': Building2,
  '/global-hub/verification': ShieldCheck,
  '/global-hub/cities': MapPin,
  '/global-hub/matching': Target,
  '/global-hub/partnerships': Link2,
  '/global-hub/agreements': FileText,
  '/global-hub/opportunities': Briefcase,
  '/global-hub/investment': TrendingUp,
  '/global-hub/business': Landmark,
  '/global-hub/education': BookOpen,
  '/global-hub/tourism': Camera,
  '/global-hub/smart-cities': Lightbulb,
  '/global-hub/climate': Globe,
  '/global-hub/events': Calendar,
  '/global-hub/analytics': ChartLine,
  '/chat': Globe,
}

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

export function GschSidebar() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : ''

  return (
    <aside className="h-full w-full shrink-0 border-r border-border px-2 py-4 md:w-52">
      <h2 className="mb-4 px-1 font-semibold leading-tight text-content">
        Global Hub
      </h2>

      <nav className="space-y-0.5" aria-label="Global Sister Cities sections">
        {GSCH_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, search, item)
          const Icon = ICONS[item.href.split('?')[0]] ?? Globe

          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-200 ${
                active
                  ? 'bg-surface-secondary text-content'
                  : 'text-content-secondary hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-surface-hover dark:hover:text-content'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active
                    ? 'text-content'
                    : 'text-content-secondary group-hover:text-gray-600 dark:group-hover:text-content'
                }`}
                strokeWidth={1.75}
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.comingSoon ? (
                <span className="shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-content-tertiary">
                  Soon
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
