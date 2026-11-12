export type YouthNavItem = {
  href: string
  label: string
  /** Extra path prefixes that keep this nav item active (e.g. detail routes). */
  match?: string[]
}

export const YOUTH_NAV_ITEMS: YouthNavItem[] = [
  {
    href: '/youth-leadership',
    label: 'Programs',
    match: ['/youth-leadership/programs'],
  },
  {
    href: '/youth-leadership/community',
    label: 'Community',
    match: ['/youth-leadership/projects', '/youth-leadership/events'],
  },
  { href: '/youth-leadership/mentorship', label: 'Mentorship' },
  {
    href: '/youth-leadership/progress',
    label: 'Progress',
    match: ['/youth-leadership/dashboard', '/youth-leadership/achievements'],
  },
  { href: '/youth-leadership/organization', label: 'Organization' },
  { href: '/youth-leadership/guardian', label: 'Guardian' },
]

export const YOUTH_PROGRAMS_TABS = [
  { id: 'discover', label: 'Discover' },
  { id: 'enrolled', label: 'Enrolled' },
  { id: 'applications', label: 'Applications' },
] as const

export const YOUTH_COMMUNITY_TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'events', label: 'Events' },
] as const

export const YOUTH_PROGRESS_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'achievements', label: 'Achievements' },
] as const

export const YOUTH_MENTORSHIP_TABS = [
  { id: 'mentors', label: 'Find mentors' },
  { id: 'matches', label: 'My matches' },
] as const

export const YOUTH_ORGANIZATION_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'programs', label: 'Programs' },
  { id: 'applications', label: 'Applications' },
] as const

export const YOUTH_GUARDIAN_TABS = [
  { id: 'applications', label: 'Applications' },
  { id: 'mentorships', label: 'Mentorships' },
] as const

export const YOUTH_PAGE_SHELL =
  'mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8'

export const YOUTH_CARD =
  'rounded-2xl border border-border/80 bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

export const YOUTH_CARD_INTERACTIVE =
  'rounded-2xl border border-border/80 bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'

export const YOUTH_SECTION_TITLE =
  'text-lg font-semibold tracking-tight text-content'

export const YOUTH_MUTED = 'text-sm text-content-secondary'

export const YOUTH_CHIP =
  'inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-1 text-xs text-content-secondary'

export const YOUTH_SELECT =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
