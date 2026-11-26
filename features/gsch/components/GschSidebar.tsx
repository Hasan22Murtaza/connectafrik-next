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
  GSCH_NAV_GROUPS,
  isGschNavActive,
  type GschNavItem,
} from '@/features/gsch/constants/nav'

function gschNavTourKey(href: string) {
  if (href === '/global-hub') return 'home'
  return href.replace('/global-hub/', '').split('/')[0] || 'home'
}

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

function NavLink({
  item,
  pathname,
  search,
}: {
  item: GschNavItem
  pathname: string
  search: string
}) {
  const active = isGschNavActive(pathname, item, search)
  const Icon = ICONS[item.href.split('?')[0]] ?? Globe

  return (
    <Link
      key={`${item.href}-${item.label}`}
      href={item.href}
      data-tour={`gsch-nav-${gschNavTourKey(item.href.split('?')[0])}`}
      aria-current={active ? 'page' : undefined}
      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-200 ${
        active
          ? 'bg-surface-secondary font-medium text-content'
          : 'text-content-secondary hover:bg-surface-secondary hover:text-content'
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          active
            ? 'text-content'
            : 'text-content-secondary group-hover:text-content'
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
}

export function GschSidebar() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : ''

  return (
    <aside className="h-full w-full shrink-0 border-r border-border px-2 py-4 md:w-56">
      <div className="mb-5 px-2">
      
        <h2 className="mt-0.5 font-semibold leading-tight text-content">
          Global Hub
        </h2>
       
      </div>

      <nav className="space-y-2" aria-label="Global Sister Cities sections">
        {GSCH_NAV_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={`${item.href}-${item.label}`}
                  item={item}
                  pathname={pathname}
                  search={search}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
