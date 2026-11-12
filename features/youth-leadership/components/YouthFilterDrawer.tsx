'use client'

import { useEffect, useId, useState } from 'react'
import { X } from '@/shared/icons'
import Portal from '@/shared/components/ui/Portal'

type YouthFilterDrawerProps = {
  open: boolean
  title?: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function YouthFilterDrawer({
  open,
  title = 'Filters',
  description,
  onClose,
  children,
  footer,
}: YouthFilterDrawerProps) {
  const titleId = useId()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!open) {
      setVisible(false)
      const timer = window.setTimeout(() => setMounted(false), 220)
      return () => window.clearTimeout(timer)
    }

    setMounted(true)
    const frame = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(frame)
  }, [open])

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

  if (!mounted) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[10050]" role="presentation">
        <button
          type="button"
          aria-label="Close filters"
          className={`absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`absolute inset-y-0 right-0 flex h-[100dvh] w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-200 ease-out ${
            visible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 pr-2">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-content">
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
              className="shrink-0 rounded-xl p-2 text-content-secondary transition hover:bg-surface-hover hover:text-content"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>

          {footer ? (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-secondary px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          ) : null}
        </aside>
      </div>
    </Portal>
  )
}
