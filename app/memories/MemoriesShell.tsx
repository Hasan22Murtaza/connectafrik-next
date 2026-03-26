'use client'

import { useEffect, useState } from 'react'
import { MemoriesNav } from '@/features/social/components/MemoriesNav'

export function MemoriesShell({ children }: { children: React.ReactNode }) {
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(false)

  useEffect(() => {
    const sync = () => setShowDesktopSidebar(window.innerWidth >= 1024)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return (
    <div className="flex w-full flex-col bg-white lg:min-h-[calc(100dvh-4.5rem)] lg:flex-row lg:bg-neutral-100">
      {showDesktopSidebar && (
        <aside className="z-10 w-[220px] shrink-0 border-r border-gray-200/80 bg-white xl:w-56">
          <div className="sticky top-[4.5rem] max-h-[calc(100dvh-4.5rem)] overflow-y-auto py-3">
            <MemoriesNav variant="sidebar" />
          </div>
        </aside>
      )}
      <div className="relative min-h-0 min-w-0 flex-1">
        {children}
      </div>
    </div>
  )
}
