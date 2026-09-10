import { seoPaths } from './canonical'
import { getPageMetadata, displayName, truncatePlainText } from './metadata'
import { pickMediaImage } from './openGraph'
import {
  isIndexableGroup,
  isIndexableGroupPost,
  isIndexableMemory,
  isPublicPostVisibility,
} from './robots-policy'
import type {
  PublicGroupPostSeo,
  PublicGroupSeo,
  PublicMemorySeo,
  PublicPostSeo,
  SeoInput,
} from './types'
import type { Metadata } from 'next'

function authorPath(username: string | null | undefined): string | undefined {
  if (!username) return undefined
  return `/user/${username}`
}

export function getPostMetadata(post: PublicPostSeo): Metadata {
  const authorName = displayName(post.author)
  const snippet = truncatePlainText(post.content) || `A post by ${authorName} on ConnectAfrik`
  const title = snippet.length > 55 ? `${snippet.slice(0, 52).trimEnd()}…` : snippet
  const indexable = isPublicPostVisibility(post.author?.post_visibility)
  const image = pickMediaImage(post.media_urls, post.media_type)
  const tags = (post.tags ?? []).filter(Boolean)
  const input: SeoInput = {
    title: `${title} | ${authorName}`,
    description: snippet,
    path: seoPaths.post(post.id),
    type: 'article',
    indexable,
    keywords: [...tags, post.category].filter(Boolean) as string[],
    image,
    author: {
      name: authorName,
      url: authorPath(post.author?.username),
      image: post.author?.avatar_url,
    },
    publishedTime: post.created_at,
    modifiedTime: post.updated_at || post.created_at,
    section: post.category || 'general',
    tags,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Post', path: seoPaths.post(post.id) },
    ],
    video:
      post.media_type === 'video' && post.media_urls?.[0]
        ? { url: post.media_urls[0] }
        : undefined,
  }
  return getPageMetadata(input)
}

export function getGroupMetadata(group: PublicGroupSeo): Metadata {
  const indexable = isIndexableGroup(group)
  const description =
    truncatePlainText(group.description) ||
    `${group.name} is a ${group.is_public ? 'public' : 'private'} ConnectAfrik group${group.category ? ` about ${group.category}` : ''}.`
  const image = group.banner_url
    ? { url: group.banner_url, alt: group.name }
    : group.avatar_url
      ? { url: group.avatar_url, alt: group.name }
      : null
  return getPageMetadata({
    title: group.name,
    description,
    path: seoPaths.group(group.id),
    type: 'group',
    indexable,
    keywords: [...(group.tags ?? []), group.category, group.location].filter(Boolean) as string[],
    image,
    publishedTime: group.created_at,
    modifiedTime: group.updated_at || group.created_at,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: group.name, path: seoPaths.group(group.id) },
    ],
  })
}

export function getGroupPostMetadata(post: PublicGroupPostSeo): Metadata {
  const indexable = isIndexableGroupPost(post)
  const authorName = displayName(post.author)
  const headline = truncatePlainText(post.title, 70) || truncatePlainText(post.content, 70) || 'Group post'
  const description =
    truncatePlainText(post.content) ||
    `${headline} in ${post.group.name} on ConnectAfrik`
  return getPageMetadata({
    title: `${headline} | ${post.group.name}`,
    description,
    path: seoPaths.groupPost(post.group_id, post.id),
    type: 'groupPost',
    indexable,
    keywords: [post.group.category, post.post_type].filter(Boolean) as string[],
    image: pickMediaImage(post.media_urls) ?? (post.group.banner_url ? { url: post.group.banner_url } : null),
    author: {
      name: authorName,
      url: authorPath(post.author?.username),
    },
    publishedTime: post.created_at,
    modifiedTime: post.updated_at || post.created_at,
    section: post.group.name,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: post.group.name, path: seoPaths.group(post.group_id) },
      { name: headline, path: seoPaths.groupPost(post.group_id, post.id) },
    ],
  })
}

