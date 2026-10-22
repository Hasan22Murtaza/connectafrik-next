'use client'

export function ReelsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 min-w-0 w-full lg:min-h-[calc(100dvh-4.5rem)]">
      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  )
}
