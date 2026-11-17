'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bookmark,
  Compass,
  Heart,
  Home,
  Plus,
  Repeat2,
  Users,
} from '@/shared/icons'

const sections: {
  href: string
  label: string
  icon: typeof Bookmark
  match: (pathname: string) => boolean
}[] = [
  {
    href: '/reels/foryou',
    label: 'For You',
    icon: Home,
    match: (pathname) =>
      pathname === '/reels' || pathname.startsWith('/reels/foryou'),
  },
  {
    href: '/reels/explore',
    label: 'Explore',
    icon: Compass,
    match: (pathname) => pathname.startsWith('/reels/explore'),
  },
  {
    href: '/reels/following',
    label: 'Tapping In',
    icon: Users,
    match: (pathname) => pathname.startsWith('/reels/following'),
  },
  {
    href: '/reels/saved',
    label: 'Saved',
    icon: Bookmark,
    match: (pathname) => pathname.startsWith('/reels/saved'),
  },
  {
    href: '/reels/reposted',
    label: 'Reposted',
    icon: Repeat2,
    match: (pathname) => pathname.startsWith('/reels/reposted'),
  },
  {
    href: '/reels/liked',
    label: 'Liked',
    icon: Heart,
    match: (pathname) => pathname.startsWith('/reels/liked'),
  },
  {
    href: '/reels/analytics',
    label: 'Analytics',
    icon: BarChart3,
    match: (pathname) => pathname.startsWith('/reels/analytics'),
  },
  {
    href: '/reels/create',
    label: 'Upload',
    icon: Plus,
    match: (pathname) => pathname.startsWith('/reels/create'),
  },
]

export function ReelsSidebar() {
  const pathname = usePathname() || ''

  return (
    <aside className="h-full w-full shrink-0 border-r border-border px-2 py-4 md:w-48">
      <h2 className="mb-4 px-1 text-lg font-semibold text-content">Reels</h2>

      <nav className="space-y-0.5" aria-label="Reels sections">
        {sections.map(({ href, label, icon: Icon, match }) => {
          const isActive = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-200 ${
                isActive
                  ? 'bg-surface-secondary text-content'
                  : 'text-content-secondary hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-surface-hover dark:hover:text-content'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive
                    ? 'text-content'
                    : 'text-content-secondary group-hover:text-gray-600 dark:group-hover:text-content'
                }`}
                strokeWidth={1.75}
              />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
