'use client'

/**
 * Shared toolbar for content under YouthHubTabs:
 * section title, optional badge/meta, and right-side actions/filters.
 */
export default function YouthSectionHeader({
  title,
  badge,
  children,
  className = '',
}: {
  title: React.ReactNode
  badge?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-end justify-between gap-3 ${className}`.trim()}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-content">{title}</h2>
        {badge}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{children}</div>
      ) : null}
    </div>
  )
}
