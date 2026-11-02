import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  generateJsonLd,
  getReelMetadata,
  getReelSeoData,
  getReelSeoInput,
  getNoIndexMetadata,
  isIndexableReel,
} from '@/lib/seo'
import ReelDetailClient from './ReelDetailClient'

export const revalidate = 300

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const reel = await getReelSeoData(id)
  if (!reel || !isIndexableReel(reel)) return getNoIndexMetadata('Reel')
  return getReelMetadata(reel)
}

export default async function ReelPage({ params }: PageProps) {
  const { id } = await params
  const reel = await getReelSeoData(id)
  if (!reel || !isIndexableReel(reel)) notFound()

  const seo = getReelSeoInput(reel)

  return (
    <>
      <JsonLd data={generateJsonLd(seo)} />
      <div className="sr-only">
        {seo.breadcrumbs && <Breadcrumbs items={seo.breadcrumbs} />}
        <h1>{reel.title || 'Reel'}</h1>
        {reel.description && <p>{reel.description}</p>}
        <video src={reel.video_url} poster={reel.thumbnail_url ?? undefined} />
      </div>
      <ReelDetailClient reelId={id} />
    </>
  )
}
