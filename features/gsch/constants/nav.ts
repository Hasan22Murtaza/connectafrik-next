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
  {
    href: '/global-hub/matching',
    label: 'Partner Matching',
    match: ['/global-hub/matching'],
  },
  {
    href: '/global-hub/partnerships',
    label: 'Partnerships',
    match: ['/global-hub/partnerships'],
  },
  {
    href: '/global-hub/agreements',
    label: 'Partnership Builder',
    match: ['/global-hub/agreements'],
  },
  {
    href: '/global-hub/opportunities',
    label: 'Opportunities',
    match: ['/global-hub/opportunities'],
  },
  {
    href: '/global-hub/investment',
    label: 'Investment',
    match: ['/global-hub/investment'],
  },
  {
    href: '/global-hub/business',
    label: 'Business',
    match: ['/global-hub/business'],
  },
  {
    href: '/global-hub/education',
    label: 'Education',
    match: ['/global-hub/education'],
  },
  {
    href: '/global-hub/tourism',
    label: 'Tourism',
    match: ['/global-hub/tourism'],
  },
  {
    href: '/global-hub/smart-cities',
    label: 'Smart Cities',
    match: ['/global-hub/smart-cities'],
  },
  {
    href: '/global-hub/climate',
    label: 'Climate',
    match: ['/global-hub/climate'],
  },
  {
    href: '/global-hub/events',
    label: 'Events',
    match: ['/global-hub/events'],
  },
  
]

export const GSCH_PHASE1_NAV = GSCH_NAV_ITEMS.filter(
  (item) => !item.comingSoon || item.external
)

export const GSCH_LIVE_NAV = GSCH_NAV_ITEMS.filter((item) => !item.comingSoon)
