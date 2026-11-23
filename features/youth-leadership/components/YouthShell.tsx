'use client'

import YouthHubTabs, { type YouthHubTab } from './YouthHubTabs'
import { YOUTH_PAGE_SHELL } from '@/features/youth-leadership/constants/nav'

export default function YouthShell({
  children,
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTabChange,
}: {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  showSafetyBadge?: boolean
  tabs?: YouthHubTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
}) {
  return (
    <div className={YOUTH_PAGE_SHELL}>
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {title ? (
                <h1 className="text-xl font-semibold tracking-tight text-content sm:text-2xl">
                  {title}
                </h1>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-content-secondary">
                {subtitle}
              </p>
            ) : null}
          </div>

          {actions ? (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
          ) : null}
        </div>

        {tabs && activeTab && onTabChange ? (
          <YouthHubTabs tabs={tabs} activeId={activeTab} onChange={onTabChange} />
        ) : null}
      </div>

      {children}
    </div>
  )
}
