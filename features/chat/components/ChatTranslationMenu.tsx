'use client'

import React, { useEffect, useRef } from 'react'
import { Globe } from 'lucide-react'
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
            : 'text-content-secondary hover:bg-surface-hover hover:text-primary-600'
        } disabled:cursor-not-allowed disabled:opacity-40`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Receive messages in another language"
        title="Translate messages"
      >
        <Globe className="h-5 w-5" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 max-h-72 min-w-[220px] overflow-y-auto rounded-xl border border-border bg-surface py-2 shadow-xl animate-[chatFadeIn_140ms_ease-out]"
        >
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
            Receive messages in...
          </div>
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
                className={`flex w-full items-center px-3 py-2 text-left text-[13px] transition hover:bg-surface-hover ${
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
