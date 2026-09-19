'use client'

import React, { useEffect, useState } from 'react'
import { Eye, EyeOff, X } from '@/shared/icons'
import { PasswordStrengthMeter } from '@/shared/components/auth/PasswordStrengthMeter'
import { settingsInputClass, settingsLabelClass } from './SettingsPrimitives'

type PasswordForm = {
  current: string
  next: string
  confirm: string
}

type ChangePasswordModalProps = {
  open: boolean
  busy: boolean
  form: PasswordForm
  onChange: (next: PasswordForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function ChangePasswordModal({
  open,
  busy,
  form,
  onChange,
  onClose,
  onSubmit,
}: ChangePasswordModalProps) {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!open) {
      setShowCurrent(false)
      setShowNew(false)
      setShowConfirm(false)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-surface shadow-dropdown"
        role="dialog"
        aria-labelledby="change-password-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h2 id="change-password-title" className="text-lg font-semibold text-content">
            Change password
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <p className="text-sm text-content-secondary">
            Enter your current password, then choose a new one (at least 8 characters).
          </p>
          <PasswordField
            id="cp-current"
            label="Current password"
            autoComplete="current-password"
            value={form.current}
            visible={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            onChange={(value) => onChange({ ...form, current: value })}
          />
          <PasswordField
            id="cp-new"
            label="New password"
            autoComplete="new-password"
            value={form.next}
            visible={showNew}
            onToggle={() => setShowNew((v) => !v)}
            onChange={(value) => onChange({ ...form, next: value })}
            minLength={8}
          />
          {form.next ? <PasswordStrengthMeter password={form.next} /> : null}
          <PasswordField
            id="cp-confirm"
            label="Confirm new password"
            autoComplete="new-password"
            value={form.confirm}
            visible={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            onChange={(value) => onChange({ ...form, confirm: value })}
            minLength={8}
          />
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary min-h-11 rounded-[14px] px-4" disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary min-h-11 rounded-[14px] px-4" disabled={busy}>
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  visible,
  onToggle,
  onChange,
  minLength,
}: {
  id: string
  label: string
  autoComplete: string
  value: string
  visible: boolean
  onToggle: () => void
  onChange: (value: string) => void
  minLength?: number
}) {
  return (
    <div>
      <label htmlFor={id} className={settingsLabelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${settingsInputClass} pr-12`}
          required
          minLength={minLength}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-content-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
