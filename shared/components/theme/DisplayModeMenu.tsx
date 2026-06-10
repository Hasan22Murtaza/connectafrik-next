'use client'

import React, { useState } from 'react'
import { Check, ChevronRight, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/shared/theme/useTheme'
import { THEME_MODES, type ThemeMode } from '@/shared/theme/types'

const MODE_ICONS: Record<ThemeMode, React.ReactNode> = {
  light: <Sun className="w-4 h-4" />,
  dark: <Moon className="w-4 h-4" />,
  system: <Monitor className="w-4 h-4" />,
}

type DisplayModeMenuProps = {
  onClose?: () => void
  variant?: 'flyout' | 'inline'
}

const DisplayModeMenu: React.FC<DisplayModeMenuProps> = ({
  onClose,
  variant = 'flyout',
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const activeTheme = (theme ?? 'system') as ThemeMode

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode)
    onClose?.()
  }

  const activeLabel =
    THEME_MODES.find((item) => item.value === activeTheme)?.label ?? 'Automatic'

  const optionsList = (
    <div
      className={
        variant === 'inline'
          ? 'px-2 pb-2'
          : 'absolute right-full top-0 mr-1 w-52 bg-surface-elevated rounded-lg shadow-dropdown border border-border py-1 z-50'
      }
      role="menu"
    >
      {THEME_MODES.map((item) => {
        const isActive = activeTheme === item.value

        return (
          <button
            key={item.value}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            onClick={() => handleSelect(item.value)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-content hover:bg-surface-hover transition-colors rounded-md"
          >
            <span className="flex items-center gap-3">
              <span className="text-content-secondary">{MODE_ICONS[item.value]}</span>
              <span>{item.label}</span>
            </span>
            {isActive && <Check className="w-4 h-4 text-primary" />}
          </button>
        )
      })}
    </div>
  )

  if (variant === 'inline') {
    return (
      <div className="px-2 py-1">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          Display mode
        </p>
        {optionsList}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm text-content hover:bg-surface-hover transition-colors"
        aria-expanded={isExpanded}
        aria-haspopup="menu"
      >
        <span className="flex items-center gap-2">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-content-secondary" />
          ) : (
            <Sun className="w-4 h-4 text-content-secondary" />
          )}
          <span>Display mode</span>
        </span>
        <ChevronRight
          className={`w-4 h-4 text-content-tertiary transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {isExpanded && optionsList}

      <p className="px-4 pb-1 text-xs text-content-tertiary">{activeLabel}</p>
    </div>
  )
}

export default DisplayModeMenu
