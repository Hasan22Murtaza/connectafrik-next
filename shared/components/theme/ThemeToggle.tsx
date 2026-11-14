'use client'

import React from 'react'
import { Moon, Sun } from '@/shared/icons'
import { useTheme } from '@/shared/theme/useTheme'
import type { ThemeMode } from '@/shared/theme/types'

const ThemeToggle: React.FC = () => {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const activeTheme: ThemeMode = isDark ? 'dark' : 'light'

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-1 sm:p-1.5 lg:p-2 text-content-tertiary hover:text-primary-600 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Dark mode' : 'Light mode'}
    >
      {activeTheme === 'dark' ? (
        <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
      ) : (
        <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
      )}
    </button>
  )
}

export default ThemeToggle
