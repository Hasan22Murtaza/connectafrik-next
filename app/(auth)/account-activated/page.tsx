'use client'

import React from 'react'
import Link from 'next/link'
import { CheckCircle2 } from '@/shared/icons'
import { AuthPageShell } from '@/shared/components/auth/AuthPageShell'

const AccountActivated: React.FC = () => {
  return (
    <AuthPageShell
      title="Account activated successfully"
      subtitle="Your email has been verified. You can now sign in and start connecting with people and communities worldwide."
    >
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-9 w-9 text-green-600" />
        </div>

        <Link href="/signin" className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F97316] text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base">
          Continue to sign in <span aria-hidden="true">→</span>
        </Link>

        <p className="mt-5 text-xs text-[#6B7280]">
          Welcome to CribsTalk — connecting people worldwide.
        </p>
      </div>
    </AuthPageShell>
  )
}

export default AccountActivated
