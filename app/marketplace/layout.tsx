import { getNoIndexMetadata } from '@/lib/seo'

export const metadata = getNoIndexMetadata('TradeHub')

export default function MarketplaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
