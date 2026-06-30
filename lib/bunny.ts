const REGION_HOSTS: Record<string, string> = {
  '': 'storage.bunnycdn.com',
  de: 'storage.bunnycdn.com',
  uk: 'uk.storage.bunnycdn.com',
  ny: 'ny.storage.bunnycdn.com',
  la: 'la.storage.bunnycdn.com',
  sg: 'sg.storage.bunnycdn.com',
  se: 'se.storage.bunnycdn.com',
  br: 'br.storage.bunnycdn.com',
  jh: 'jh.storage.bunnycdn.com',
  syd: 'syd.storage.bunnycdn.com',
}

interface BunnyConfig {
  storageZone: string
  accessKey: string
  storageHost: string
  cdnUrl: string
}

function getBunnyConfig(): BunnyConfig {
  const accessKey = process.env.BUNNY_STORAGE_ACCESS_KEY
  const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME
  const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
  const region = (process.env.BUNNY_STORAGE_REGION || '').toLowerCase().trim()

  const missing: string[] = []
  if (!accessKey) missing.push('BUNNY_STORAGE_ACCESS_KEY')
  if (!storageZone) missing.push('BUNNY_STORAGE_ZONE_NAME')
  if (!cdnUrl) missing.push('NEXT_PUBLIC_BUNNY_CDN_URL')

  if (missing.length > 0) {
    throw new Error(
      `Bunny.net storage is not configured. Missing env var(s): ${missing.join(', ')}. ` +
        'See docs/bunny-storage.md for setup instructions.'
    )
  }

  if (/storage\.bunnycdn\.com/i.test(cdnUrl!)) {
    throw new Error(
      'NEXT_PUBLIC_BUNNY_CDN_URL points at the Bunny Storage host ' +
        '(storage.bunnycdn.com), which is private and returns 401 for public ' +
        'reads. Set it to your Pull Zone CDN URL instead, e.g. ' +
        'https://<pull-zone>.b-cdn.net. See docs/bunny-storage.md.'
    )
  }

  const storageHost =
    process.env.BUNNY_STORAGE_HOST?.trim() ||
    REGION_HOSTS[region] ||
    REGION_HOSTS['']

  return {
    accessKey: accessKey!,
    storageZone: storageZone!,
    storageHost,
    cdnUrl: cdnUrl!.replace(/\/+$/, ''),
  }
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '')
}

function sanitizeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120)
}

export function buildStoragePath(
  folder: string,
  originalName: string,
  userId?: string
): string {
  const safeFolder = sanitizeSegment(folder || 'uploads').toLowerCase()
  const dot = originalName.lastIndexOf('.')
  const ext = dot !== -1 ? sanitizeSegment(originalName.slice(dot + 1)).toLowerCase() : ''
  const base = dot !== -1 ? originalName.slice(0, dot) : originalName
  const safeBase = sanitizeSegment(base) || 'file'

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const timestamp = now.getTime()
  const random = Math.random().toString(36).slice(2, 10)

  const fileName = ext
    ? `${timestamp}_${random}_${safeBase}.${ext}`
    : `${timestamp}_${random}_${safeBase}`

  const userSegment = userId ? `${sanitizeSegment(userId)}/` : ''
  return `${safeFolder}/${userSegment}${year}/${month}/${fileName}`
}

export function getBunnyCdnUrl(path: string): string {
  const { cdnUrl } = getBunnyConfig()
  return `${cdnUrl}/${normalizePath(path)}`
}

export function extractBunnyPath(urlOrPath: string): string | null {
  try {
    const trimmed = (urlOrPath || '').trim()
    if (!trimmed) return null

    if (!trimmed.startsWith('http')) {
      return normalizePath(trimmed)
    }

    const parsed = new URL(trimmed)
    return normalizePath(decodeURIComponent(parsed.pathname))
  } catch {
    return null
  }
}

export interface UploadToBunnyParams {
  body: ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array | Buffer | Blob
  path: string
  contentType?: string
}

export interface UploadToBunnyResult {
  url: string
  path: string
}

export async function uploadToBunny({
  body,
  path,
  contentType = 'application/octet-stream',
}: UploadToBunnyParams): Promise<UploadToBunnyResult> {
  const { accessKey, storageZone, storageHost } = getBunnyConfig()
  const storagePath = normalizePath(path)
  const endpoint = `https://${storageHost}/${storageZone}/${storagePath}`

  const isStream =
    typeof ReadableStream !== 'undefined' && body instanceof ReadableStream

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      AccessKey: accessKey,
      'Content-Type': contentType,
    },
    body: body as BodyInit,
    ...(isStream ? ({ duplex: 'half' } as Record<string, unknown>) : {}),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Bunny upload failed (${response.status} ${response.statusText})${
        detail ? `: ${detail}` : ''
      }`
    )
  }

  return { url: getBunnyCdnUrl(storagePath), path: storagePath }
}

export async function deleteFromBunny(urlOrPath: string): Promise<void> {
  const { accessKey, storageZone, storageHost } = getBunnyConfig()
  const storagePath = extractBunnyPath(urlOrPath)

  if (!storagePath) {
    throw new Error('Unable to determine Bunny storage path from the provided value')
  }

  const endpoint = `https://${storageHost}/${storageZone}/${storagePath}`

  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: { AccessKey: accessKey },
  })

  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Bunny delete failed (${response.status} ${response.statusText})${
        detail ? `: ${detail}` : ''
      }`
    )
  }
}
