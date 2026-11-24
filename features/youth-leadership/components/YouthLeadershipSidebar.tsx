'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Award,
  Building2,
  LayoutDashboard,
  ShieldCheck,
  UserCheck,
  Users,
} from '@/shared/icons'
import {
  YOUTH_NAV_ITEMS,
  isYouthNavActive,
} from '@/features/youth-leadership/constants/nav'

const ICONS: Record<string, typeof Award> = {
  '/youth-leadership': Award,
  '/youth-leadership/community': Users,
  '/youth-leadership/mentorship': UserCheck,
  '/youth-leadership/progress': LayoutDashboard,
  '/youth-leadership/organization': Building2,
  '/youth-leadership/guardian': ShieldCheck,
}

export function YouthLeadershipSidebar() {
  const pathname = usePathname() || ''

  return (
    <aside className="h-full w-full shrink-0 border-r border-border px-2 py-4 md:w-48">
      <h2 className="mb-4 px-1 font-semibold leading-tight text-content">
        Youth Leadership
      </h2>

      <nav className="space-y-0.5" aria-label="Youth Leadership sections">
        {YOUTH_NAV_ITEMS.map((item) => {
          const active = isYouthNavActive(pathname, item)
          const Icon = ICONS[item.href] ?? Award

          return (
            <Link
              key={item.href}
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
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
