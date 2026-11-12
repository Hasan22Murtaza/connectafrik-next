import { extractBunnyPath, normalizePath } from '@/lib/bunny'

/**
 * Storage paths are built as `{folder}/{userId}/...` via buildStoragePath.
 * Deletes must only target objects under the authenticated user's segment.
 */
export function isOwnedBunnyPath(urlOrPath: string, userId: string): boolean {
  if (!userId || typeof userId !== 'string') return false
  const path = extractBunnyPath(urlOrPath)
  if (!path) return false

  const normalized = normalizePath(path)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length < 2) return false

  // `{folder}/{userId}/...`
  return segments[1] === userId
}
