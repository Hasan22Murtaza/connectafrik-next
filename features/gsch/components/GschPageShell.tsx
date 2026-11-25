'use client'

import { GSCH_PAGE_SHELL } from '@/features/gsch/constants/styles'

export default function GschPageShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}) {
  const hasHeader = Boolean(title || subtitle || actions)

  return (
    <div className={GSCH_PAGE_SHELL}>
      {hasHeader ? (
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              {title ? (
                <h1 className="text-xl font-semibold tracking-tight text-content sm:text-2xl">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-content-secondary">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  )
}
