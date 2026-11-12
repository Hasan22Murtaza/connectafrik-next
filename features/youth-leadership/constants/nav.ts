export type YouthNavItem = {
  href: string
  label: string
}

export const YOUTH_NAV_ITEMS: YouthNavItem[] = [
  { href: '/youth-leadership', label: 'Discover Programs' },
  { href: '/youth-leadership/applications', label: 'My Applications' },
  { href: '/youth-leadership/programs', label: 'My Programs' },
  { href: '/youth-leadership/mentorship', label: 'Mentorship' },
  { href: '/youth-leadership/projects', label: 'Community Projects' },
  { href: '/youth-leadership/events', label: 'Events & Workshops' },
  { href: '/youth-leadership/achievements', label: 'My Achievements' },
  { href: '/youth-leadership/dashboard', label: 'My Leadership Dashboard' },
  { href: '/youth-leadership/organization', label: 'Organization' },
  { href: '/youth-leadership/guardian', label: 'Guardian Approvals' },
]

export const YOUTH_PAGE_SHELL =
  'mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8'

export const YOUTH_CARD =
  'rounded-2xl border border-border bg-surface-primary p-5 shadow-sm'

export const YOUTH_SECTION_TITLE =
  'text-lg font-semibold text-content-primary'

export const YOUTH_MUTED = 'text-sm text-content-secondary'
