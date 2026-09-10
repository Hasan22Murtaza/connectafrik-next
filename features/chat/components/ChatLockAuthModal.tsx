'use client'

import React, { useEffect, useRef, useState } from 'react'
import Portal from '@/shared/components/ui/Portal'
import { Lock, Loader2 } from '@/shared/icons'

export type ChatLockAuthMode = 'verify' | 'set-pin' | 'change-pin'

type ChatLockAuthModalProps = {
  open: boolean
  mode: ChatLockAuthMode
  chatTitle?: string
  submitting?: boolean
  error?: string | null
  onSubmitPin: (pin: string, extras?: { current_pin?: string; password?: string }) => void
  onSubmitPassword?: (password: string) => void
  onCancel: () => void
}

export function ChatLockAuthModal({
  open,
  mode,
  chatTitle,
  submitting = false,
  error,
  onSubmitPin,
  onSubmitPassword,
  onCancel,
}: ChatLockAuthModalProps) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPin('')
    setConfirmPin('')
    setCurrentPin('')
    setPassword('')
    setUsePassword(false)
    const t = window.setTimeout(() => pinRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, mode])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const chatLabel = chatTitle?.trim() ? chatTitle.trim() : 'this chat'
  const title =
    mode === 'set-pin'
      ? 'Set chat lock PIN'
      : mode === 'change-pin'
        ? 'Change chat lock PIN'
        : `Unlock ${chatLabel}`
  const description =
    mode === 'set-pin'
      ? 'Choose a 4–6 digit PIN. The same PIN unlocks every chat in Locked Chats.'
      : mode === 'change-pin'
        ? 'Enter your current PIN, then choose a new 4–6 digit PIN. This updates the PIN for all locked chats.'
        : 'Enter your chat lock PIN. The same PIN unlocks every locked conversation.'

  const newPinReady =
    mode === 'verify' && usePassword
      ? password.length > 0
      : pin.length >= 4 && (mode === 'verify' || pin === confirmPin)
  const currentReady = mode !== 'change-pin' || (usePassword ? password.length > 0 : currentPin.length >= 4)
  const canSubmit = !submitting && newPinReady && currentReady

  const submit = () => {
    if (!canSubmit) return
    if (mode === 'verify' && usePassword && onSubmitPassword) {
      onSubmitPassword(password)
      return
    }
    if (mode === 'change-pin') {
      onSubmitPin(pin, usePassword ? { password } : { current_pin: currentPin })
      return
    }
    onSubmitPin(pin)
  }

  const pinInputClass =
    'mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 tracking-[0.4em] text-content outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100'

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-lock-auth-title"
        onClick={onCancel}
      >
        <div
          className="mx-4 w-full max-w-md rounded-lg bg-surface p-6 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <Lock className="h-6 w-6" aria-hidden />
          </div>
          <h3 id="chat-lock-auth-title" className="text-lg font-semibold text-content">
            {title}
          </h3>
          <p className="mt-1 mb-5 text-sm text-content-secondary">{description}</p>

          {mode === 'verify' && usePassword ? (
            <label className="block text-sm text-content-secondary">
              Account password
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-content outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </label>
          ) : (
            <>
              {mode === 'change-pin' && !usePassword ? (
                <label className="mb-3 block text-sm text-content-secondary">
                  Current PIN
                  <input
                    ref={pinRef}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={pinInputClass}
                  />
                </label>
              ) : null}
              {mode === 'change-pin' && usePassword ? (
                <label className="mb-3 block text-sm text-content-secondary">
                  Account password
                  <input
                    type="password"
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-content outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                </label>
              ) : null}
              <label className="block text-sm text-content-secondary">
                {mode === 'set-pin' ? 'PIN' : mode === 'change-pin' ? 'New PIN' : 'Chat lock PIN'}
                <input
                  ref={mode === 'change-pin' ? undefined : pinRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && mode === 'verify') submit()
                  }}
                  className={pinInputClass}
                />
              </label>
              {mode === 'set-pin' || mode === 'change-pin' ? (
                <label className="mt-3 block text-sm text-content-secondary">
                  Confirm {mode === 'change-pin' ? 'new PIN' : 'PIN'}
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submit()
                    }}
                    className={pinInputClass}
                  />
                </label>
              ) : null}
            </>
          )}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          {(mode === 'verify' && onSubmitPassword) || mode === 'change-pin' ? (
            <button
              type="button"
              onClick={() => setUsePassword((v) => !v)}
              className="mt-3 text-sm font-medium text-primary-700 hover:underline"
            >
              {usePassword ? 'Use chat lock PIN' : 'Use account password instead'}
            </button>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-content-secondary transition-colors hover:text-content"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === 'set-pin' ? 'Set PIN' : mode === 'change-pin' ? 'Change PIN' : 'Unlock'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
