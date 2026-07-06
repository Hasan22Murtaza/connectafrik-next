'use client'

import React from 'react'
import Link from 'next/link'

type AuthPageShellProps = {
  title: string
  subtitle: string
  children: React.ReactNode
  showLogo?: boolean
}

export function AuthPageShell({
  title,
  subtitle,
  children,
  showLogo = true,
}: AuthPageShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          {showLogo && (
            <div className="flex items-center justify-center mb-4">
              <Link href="/">
                <img src="/assets/images/logo_2.png" alt="ConnectAfrik" className="w-30" />
              </Link>
            </div>
          )}
          <h1 className="sm:text-3xl text-2xl font-bold text-content mb-2">{title}</h1>
          <p className="text-content-secondary sm:text-base text-sm">{subtitle}</p>
        </div>
        <div className="card transition-all duration-300">{children}</div>
      </div>
    </div>
  )
}
