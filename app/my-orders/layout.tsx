import { getNoIndexMetadata } from '@/lib/seo'

export const metadata = getNoIndexMetadata()

export default function MyOrdersLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-w-0 flex-1">{children}</main>
}