export function getMemoryMetadata(memory: PublicMemorySeo): Metadata {
  const indexable = isIndexableMemory(memory)
  const authorName = displayName(memory.author)
  const title = truncatePlainText(memory.title, 70) || `Memory by ${authorName}`
  const description =
    truncatePlainText(memory.description) ||
    `${title} — a ConnectAfrik memory by ${authorName}`
  return getPageMetadata({
    title,
    description,
    path: seoPaths.memory(memory.id),
    type: 'memory',
    indexable,
    keywords: [...(memory.tags ?? []), memory.category].filter(Boolean) as string[],
    image: memory.thumbnail_url ? { url: memory.thumbnail_url, alt: title } : null,
    author: {
      name: authorName,
      url: authorPath(memory.author?.username),
    },
    publishedTime: memory.created_at,
    modifiedTime: memory.updated_at || memory.created_at,
    section: memory.category || undefined,
    tags: memory.tags ?? undefined,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: title, path: seoPaths.memory(memory.id) },
    ],
    video: memory.video_url
      ? {
          url: memory.video_url,
          durationSeconds: memory.duration ?? undefined,
          thumbnailUrl: memory.thumbnail_url ?? undefined,
        }
      : undefined,
  })
}

export function getPostSeoInput(post: PublicPostSeo): SeoInput {
  const meta = getPostMetadata(post)
  return {
    title: String(meta.title ?? ''),
    description: String(meta.description ?? ''),
    path: seoPaths.post(post.id),
    type: 'article',
    indexable: isPublicPostVisibility(post.author?.post_visibility),
    image: pickMediaImage(post.media_urls, post.media_type),
    author: { name: displayName(post.author), url: authorPath(post.author?.username) },
    publishedTime: post.created_at,
    modifiedTime: post.updated_at || post.created_at,
    section: post.category || 'general',
    tags: (post.tags ?? []).filter(Boolean),
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Post', path: seoPaths.post(post.id) },
    ],
    video:
      post.media_type === 'video' && post.media_urls?.[0]
        ? { url: post.media_urls[0] }
        : undefined,
  }
}

export function getGroupSeoInput(group: PublicGroupSeo): SeoInput {
  return {
    title: group.name,
    description: truncatePlainText(group.description) || group.name,
    path: seoPaths.group(group.id),
    type: 'group',
    indexable: isIndexableGroup(group),
    image: group.banner_url
      ? { url: group.banner_url }
      : group.avatar_url
        ? { url: group.avatar_url }
        : null,
    publishedTime: group.created_at,
    modifiedTime: group.updated_at || group.created_at,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: group.name, path: seoPaths.group(group.id) },
    ],
  }
}

export function getGroupPostSeoInput(post: PublicGroupPostSeo): SeoInput {
  const headline = truncatePlainText(post.title, 70) || truncatePlainText(post.content, 70) || 'Group post'
  return {
    title: `${headline} | ${post.group.name}`,
    description: truncatePlainText(post.content) || headline,
    path: seoPaths.groupPost(post.group_id, post.id),
    type: 'groupPost',
    indexable: isIndexableGroupPost(post),
    image: pickMediaImage(post.media_urls) ?? (post.group.banner_url ? { url: post.group.banner_url } : null),
    author: { name: displayName(post.author), url: authorPath(post.author?.username) },
    publishedTime: post.created_at,
    modifiedTime: post.updated_at || post.created_at,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: post.group.name, path: seoPaths.group(post.group_id) },
      { name: headline, path: seoPaths.groupPost(post.group_id, post.id) },
    ],
  }
}

export function getMemorySeoInput(memory: PublicMemorySeo): SeoInput {
  const title = truncatePlainText(memory.title, 70) || `Memory by ${displayName(memory.author)}`
  return {
    title,
    description: truncatePlainText(memory.description) || title,
    path: seoPaths.memory(memory.id),
    type: 'memory',
    indexable: isIndexableMemory(memory),
    image: memory.thumbnail_url ? { url: memory.thumbnail_url, alt: title } : null,
    author: { name: displayName(memory.author), url: authorPath(memory.author?.username) },
    publishedTime: memory.created_at,
    modifiedTime: memory.updated_at || memory.created_at,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: title, path: seoPaths.memory(memory.id) },
    ],
    video: memory.video_url
      ? {
          url: memory.video_url,
          durationSeconds: memory.duration ?? undefined,
          thumbnailUrl: memory.thumbnail_url ?? undefined,
        }
      : undefined,
  }
}

