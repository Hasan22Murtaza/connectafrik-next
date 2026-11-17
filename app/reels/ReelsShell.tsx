'use client'

import { usePathname } from 'next/navigation'
import { ReelsSidebar } from '@/features/social/components/ReelsSidebar'

function isImmersiveReelsPath(pathname: string) {
  return (
    pathname.startsWith('/reels/my-videos') ||
    pathname === '/reels/feed' ||
    pathname.endsWith('/feed')
  )
}

export function ReelsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const showSidebar = !isImmersiveReelsPath(pathname)

  return (
    <div className="relative flex min-h-0 min-w-0 w-full lg:min-h-[calc(100dvh-4.5rem)]">
      {showSidebar ? (
        <aside className="fixed top-[73px] z-20 hidden h-[calc(100dvh-73px)] w-48 shrink-0 self-start overflow-y-auto bg-background md:block">
          <ReelsSidebar />
        </aside>
      ) : null}

      <main className={`min-w-0 flex-1 ${showSidebar ? 'md:ml-48' : ''}`}>
        {children}
      </main>
    </div>
  )
}
