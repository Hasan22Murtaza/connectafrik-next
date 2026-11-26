'use client'

import { GSCH_PAGE_SHELL } from '@/features/gsch/constants/styles'

export default function GschPageShell({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  breadcrumbs?: React.ReactNode
  actions?: React.ReactNode
}) {
  const hasHeader = Boolean(title || subtitle || actions || breadcrumbs)

  return (
    <div className={GSCH_PAGE_SHELL} data-tour="gsch-page">
      {hasHeader ? (
        <div className="mb-6 space-y-3" data-tour="gsch-page-header">
          {breadcrumbs ? (
            <div className="text-xs text-content-tertiary">{breadcrumbs}</div>
          ) : null}
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
              <div
                className="flex flex-wrap items-center gap-2 sm:shrink-0"
                data-tour="gsch-page-actions"
              >
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div data-tour="gsch-results">{children}</div>
    </div>
  )
}
