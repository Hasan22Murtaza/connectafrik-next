import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLegalPage, legalPages } from '@/features/legal/registry'

type PageProps = {
  params: Promise<{ slug: string[] }>
}

export function generateStaticParams() {
  return Object.keys(legalPages).map((slug) => ({ slug: slug.split('/') }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = getLegalPage(slug.join('/'))
  if (!page) return {}
  return {
    title: page.title,
    description: page.description,
  }
}

export default async function LegalCatchAllPage({ params }: PageProps) {
  const { slug } = await params
  const page = getLegalPage(slug.join('/'))
  if (!page) notFound()
  const Page = page.Component
  return <Page />
}
