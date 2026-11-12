'use client'

import { useEffect, useId } from 'react'
import { X } from '@/shared/icons'
import Portal from '@/shared/components/ui/Portal'

export const YOUTH_FIELD =
  'w-full rounded-lg border border-border bg-surface-primary px-3 py-2.5 text-sm text-content-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

export function YouthFieldLabel({
  children,
  htmlFor,
  hint,
  className = '',
}: {
  children: React.ReactNode
  htmlFor?: string
  hint?: string
  className?: string
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-medium text-content-primary">{children}</span>
      {hint ? (
        <span className="mb-1.5 block text-xs font-normal text-content-tertiary">{hint}</span>
      ) : null}
    </label>
  )
}

type YouthFormModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'md' | 'lg'
}

export default function YouthFormModal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'lg',
}: YouthFormModalProps) {
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

  const widthClass = size === 'md' ? 'max-w-lg' : 'max-w-2xl'

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={onClose}
      >
        <div
          className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface-primary shadow-xl sm:rounded-2xl ${widthClass}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-content-primary">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm text-content-secondary">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="rounded-lg p-2 text-content-secondary transition hover:bg-surface-hover hover:text-content-primary"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-secondary/40 px-5 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  )
}
