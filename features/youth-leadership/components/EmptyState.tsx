'use client'

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-secondary/40 px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-content-primary">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-content-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
