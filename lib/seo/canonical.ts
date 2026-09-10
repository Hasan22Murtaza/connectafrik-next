import { getSeoSiteUrl } from './config'

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

/**
 * Build a production canonical URL.
 * - HTTPS is preserved when the configured site URL uses https
 * - Query strings and hashes are never included
 * - Duplicate `/path` vs `/path/` collapse to one form
 */
export function getCanonicalUrl(path: string): string {
  const site = getSeoSiteUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const withoutQuery = normalizedPath.split('?')[0].split('#')[0]
  const pathname = stripTrailingSlash(withoutQuery) || '/'
  return `${site}${pathname === '/' ? '/' : pathname}`
}

export const seoPaths = {
  home: () => '/',
  post: (id: string) => `/post/${id}`,
  group: (id: string) => `/groups/${id}`,
  groupPost: (groupId: string, postId: string) => `/groups/${groupId}/post/${postId}`,
  memory: (id: string) => `/memories/${id}`,
} as const
