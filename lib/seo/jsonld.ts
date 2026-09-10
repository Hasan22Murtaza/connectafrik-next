import { getCanonicalUrl } from './canonical'
import { getSeoSiteUrl, SEO_DEFAULT_DESCRIPTION, SEO_LOGO_PATH, SEO_SITE_NAME } from './config'
import type { BreadcrumbItem, SeoInput } from './types'

function absolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `${getSeoSiteUrl()}${path}`
}

function isoDuration(seconds?: number | null): string | undefined {
  if (!seconds || seconds <= 0) return undefined
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rem = s % 60
  let out = 'PT'
  if (h) out += `${h}H`
  if (m) out += `${m}M`
  if (rem || (!h && !m)) out += `${rem}S`
  return out
}

export function websiteJsonLd() {
  const site = getSeoSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SEO_SITE_NAME,
    url: site,
    description: SEO_DEFAULT_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: SEO_SITE_NAME,
      url: site,
      logo: absolute(SEO_LOGO_PATH),
    },
  }
}

export function organizationJsonLd() {
  const site = getSeoSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SEO_SITE_NAME,
    url: site,
    logo: absolute(SEO_LOGO_PATH),
    description: SEO_DEFAULT_DESCRIPTION,
  }
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.path),
    })),
  }
}

export function generateJsonLd(input: SeoInput): Record<string, unknown>[] {
  const canonical = getCanonicalUrl(input.path)
  const nodes: Record<string, unknown>[] = []

  if (input.breadcrumbs?.length) {
    nodes.push(breadcrumbJsonLd(input.breadcrumbs))
  }

  if (input.type === 'article' || input.type === 'groupPost') {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: input.title,
      description: input.description,
      mainEntityOfPage: canonical,
      url: canonical,
      datePublished: input.publishedTime,
      dateModified: input.modifiedTime || input.publishedTime,
      ...(input.image?.url ? { image: [absolute(input.image.url)] } : {}),
      ...(input.author?.name
        ? {
            author: {
              '@type': 'Person',
              name: input.author.name,
              ...(input.author.url ? { url: getCanonicalUrl(input.author.url) } : {}),
            },
          }
        : {}),
      publisher: {
        '@type': 'Organization',
        name: SEO_SITE_NAME,
        logo: {
          '@type': 'ImageObject',
          url: absolute(SEO_LOGO_PATH),
        },
      },
      ...(input.section ? { articleSection: input.section } : {}),
      ...(input.keywords?.length ? { keywords: input.keywords.join(', ') } : {}),
    })
  }

  if (input.type === 'group') {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: input.title,
      description: input.description,
      url: canonical,
      ...(input.image?.url ? { image: absolute(input.image.url) } : {}),
    })
  }

  if (input.type === 'memory' || input.video?.url) {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: input.title,
      description: input.description,
      thumbnailUrl: input.video?.thumbnailUrl
        ? absolute(input.video.thumbnailUrl)
        : input.image?.url
          ? absolute(input.image.url)
          : undefined,
      contentUrl: input.video?.url ? absolute(input.video.url) : undefined,
      uploadDate: input.publishedTime,
      ...(isoDuration(input.video?.durationSeconds)
        ? { duration: isoDuration(input.video?.durationSeconds) }
        : {}),
    })
  }

  return nodes
}
