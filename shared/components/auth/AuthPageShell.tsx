'use client'

import React from 'react'

type AuthPageShellProps = {
  title: string
  subtitle: string
  children: React.ReactNode
  /** @deprecated Logo is rendered by the auth layout */
  showLogo?: boolean
}

export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-white px-5 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all duration-300 sm:px-8 ">
      <div className="mb-6 text-center">
        <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-tight text-[#111827] sm:text-[1.85rem]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#6B7280] sm:text-base">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}
