'use client'

import React, { useEffect, useRef } from 'react'
import { Globe } from '@/shared/icons'
import {
  MESSAGE_TRANSLATION_LANGUAGES,
  type MessageTranslationLanguageCode,
} from '@/features/chat/constants/messageTranslationLanguages'

interface ChatTranslationMenuProps {
  value: MessageTranslationLanguageCode
  onChange: (language: MessageTranslationLanguageCode) => void
  disabled?: boolean
}

export default function ChatTranslationMenu({
  value,
  onChange,
  disabled = false,
}: ChatTranslationMenuProps) {
  const [open, setOpen] = React.useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
          value !== 'off'
            ? 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40'
            : ' text-content-tertiary transition duration-200 hover:bg-orange-500 hover:text-white dark:text-content-secondary dark:hover:bg-surface-hover'
        } disabled:cursor-not-allowed disabled:opacity-40`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Translate into another language"
        title="Translate messages"
      >
        <Globe className="h-5 w-5" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-xl animate-[chatFadeIn_140ms_ease-out]"
        >
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
            Translate into…
          </p>
          {MESSAGE_TRANSLATION_LANGUAGES.map((language) => {
            const selected = value === language.code
            return (
              <button
                key={language.code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange(language.code)
                  setOpen(false)
                }}
                className={`w-full px-3 py-1.5 text-left text-sm transition hover:bg-surface-hover ${
                  selected ? 'font-medium text-primary-600' : 'text-content'
                }`}
              >
                {language.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
