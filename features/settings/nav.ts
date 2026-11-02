import type { ComponentType } from 'react'
import { Bell, Shield, User, Lock, Monitor, Users } from '@/shared/icons'
import type { SettingsTab } from './types'

export type SettingsNavItem = {
  id: SettingsTab
  href: string
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: 'profile',
    href: '/profile',
    label: 'Profile',
    description: 'Photo, name, and bio',
    icon: User,
  },
  {
    id: 'privacy',
    href: '/profile?tab=privacy',
    label: 'Privacy',
    description: 'Who can see and reach you',
    icon: Shield,
  },
  {
    id: 'notifications',
    href: '/profile?tab=notifications',
    label: 'Notifications',
    description: 'Push, email, and activity alerts',
    icon: Bell,
  },
  {
    id: 'security',
    href: '/settings?tab=security',
    label: 'Security',
    description: 'Password, 2FA, and account',
    icon: Lock,
  },
  {
    id: 'devices',
    href: '/settings?tab=devices',
    label: 'Devices',
    description: 'Sessions and message encryption',
    icon: Monitor,
  },
  {
    id: 'family',
    href: '/settings?tab=family',
    label: 'Family',
    description: 'Parental controls and family accounts',
    icon: Users,
  },
]

/** Full settings nav — Family is visible to everyone; sections inside are role-gated. */
export function getSettingsNav(): SettingsNavItem[] {
  return SETTINGS_NAV
}
