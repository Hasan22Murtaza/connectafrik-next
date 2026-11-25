'use client'

import { useEffect, useId } from 'react'
import { X } from '@/shared/icons'
import Portal from '@/shared/components/ui/Portal'

type GschFormModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'md' | 'lg' | 'xl'
}

export default function GschFormModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'lg',
}: GschFormModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const widthClass =
    size === 'md' ? 'max-w-lg' : size === 'xl' ? 'max-w-3xl' : 'max-w-2xl'

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[10050] flex items-end justify-center bg-[var(--surface-overlay)] p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={onClose}
      >
        <div
          className={`flex max-h-[min(92vh,780px)] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-lg sm:rounded-2xl ${widthClass}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4">
            <div className="min-w-0 pr-2">
              <h2
                id={titleId}
                className="text-base font-semibold tracking-tight text-content sm:text-lg"
              >
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="shrink-0 rounded-lg p-2 text-content-secondary transition hover:bg-surface-hover hover:text-content"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface px-5 py-5">
            {children}
          </div>

          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-5 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  )
}
