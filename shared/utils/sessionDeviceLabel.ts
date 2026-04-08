/** Human-readable label from a session User-Agent (browser + OS). */
export function deviceLabelFromUserAgent(ua: string | null | undefined): string {
  if (!ua || !ua.trim()) return 'Unknown device'

  const raw = ua.trim()
  const l = raw.toLowerCase()

  let browser = 'Web browser'
  if (l.includes('edg/') || l.includes('edgios/') || l.includes('edga/')) browser = 'Edge'
  else if (l.includes('opr/') || l.includes('opios/') || l.includes('opera')) browser = 'Opera'
  else if (l.includes('crios/')) browser = 'Chrome'
  else if (l.includes('fxios/')) browser = 'Firefox'
  else if (l.includes('samsungbrowser/')) browser = 'Samsung Internet'
  else if (l.includes('chrome/') || l.includes('chromium/')) browser = 'Chrome'
  else if (l.includes('firefox/')) browser = 'Firefox'
  else if (l.includes('rv:11') || l.includes('rv:12') || l.includes('trident/') || l.includes('msie'))
    browser = 'Internet Explorer'
  else if (l.includes('safari/') && !l.includes('chrome/') && !l.includes('chromium/')) browser = 'Safari'

  let os = ''
  if (l.includes('iphone')) os = 'iPhone'
  else if (l.includes('ipad')) os = 'iPad'
  else if (l.includes('ipod')) os = 'iPod'
  else if (l.includes('android')) os = 'Android'
  else if (/\bcros\b/.test(l) || l.includes('chrome os')) os = 'Chrome OS'
  else if (
    l.includes('windows nt') ||
    l.includes('win64') ||
    l.includes('win32') ||
    l.includes('wow64') ||
    (/\bwindows\b/.test(l) && !l.includes('windows phone'))
  )
    os = 'Windows'
  else if (l.includes('mac os x') || l.includes('macintosh')) os = 'macOS'
  else if (l.includes('linux') || l.includes('x11') || l.includes('ubuntu') || l.includes('fedora'))
    os = 'Linux'

  if (!os) {
    const paren = raw.match(/\(([^)]+)\)/)
    if (paren?.[1]) {
      const first = paren[1].split(';')[0]?.trim() ?? ''
      const firstL = first.toLowerCase()
      if (firstL.includes('windows')) os = 'Windows'
      else if (firstL.includes('android')) os = 'Android'
      else if (firstL.includes('iphone')) os = 'iPhone'
      else if (firstL.includes('ipad')) os = 'iPad'
      else if (firstL.includes('linux') || firstL.includes('x11')) os = 'Linux'
      else if (firstL.includes('mac')) os = 'macOS'
      else if (first.length > 0 && first.length <= 56) os = first
    }
  }

  if (!os) {
    if (l.includes('node') || l.includes('undici') || l.includes('axios') || l.includes('got/'))
      os = 'Server / API client'
  }

  if (!os) os = 'Unknown platform'

  return `${browser} · ${os}`
}

/**
 * Builds a label in the browser using the real User-Agent (auth.sessions.user_agent is often not this).
 */
export function buildClientSessionDeviceLabel(): string {
  if (typeof navigator === 'undefined') return ''

  const ua = navigator.userAgent || ''
  const platform = (navigator.platform || '').trim()

  let label = deviceLabelFromUserAgent(ua)

  if (label.includes('Unknown platform') && platform && platform.toLowerCase() !== 'unknown') {
    label = label.replace('Unknown platform', platform)
  }

  if (label.startsWith('Web browser ·')) {
    const lower = ua.toLowerCase()
    if (lower.includes('edg/')) label = label.replace('Web browser', 'Edge')
    else if (lower.includes('opr/') || lower.includes('opera')) label = label.replace('Web browser', 'Opera')
    else if (lower.includes('chrome/') || lower.includes('chromium/')) label = label.replace('Web browser', 'Chrome')
    else if (lower.includes('firefox/')) label = label.replace('Web browser', 'Firefox')
    else if (lower.includes('safari/') && !lower.includes('chrome')) label = label.replace('Web browser', 'Safari')
  }

  if (label.includes('Unknown platform') && platform && platform.toLowerCase() !== 'unknown') {
    label = label.replace('Unknown platform', platform)
  }

  return label
}

/** Uses User-Agent Client Hints when available (Chromium) to refine a generic label. */
export async function buildClientSessionDeviceLabelAsync(): Promise<string> {
  const base = buildClientSessionDeviceLabel()
  if (typeof navigator === 'undefined') return base
  if (!base.includes('Unknown platform') && !base.startsWith('Web browser · Unknown')) return base

  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: { brand: string; version: string }[]
      platform?: string
      getHighEntropyValues?: (keys: string[]) => Promise<Record<string, unknown>>
    }
  }

  const ud = nav.userAgentData
  if (!ud?.getHighEntropyValues || !ud.platform) return base

  try {
    await ud.getHighEntropyValues(['platformVersion'])
    const major = ud.brands?.find((b) => !['Not A;Brand', 'Chromium'].includes(b.brand))?.brand
    const plat = ud.platform
    if (major && plat) return `${major} · ${plat}`
  } catch {
    return base
  }

  return base
}

export function getSessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken || typeof atob !== 'function') return null
  try {
    const parts = accessToken.split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const payload = JSON.parse(atob(b64 + pad)) as { session_id?: string }
    return typeof payload.session_id === 'string' ? payload.session_id : null
  } catch {
    return null
  }
}
