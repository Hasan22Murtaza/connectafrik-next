'use client'

/**
 * Shared toolbar for section content: title, optional badge/meta, and right-side actions.
 */
export default function GschSectionHeader({
  title,
  badge,
  description,
  children,
  className = '',
}: {
  title: React.ReactNode
  badge?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-end justify-between gap-3 ${className}`.trim()}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight text-content sm:text-lg">
            {title}
          </h2>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-content-secondary">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{children}</div>
      ) : null}
    </div>
  )
}
