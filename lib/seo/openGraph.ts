import { getCanonicalUrl } from './canonical'
import { getSeoSiteUrl, SEO_DEFAULT_OG_IMAGE_PATH, SEO_SITE_NAME } from './config'
import type { SeoImage, SeoInput } from './types'

function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `${getSeoSiteUrl()}${path}`
}

export function resolveSeoImage(image?: SeoImage | null): SeoImage {
  if (image?.url) {
    return {
      ...image,
      url: toAbsoluteUrl(image.url),
    }
  }
  return {
    url: toAbsoluteUrl(SEO_DEFAULT_OG_IMAGE_PATH),
    alt: SEO_SITE_NAME,
    width: 1200,
    height: 630,
  }
}

export function pickMediaImage(urls: string[] | null | undefined, mediaType?: string | null): SeoImage | null {
  if (!urls?.length) return null
  const isVideoType = mediaType === 'video'
  const image = urls.find((url) => {
    const clean = url.split('?')[0].toLowerCase()
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(clean)
  })
  if (image) return { url: toAbsoluteUrl(image) }
  if (isVideoType) return null
  const first = urls[0]
  if (!first) return null
  const clean = first.split('?')[0].toLowerCase()
  if (/\.(mp4|webm|mov|m4v)$/i.test(clean)) return null
  return { url: toAbsoluteUrl(first) }
}

export function buildOpenGraph(input: SeoInput) {
  const canonical = getCanonicalUrl(input.path)
  const image = resolveSeoImage(input.image)
  const extraImages = (input.images ?? []).map((img) => ({
    url: toAbsoluteUrl(img.url),
    alt: img.alt,
    width: img.width,
    height: img.height,
  }))

  const ogType =
    input.type === 'article' || input.type === 'groupPost' || input.type === 'memory'
      ? 'article'
      : 'website'

  return {
    type: ogType,
    locale: 'en_US',
    siteName: SEO_SITE_NAME,
    title: input.title,
    description: input.description,
    url: canonical,
    images: [
      {
        url: image.url,
        alt: image.alt ?? input.title,
        width: image.width ?? 1200,
        height: image.height ?? 630,
      },
      ...extraImages,
    ],
    ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
    ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    ...(input.author?.name ? { authors: [input.author.name] } : {}),
    ...(input.section ? { section: input.section } : {}),
    ...(input.tags?.length ? { tags: input.tags } : {}),
    ...(input.video?.url
      ? {
          videos: [
            {
              url: toAbsoluteUrl(input.video.url),
            },
          ],
        }
      : {}),
  }
}

export function buildTwitterCard(input: SeoInput) {
  const image = resolveSeoImage(input.image)
  return {
    card: 'summary_large_image' as const,
    title: input.title,
    description: input.description,
    images: [image.url],
  }
}
