import type { Metadata } from 'next'
import { marketplaceReportEntry } from '@/features/legal/registry'
import { getPageMetadata } from '@/lib/seo'

export const metadata: Metadata = getPageMetadata({
  title: marketplaceReportEntry.title,
  description: marketplaceReportEntry.description,
  path: '/marketplace/report',
  type: 'website',
})

export default function MarketplaceReportRoute() {
  const Page = marketplaceReportEntry.Component
  return <Page />
}
