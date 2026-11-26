'use client'

export type GschHubTab = {
  id: string
  label: string
}

export default function GschHubTabs({
  tabs,
  activeId,
  onChange,
  'aria-label': ariaLabel = 'Section views',
}: {
  tabs: GschHubTab[]
  activeId: string
  onChange: (id: string) => void
  'aria-label'?: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={
              active
                ? 'rounded-full bg-surface-tertiary px-3.5 py-1.5 text-sm font-semibold text-content'
                : 'rounded-full px-3.5 py-1.5 text-sm font-medium text-content-secondary transition hover:bg-surface-secondary/80 hover:text-content'
            }
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
