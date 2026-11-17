'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Moon, Sun } from '@/shared/icons'
import { useTheme } from '@/shared/theme/useTheme'
import { THEME_MODES, type ThemeMode } from '@/shared/theme/types'

const MODE_ICONS: Record<ThemeMode, React.ReactNode> = {
  light: <Sun className="w-4 h-4" />,
  dark: <Moon className="w-4 h-4" />,
}

type DisplayModeMenuProps = {
  onClose?: () => void
  variant?: 'flyout' | 'inline' | 'icon'
}

const DisplayModeMenu: React.FC<DisplayModeMenuProps> = ({
  onClose,
  variant = 'flyout',
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const activeTheme = (theme === 'dark' ? 'dark' : 'light') as ThemeMode

  useEffect(() => {
    if (!isExpanded || variant === 'inline') return

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExpanded(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isExpanded, variant])

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode)
    setIsExpanded(false)
    onClose?.()
  }

  const activeLabel =
    THEME_MODES.find((item) => item.value === activeTheme)?.label ?? 'Light mode'

  const optionsList = (
    <div
      className={
        variant === 'inline'
          ? 'px-2 pb-2'
          : variant === 'icon'
            ? 'absolute bottom-12 right-0 z-50 w-52 rounded-lg border border-border bg-surface-elevated px-2 py-1 shadow-dropdown'
            : 'absolute left-1/2 top-10 z-50 w-52 -translate-x-1/2 rounded-lg border border-border bg-surface-elevated px-2 py-1 shadow-dropdown'
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
            className="flex w-full items-center justify-between rounded-md px-4 py-1.5 text-sm text-content transition-colors hover:bg-surface-hover"
          >
            <span className="flex items-center gap-3">
              <span className="text-content-secondary">{MODE_ICONS[item.value]}</span>
              <span>{item.label}</span>
            </span>
            {isActive && <Check className="h-4 w-4 text-content" />}
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

  if (variant === 'icon') {
    return (
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF1F5] text-[#F97316] transition hover:bg-surface-hover dark:bg-surface-secondary"
          aria-label="Display mode"
          aria-expanded={isExpanded}
          aria-haspopup="menu"
        >
          {resolvedTheme === 'dark' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>

        {isExpanded && optionsList}
      </div>
    )
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm text-content transition-colors hover:bg-surface-hover"
        aria-expanded={isExpanded}
        aria-haspopup="menu"
      >
        <span className="flex items-center gap-2">
          {resolvedTheme === 'dark' ? (
            <Moon className="h-4 w-4 text-content-secondary" />
          ) : (
            <Sun className="h-4 w-4 text-content-secondary" />
          )}
          <span>Display mode</span>
        </span>
        <ChevronRight
          className={`h-4 w-4 text-content-tertiary transition-transform ${
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
