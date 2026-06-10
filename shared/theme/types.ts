export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'connectafrik-theme'

export const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light mode' },
  { value: 'dark', label: 'Dark mode' },
  { value: 'system', label: 'Automatic' },
]
