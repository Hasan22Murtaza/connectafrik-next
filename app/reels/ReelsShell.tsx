'use client'

export function ReelsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full min-h-0 min-w-0 lg:min-h-[calc(100dvh-4.5rem)]">
      {children}
    </div>
  )
}
