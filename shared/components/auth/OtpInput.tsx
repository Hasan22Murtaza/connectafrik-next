'use client'

import React from 'react'

type OtpInputProps = {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  autoFocus?: boolean
  idPrefix?: string
}

export function OtpInput({
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  idPrefix = 'otp',
}: OtpInputProps) {
  const handleOtpChange = (index: number, nextValue: string) => {
    if (nextValue.length > 1) return

    const newOtp = [...value]
    newOtp[index] = nextValue.replace(/\D/g, '')
    onChange(newOtp)

    if (nextValue && index < 5) {
      document.getElementById(`${idPrefix}-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      document.getElementById(`${idPrefix}-${index - 1}`)?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOtp = [...value]

    for (let i = 0; i < 6; i++) {
      newOtp[i] = pastedData[i] || ''
    }

    onChange(newOtp)

    const lastFilledIndex = Math.min(pastedData.length, 5)
    document.getElementById(`${idPrefix}-${lastFilledIndex}`)?.focus()
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="6-digit verification code">
      {value.map((digit, index) => (
        <input
          key={index}
          id={`${idPrefix}-${index}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleOtpChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          className="w-12 h-14 text-center text-2xl font-semibold border-2 border-gray-300 rounded-lg bg-surface-canvas focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-200 transition-colors disabled:opacity-50"
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${index + 1} of 6`}
        />
      ))}
    </div>
  )
}
