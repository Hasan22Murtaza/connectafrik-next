'use client'

import React from 'react'
import { getPasswordRequirements, getPasswordStrength } from '@/lib/auth/password'

type PasswordStrengthMeterProps = {
  password: string
}

const STRENGTH_COLORS = {
  weak: 'bg-red-500',
  fair: 'bg-orange-500',
  good: 'bg-yellow-500',
  strong: 'bg-green-500',
}

const STRENGTH_WIDTH = {
  weak: 'w-1/4',
  fair: 'w-2/4',
  good: 'w-3/4',
  strong: 'w-full',
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const requirements = getPasswordRequirements(password)
  const strength = getPasswordStrength(password)

  return (
    <div className="space-y-2">
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${STRENGTH_COLORS[strength]} ${STRENGTH_WIDTH[strength]}`}
          aria-hidden="true"
        />
      </div>
      <p className="text-xs text-content-secondary capitalize">Password strength: {strength}</p>
      <ul className="space-y-1" aria-live="polite">
        {requirements.map((req) => (
          <li
            key={req.id}
            className={`text-xs ${req.met ? 'text-green-600' : 'text-content-secondary'}`}
          >
            {req.met ? '✓' : '○'} {req.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
