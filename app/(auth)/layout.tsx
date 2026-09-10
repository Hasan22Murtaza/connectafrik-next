import { getNoIndexMetadata } from '@/lib/seo'

export const metadata = getNoIndexMetadata()

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
