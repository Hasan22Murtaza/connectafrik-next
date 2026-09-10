import type { Metadata } from 'next'
import { getCanonicalUrl } from './canonical'
import { SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_TITLE, SEO_SITE_NAME } from './config'
import { buildOpenGraph, buildTwitterCard, resolveSeoImage } from './openGraph'
import { indexFollowRobots, noIndexNoFollowRobots } from './robots-policy'
import type { SeoInput } from './types'

const TITLE_MAX = 70
const DESCRIPTION_MAX = 160

export function truncatePlainText(value: string | null | undefined, max = DESCRIPTION_MAX): string {
  const plain = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!plain) return ''
  if (plain.length <= max) return plain
  return `${plain.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export function displayName(author?: { full_name?: string | null; username?: string | null } | null): string {
  return author?.full_name?.trim() || author?.username?.trim() || 'ConnectAfrik member'
}

export function getNoIndexMetadata(title = SEO_SITE_NAME): Metadata {
  return {
    title,
    robots: noIndexNoFollowRobots,
  }
}

export function getPageMetadata(input: SeoInput): Metadata {
  const title = truncatePlainText(input.title, TITLE_MAX) || SEO_DEFAULT_TITLE
  const description = truncatePlainText(input.description) || SEO_DEFAULT_DESCRIPTION
  const canonical = getCanonicalUrl(input.path)
  const image = resolveSeoImage(input.image)
  const indexable = input.indexable !== false
  const resolved: SeoInput = { ...input, title, description, image }

  return {
    title,
    description,
    keywords: input.keywords?.length ? input.keywords : undefined,
    alternates: { canonical },
    robots: indexable ? indexFollowRobots : noIndexNoFollowRobots,
    authors: input.author?.name ? [{ name: input.author.name, url: input.author.url }] : undefined,
    openGraph: buildOpenGraph(resolved),
    twitter: buildTwitterCard(resolved),
    other: image.url
      ? {
          'og:image:alt': image.alt ?? title,
        }
      : undefined,
  }
}

export function getRootMetadata(): Metadata {
  return getPageMetadata({
    title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION,
    path: '/',
    type: 'website',
    indexable: true,
  })
}

export { SEO_SITE_NAME }
