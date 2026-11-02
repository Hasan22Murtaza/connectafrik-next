export type SettingsTab =
  | 'profile'
  | 'privacy'
  | 'notifications'
  | 'security'
  | 'devices'
  | 'family'

export const SETTINGS_TABS: SettingsTab[] = [
  'profile',
  'privacy',
  'notifications',
  'security',
  'devices',
  'family',
]

export function isSettingsTab(value: string | null): value is SettingsTab {
  return (
    value === 'profile' ||
    value === 'privacy' ||
    value === 'notifications' ||
    value === 'security' ||
    value === 'devices' ||
    value === 'family'
  )
}

export function parseSettingsTab(pathname: string, raw: string | null): SettingsTab | 'hub' {
  if (pathname.startsWith('/profile')) {
    if (raw === 'privacy' || raw === 'notifications') return raw
    return 'profile'
  }

  if (isSettingsTab(raw)) return raw
  return 'hub'
}
