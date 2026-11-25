'use client'

/** Compact action row for inbound requests / applications / submissions. */
export default function GschRecordActions({
  children,
}: {
  children: React.ReactNode
}) {
  if (!children) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
      {children}
    </div>
  )
}

export function isOpenRecordStatus(status: string) {
  return ['submitted', 'pending', 'under_review', 'open'].includes(status)
}
