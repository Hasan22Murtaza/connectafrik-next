import { getNoIndexMetadata } from '@/lib/seo'

export const metadata = getNoIndexMetadata('Communities')

export default function GroupsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
