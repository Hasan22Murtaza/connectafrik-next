'use client'

import React, { useEffect, useState } from 'react'
import { RefreshCw, X } from '@/shared/icons'
import { OtpInput } from '@/shared/components/auth/OtpInput'
import { maskEmail } from '@/lib/auth/format'

type TwoFactorSetupModalProps = {
  open: boolean
  email: string
  busy: boolean
  resending: boolean
  error: string
  onClose: () => void
  onResend: () => void
  onSubmit: (code: string) => void
}

export function TwoFactorSetupModal({
  open,
  email,
  busy,
  resending,
  error,
  onClose,
  onResend,
  onSubmit,
}: TwoFactorSetupModalProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])

  useEffect(() => {
    if (!open) {
      setOtp(['', '', '', '', '', ''])
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const code = otp.join('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-surface shadow-dropdown"
        role="dialog"
        aria-labelledby="two-factor-setup-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h2 id="two-factor-setup-title" className="text-lg font-semibold text-content">
            Confirm two-factor authentication
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length !== 6) return
            onSubmit(code)
          }}
          className="space-y-5 p-5"
        >
          <p className="text-sm text-content-secondary">
            Enter the 6-digit code sent to {maskEmail(email)} to turn on two-factor authentication.
          </p>
          <OtpInput value={otp} onChange={setOtp} disabled={busy} idPrefix="two-factor-otp" />
          {error ? (
            <p className="text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onResend}
            disabled={busy || resending}
            className="mx-auto flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Sending…' : 'Resend code'}
          </button>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Enable two-factor'}
          </button>
        </form>
      </div>
    </div>
  )
}
