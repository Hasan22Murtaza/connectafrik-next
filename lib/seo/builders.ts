import { seoPaths } from './canonical'
import { getPageMetadata, displayName, truncatePlainText } from './metadata'
import { pickMediaImage } from './openGraph'
import {
  isIndexableGroup,
  isIndexableGroupPost,
  isIndexableReel,
  isPublicPostVisibility,
} from './robots-policy'
import type {
  PublicGroupPostSeo,
  PublicGroupSeo,
  PublicReelSeo,
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
  const snippet = truncatePlainText(post.content) || `A post by ${authorName} on CribsTalk`
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
    `${group.name} is a ${group.is_public ? 'public' : 'private'} CribsTalk group${group.category ? ` about ${group.category}` : ''}.`
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
    `${headline} in ${post.group.name} on CribsTalk`
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

export function getReelMetadata(reel: PublicReelSeo): Metadata {
  const indexable = isIndexableReel(reel)
  const authorName = displayName(reel.author)
  const title = truncatePlainText(reel.title, 70) || `Reel by ${authorName}`
  const description =
    truncatePlainText(reel.description) ||
    `${title} — a CribsTalk reel by ${authorName}`
  return getPageMetadata({
    title,
    description,
    path: seoPaths.reel(reel.id),
    type: 'reel',
    indexable,
    keywords: [...(reel.tags ?? []), reel.category].filter(Boolean) as string[],
    image: reel.thumbnail_url ? { url: reel.thumbnail_url, alt: title } : null,
    author: {
      name: authorName,
      url: authorPath(reel.author?.username),
    },
    publishedTime: reel.created_at,
    modifiedTime: reel.updated_at || reel.created_at,
    section: reel.category || undefined,
    tags: reel.tags ?? undefined,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: title, path: seoPaths.reel(reel.id) },
    ],
    video: reel.video_url
      ? {
          url: reel.video_url,
          durationSeconds: reel.duration ?? undefined,
          thumbnailUrl: reel.thumbnail_url ?? undefined,
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

export function getReelSeoInput(reel: PublicReelSeo): SeoInput {
  const title = truncatePlainText(reel.title, 70) || `Reel by ${displayName(reel.author)}`
  return {
    title,
    description: truncatePlainText(reel.description) || title,
    path: seoPaths.reel(reel.id),
    type: 'reel',
    indexable: isIndexableReel(reel),
    image: reel.thumbnail_url ? { url: reel.thumbnail_url, alt: title } : null,
    author: { name: displayName(reel.author), url: authorPath(reel.author?.username) },
    publishedTime: reel.created_at,
    modifiedTime: reel.updated_at || reel.created_at,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: title, path: seoPaths.reel(reel.id) },
    ],
    video: reel.video_url
      ? {
          url: reel.video_url,
          durationSeconds: reel.duration ?? undefined,
          thumbnailUrl: reel.thumbnail_url ?? undefined,
        }
      : undefined,
  }
}

