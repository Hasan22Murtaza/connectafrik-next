'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { Check, Timer, X } from '@/shared/icons'
import {
  DISAPPEARING_DURATION_OPTIONS,
  type DisappearingDurationSec,
} from '@/lib/chat/chatDisappearingMessages'

interface DisappearingMessagesModalProps {
  isOpen: boolean
  currentDurationSec: number | null
  saving?: boolean
  onClose: () => void
  onSelect: (durationSec: DisappearingDurationSec) => void | Promise<void>
}

export function DisappearingMessagesModal({
  isOpen,
  currentDurationSec,
  saving = false,
  onClose,
  onSelect,
}: DisappearingMessagesModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<DisappearingDurationSec | null>(null)

  const selected: DisappearingDurationSec =
    currentDurationSec && currentDurationSec > 0
      ? (currentDurationSec as DisappearingDurationSec)
      : 0

  useEffect(() => {
    if (!isOpen) return
    setPending(null)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, saving, onClose])

  if (!isOpen) return null

  const busy = saving || pending !== null

  const handleSelect = async (value: DisappearingDurationSec) => {
    if (busy) return
    if (value === selected) {
      onClose()
      return
    }
    setPending(value)
    try {
      await onSelect(value)
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(e) => {
        e.stopPropagation()
        if (!busy && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-[22rem] overflow-hidden rounded-t-2xl bg-surface shadow-[0_8px_28px_rgba(11,20,26,0.18)] outline-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-4 pb-2 pt-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/15">
            <Timer className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} className="text-[17px] font-semibold leading-tight text-content">
              Disappearing messages
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-4 pb-4 text-[13px] leading-relaxed text-content-secondary">
          New messages in this chat, including photos and videos, are deleted for everyone after
          this long. Everyone in the chat can change it and is told when it changes.
        </p>

        <div className="mx-4 overflow-hidden rounded-xl border border-border bg-surface">
          {DISAPPEARING_DURATION_OPTIONS.map((option, index) => {
            const isSelected = selected === option.value
            const isPending = pending === option.value
            return (
              <React.Fragment key={option.value}>
                {index > 0 ? <div className="border-t border-border" role="separator" /> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={busy}
                  onClick={() => void handleSelect(option.value)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className={`min-w-0 flex-1 text-[15px] ${
                      isSelected
                        ? 'font-medium text-orange-500'
                        : 'font-normal text-content'
                    }`}
                  >
                    {option.label}
                    {isPending ? (
                      <span className="ml-2 text-xs text-content-tertiary">Saving…</span>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <Check className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
                  ) : (
                    <span className="h-5 w-5 shrink-0" aria-hidden />
                  )}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        <p className="px-4 pb-5 pt-4 text-[12px] leading-relaxed text-content-tertiary">
          Someone can still save or screenshot a message before it disappears.
        </p>
      </div>
    </div>
  )
}
