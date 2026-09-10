import { getNoIndexMetadata } from '@/lib/seo'

export const metadata = getNoIndexMetadata()

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
