'use client'

import LeftSidebar from '@/shared/components/ui/LeftSidebar'

export function ReelsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 min-w-0 w-full lg:min-h-[calc(100dvh-4.5rem)]">
      <div className="sticky top-[73px] hidden h-[calc(100dvh-73px)] shrink-0 overflow-y-auto lg:block">
        <LeftSidebar />
      </div>
      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  )
}
