/**
 * Single source of truth for the public site URL used in canonicals, OG, sitemap, and robots.
 * Do not hardcode the production domain elsewhere.
 */
function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export const SEO_SITE_NAME = 'ConnectAfrik'
export const SEO_SITE_TAGLINE = 'African Community Platform'
export const SEO_DEFAULT_TITLE = `${SEO_SITE_NAME} - ${SEO_SITE_TAGLINE}`
export const SEO_DEFAULT_DESCRIPTION =
  'The premier platform for Africans worldwide to share political insights, celebrate cultural diversity, and build meaningful connections'

export const SEO_DEFAULT_OG_IMAGE_PATH = '/assets/images/hero.jpg'
export const SEO_LOGO_PATH = '/assets/icons/icon-192x192.png'

/** Google's max URLs per sitemap file. Chunk below this so we can add more files later. */
export const SITEMAP_CHUNK_SIZE = 10_000

export function getSeoSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000'
  return stripTrailingSlash(raw)
}

export function getSeoMetadataBase(): URL {
  return new URL(`${getSeoSiteUrl()}/`)
}
