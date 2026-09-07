'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Portal from '@/shared/components/ui/Portal'

export type ConfirmDialogOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
}

type ConfirmDialogProps = ConfirmDialogOptions & {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const confirmClass =
    variant === 'danger'
      ? 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200'
      : 'px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200'

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={onCancel}
      >
        <div
          className="bg-surface rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <h3 id="confirm-dialog-title" className="text-lg font-semibold text-content mb-2">
            {title}
          </h3>
          <p className="text-content-secondary mb-6">{message}</p>
          <div className="flex space-x-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-content-secondary hover:text-gray-800 transition-colors duration-200"
            >
              {cancelLabel}
            </button>
            <button type="button" onClick={onConfirm} className={confirmClass}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

type ConfirmState = ConfirmDialogOptions & { open: boolean }

export function useConfirmDialog() {
  const resolverRef = useRef<((value: boolean) => void) | null>(null)
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
  })

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setState((current) => ({ ...current, open: false }))
  }, [])

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    resolverRef.current?.(false)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setState({ ...options, open: true })
    })
  }, [])

  const handleConfirm = useCallback(() => close(true), [close])
  const handleCancel = useCallback(() => close(false), [close])

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, dialog }
}
