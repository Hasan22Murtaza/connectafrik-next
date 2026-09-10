import { getNoIndexMetadata } from '@/lib/seo'

export const metadata = getNoIndexMetadata()

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children
}
