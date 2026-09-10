import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  generateJsonLd,
  getMemoryMetadata,
  getMemorySeoData,
  getMemorySeoInput,
  getNoIndexMetadata,
  isIndexableMemory,
} from '@/lib/seo'
import MemoryDetailClient from './MemoryDetailClient'

export const revalidate = 300

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const memory = await getMemorySeoData(id)
  if (!memory || !isIndexableMemory(memory)) return getNoIndexMetadata('Memory')
  return getMemoryMetadata(memory)
}

export default async function MemoryPage({ params }: PageProps) {
  const { id } = await params
  const memory = await getMemorySeoData(id)
  if (!memory || !isIndexableMemory(memory)) notFound()

  const seo = getMemorySeoInput(memory)

  return (
    <>
      <JsonLd data={generateJsonLd(seo)} />
      <div className="sr-only">
        {seo.breadcrumbs && <Breadcrumbs items={seo.breadcrumbs} />}
        <h1>{memory.title || 'Memory'}</h1>
        {memory.description && <p>{memory.description}</p>}
        <video src={memory.video_url} poster={memory.thumbnail_url ?? undefined} />
      </div>
      <MemoryDetailClient reelId={id} />
    </>
  )
}
