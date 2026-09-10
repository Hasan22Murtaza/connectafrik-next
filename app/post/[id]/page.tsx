import type { Metadata } from 'next'
import PostDetailClient from './PostDetailClient'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  generateJsonLd,
  getNoIndexMetadata,
  getPostMetadata,
  getPostSeoData,
  getPostSeoInput,
  isPublicPostVisibility,
} from '@/lib/seo'

export const revalidate = 300

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const post = await getPostSeoData(id)
  if (!post) return getNoIndexMetadata('Post')
  return getPostMetadata(post)
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params
  const post = await getPostSeoData(id)
  const jsonLd =
    post && isPublicPostVisibility(post.author?.post_visibility)
      ? generateJsonLd(getPostSeoInput(post))
      : null

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <PostDetailClient />
    </>
  )
}
