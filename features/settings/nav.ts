import type { ComponentType } from 'react'
import { Bell, Shield, User, Lock } from '@/shared/icons'
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
    description: 'Password, devices, and account',
    icon: Lock,
  },
]
