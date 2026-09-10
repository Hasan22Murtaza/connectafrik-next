import type { Metadata } from 'next'
import GroupDetailClient from './GroupDetailClient'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  generateJsonLd,
  getGroupMetadata,
  getGroupPostMetadata,
  getGroupPostSeoData,
  getGroupPostSeoInput,
  getGroupSeoData,
  getGroupSeoInput,
  getNoIndexMetadata,
  isIndexableGroup,
  isIndexableGroupPost,
} from '@/lib/seo'

export const revalidate = 300

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ post?: string }>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params
  const { post: postId } = await searchParams

  if (postId) {
    const groupPost = await getGroupPostSeoData(id, postId)
    if (groupPost && isIndexableGroupPost(groupPost)) {
      return getGroupPostMetadata(groupPost)
    }
  }

  const group = await getGroupSeoData(id)
  if (!group) return getNoIndexMetadata('Group')
  return getGroupMetadata(group)
}

export default async function GroupPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { post: postId } = await searchParams

  let jsonLd: Record<string, unknown>[] | null = null
  if (postId) {
    const groupPost = await getGroupPostSeoData(id, postId)
    if (groupPost && isIndexableGroupPost(groupPost)) {
      jsonLd = generateJsonLd(getGroupPostSeoInput(groupPost))
    }
  }
  if (!jsonLd) {
    const group = await getGroupSeoData(id)
    if (group && isIndexableGroup(group)) {
      jsonLd = generateJsonLd(getGroupSeoInput(group))
    }
  }

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <GroupDetailClient />
    </>
  )
}
