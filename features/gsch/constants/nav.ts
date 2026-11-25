export type GschNavItem = {
  href: string
  label: string
  match?: string[]
  comingSoon?: boolean
  external?: boolean
}

export function isGschNavActive(
  pathname: string,
  item: GschNavItem,
  search = ''
) {
  if (item.external) return false
  if (item.comingSoon) {
    if (!pathname.startsWith('/global-hub/coming-soon')) return false
    const module = new URL(item.href, 'http://local').searchParams.get('m')
    return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('m') ===
      module
  }
  if (item.match?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }
  if (item.href === '/global-hub') {
    return pathname === item.href
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export const GSCH_NAV_ITEMS: GschNavItem[] = [
  { href: '/global-hub', label: 'Home' },
  { href: '/global-hub/discover', label: 'Discover' },
  { href: '/global-hub/organization', label: 'Organization' },
  { href: '/global-hub/verification', label: 'Verification' },
  {
    href: '/global-hub/cities',
    label: 'City Profiles',
    match: ['/global-hub/cities'],
  },
  { href: '/global-hub/admin', label: 'Admin' },
  {
    href: '/global-hub/coming-soon?m=opportunity-map',
    label: 'Opportunity Map',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=partner-matching',
    label: 'Partner Matching',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=investment',
    label: 'Investment',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=business',
    label: 'Business',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=education',
    label: 'Education',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=tourism',
    label: 'Tourism',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=smart-cities',
    label: 'Smart Cities',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=climate',
    label: 'Climate',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=partnership-builder',
    label: 'Partnership Builder',
    comingSoon: true,
  },
  {
    href: '/global-hub/coming-soon?m=events',
    label: 'Events',
    comingSoon: true,
  },
  { href: '/chat', label: 'Messages', external: true },
  {
    href: '/global-hub/coming-soon?m=analytics',
    label: 'Analytics',
    comingSoon: true,
  },
]

export const GSCH_PHASE1_NAV = GSCH_NAV_ITEMS.filter(
  (item) => !item.comingSoon || item.external
)
