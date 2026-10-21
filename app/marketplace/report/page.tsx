import type { Metadata } from 'next'
import { marketplaceReportEntry } from '@/features/legal/registry'

export const metadata: Metadata = {
  title: marketplaceReportEntry.title,
  description: marketplaceReportEntry.description,
}

export default function MarketplaceReportRoute() {
  const Page = marketplaceReportEntry.Component
  return <Page />
}
