'use client'

import React from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

const AccountActivated: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <Link href="/">
              <img src="/assets/images/logo_2.png" alt="ConnectAfrik" className="w-30" />
            </Link>
          </div>
        </div>

        <div className="card text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>

          <h1 className="sm:text-2xl text-xl font-bold text-content mb-2">
            Account activated successfully
          </h1>
          <p className="text-content-secondary sm:text-base text-sm mb-6">
            Your email has been verified. You can now sign in and start connecting with the
            African community worldwide.
          </p>

          <Link href="/signin" className="w-full btn-primary text-base inline-block">
            Continue to sign in
          </Link>

          <p className="text-xs text-content-secondary mt-4">
            Welcome to ConnectAfrik — uniting Africans and the diaspora worldwide.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AccountActivated
