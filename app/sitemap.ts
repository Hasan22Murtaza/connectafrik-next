import type { MetadataRoute } from 'next'
import { getCanonicalUrl, seoPaths } from '@/lib/seo/canonical'
import { SITEMAP_CHUNK_SIZE } from '@/lib/seo/config'
import {
  countPublicGroupPosts,
  countPublicGroups,
  countPublicMemories,
  countPublicPosts,
  listPublicGroupPostsForSitemap,
  listPublicGroupsForSitemap,
  listPublicMemoriesForSitemap,
  listPublicPostsForSitemap,
} from '@/lib/seo/queries'

type SitemapId = string

function chunkCount(total: number): number {
  if (total <= 0) return 0
  return Math.ceil(total / SITEMAP_CHUNK_SIZE)
}

function parseId(id: SitemapId): { kind: string; page: number } {
  if (id === 'static') return { kind: 'static', page: 0 }
  const [kind, pageRaw] = id.split('-')
  const page = Number.parseInt(pageRaw ?? '0', 10)
  return { kind: kind || 'static', page: Number.isNaN(page) ? 0 : page }
}

function staticEntries(): MetadataRoute.Sitemap {
  return [
    {
      url: getCanonicalUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}

export async function generateSitemaps(): Promise<{ id: SitemapId }[]> {
  try {
    const [posts, groups, groupPosts, memories] = await Promise.all([
      countPublicPosts(),
      countPublicGroups(),
      countPublicGroupPosts(),
      countPublicMemories(),
    ])

    const ids: { id: SitemapId }[] = [{ id: 'static' }]
    for (let i = 0; i < chunkCount(posts); i += 1) ids.push({ id: `posts-${i}` })
    for (let i = 0; i < chunkCount(groups); i += 1) ids.push({ id: `groups-${i}` })
    for (let i = 0; i < chunkCount(groupPosts); i += 1) ids.push({ id: `groupposts-${i}` })
    for (let i = 0; i < chunkCount(memories); i += 1) ids.push({ id: `memories-${i}` })
    return ids
  } catch (error) {
    console.error('Failed to enumerate sitemaps:', error)
    return [{ id: 'static' }]
  }
}

export default async function sitemap({
  id,
}: {
  id: SitemapId
}): Promise<MetadataRoute.Sitemap> {
  const { kind, page } = parseId(String(id))
  const offset = page * SITEMAP_CHUNK_SIZE

  try {
    if (kind === 'static') return staticEntries()

    if (kind === 'posts') {
      const rows = await listPublicPostsForSitemap(offset, SITEMAP_CHUNK_SIZE)
      return rows.map((row) => ({
        url: getCanonicalUrl(seoPaths.post(row.id)),
        lastModified: new Date(row.updated_at || row.created_at),
        changeFrequency: 'weekly',
        priority: 0.8,
      }))
    }

    if (kind === 'groups') {
      const rows = await listPublicGroupsForSitemap(offset, SITEMAP_CHUNK_SIZE)
      return rows.map((row) => ({
        url: getCanonicalUrl(seoPaths.group(row.id)),
        lastModified: new Date(row.updated_at || row.created_at),
        changeFrequency: 'weekly',
        priority: 0.7,
      }))
    }

    if (kind === 'groupposts') {
      const rows = await listPublicGroupPostsForSitemap(offset, SITEMAP_CHUNK_SIZE)
      return rows.map((row) => ({
        url: getCanonicalUrl(seoPaths.groupPost(row.group_id, row.id)),
        lastModified: new Date(row.updated_at || row.created_at),
        changeFrequency: 'weekly',
        priority: 0.6,
      }))
    }

    if (kind === 'memories') {
      const rows = await listPublicMemoriesForSitemap(offset, SITEMAP_CHUNK_SIZE)
      return rows.map((row) => ({
        url: getCanonicalUrl(seoPaths.memory(row.id)),
        lastModified: new Date(row.updated_at || row.created_at),
        changeFrequency: 'weekly',
        priority: 0.7,
      }))
    }
  } catch (error) {
    console.error(`Failed to build sitemap chunk ${id}:`, error)
  }

  return kind === 'static' ? staticEntries() : []
}
