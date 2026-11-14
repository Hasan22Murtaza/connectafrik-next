export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'cribstalk-theme'

export const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light mode' },
  { value: 'dark', label: 'Dark mode' },
]
