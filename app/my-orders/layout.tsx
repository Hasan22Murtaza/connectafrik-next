import { getNoIndexMetadata } from '@/lib/seo'
import LeftSidebar from '@/shared/components/ui/LeftSidebar'

export const metadata = getNoIndexMetadata()

export default function MyOrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen px-1 sm:px-2 2xl:px-6">
      <div className="hidden lg:block shrink-0 overflow-y-auto sticky top-18.25 h-[calc(100vh-80px)]">
        <LeftSidebar />
      </div>

      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  )
}
