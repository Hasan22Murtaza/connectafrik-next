'use client'

export type YouthHubTab = {
  id: string
  label: string
}

export default function YouthHubTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: YouthHubTab[]
  activeId: string
  onChange: (id: string) => void
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Section views"
    >
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
                ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-white'
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
