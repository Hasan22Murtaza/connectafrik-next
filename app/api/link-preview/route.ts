import { NextRequest } from 'next/server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser } from '@/lib/supabase-server'

const PREVIEW_TIMEOUT_MS = 6_000
const MAX_HTML_BYTES = 512_000

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number)
    if (parts[0] === 10) return true
    if (parts[0] === 127) return true
    if (parts[0] === 0) return true
    if (parts[0] === 169 && parts[1] === 254) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 192 && parts[1] === 168) return true
  }
  return false
}

function pickMeta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const propRe = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    )
    const propReAlt = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      'i'
    )
    const match = html.match(propRe) || html.match(propReAlt)
    if (match?.[1]) return decodeHtmlEntities(match[1].trim())
  }
  return null
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function absoluteUrl(base: string, maybeRelative: string | null): string | null {
  if (!maybeRelative) return null
  try {
    return new URL(maybeRelative, base).toString()
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)

    const rawUrl = request.nextUrl.searchParams.get('url')?.trim()
    if (!rawUrl) return errorResponse('Missing url', 400)

    let parsed: URL
    try {
      parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
    } catch {
      return errorResponse('Invalid url', 400)
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return errorResponse('Only http(s) urls are allowed', 400)
    }
    if (isPrivateHostname(parsed.hostname)) {
      return errorResponse('URL not allowed', 400)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS)

    let html = ''
    try {
      const res = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'CribsTalkLinkPreview/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
      if (!res.ok) {
        return jsonResponse({
          url: parsed.toString(),
          title: null,
          description: null,
          image: null,
          siteName: parsed.hostname.replace(/^www\./i, ''),
          type: null,
        })
      }
      const buf = await res.arrayBuffer()
      const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf
      html = new TextDecoder('utf-8').decode(slice)
    } finally {
      clearTimeout(timer)
    }

    const title =
      pickMeta(html, ['og:title', 'twitter:title']) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      null
    const description = pickMeta(html, ['og:description', 'twitter:description', 'description'])
    const image = absoluteUrl(
      parsed.toString(),
      pickMeta(html, ['og:image', 'twitter:image', 'twitter:image:src'])
    )
    const siteName =
      pickMeta(html, ['og:site_name']) || parsed.hostname.replace(/^www\./i, '')
    const type = pickMeta(html, ['og:type'])

    return jsonResponse({
      url: parsed.toString(),
      title: title ? decodeHtmlEntities(title) : null,
      description,
      image,
      siteName,
      type,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return jsonResponse({
      url: request.nextUrl.searchParams.get('url'),
      title: null,
      description: null,
      image: null,
      siteName: null,
      type: null,
    })
  }
}
