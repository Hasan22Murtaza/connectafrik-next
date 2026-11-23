const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi

export type StoryLinkInfo = {
  url: string
  domain: string
  residualText: string
}

export function normalizeStoryUrl(raw: string): string {
  const trimmed = raw.replace(/[),.;!?]+$/g, '')
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
}

export function getUrlDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    return host || 'link'
  } catch {
    return 'link'
  }
}

export function extractStoryLink(text: string | null | undefined): StoryLinkInfo | null {
  if (!text?.trim()) return null
  const match = text.match(URL_RE)
  if (!match?.[0]) return null
  const url = normalizeStoryUrl(match[0])
  const residualText = text
    .replace(URL_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    url,
    domain: getUrlDomain(url),
    residualText,
  }
}

export function inferLinkLabel(url: string, ogType?: string | null): string {
  const type = (ogType || '').toLowerCase()
  if (type.includes('article') || type.includes('blog')) return 'ARTICLE'
  try {
    const path = new URL(url).pathname.toLowerCase()
    if (/\/(article|articles|blog|post|posts|news|story)\b/.test(path)) return 'ARTICLE'
  } catch {
    /* ignore */
  }
  return 'LINK'
}

export type LinkPreviewData = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  type: string | null
}

/** Relative luminance 0–1; higher = lighter. */
export function getColorLuminance(color: string | null | undefined): number {
  if (!color) return 0
  const raw = color.trim()
  let r = 0
  let g = 0
  let b = 0

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1]
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16)
      g = parseInt(h[1] + h[1], 16)
      b = parseInt(h[2] + h[2], 16)
    } else {
      r = parseInt(h.slice(0, 2), 16)
      g = parseInt(h.slice(2, 4), 16)
      b = parseInt(h.slice(4, 6), 16)
    }
  } else {
    const rgb = raw.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
    if (!rgb) return 0
    r = Number(rgb[1])
    g = Number(rgb[2])
    b = Number(rgb[3])
  }

  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export function isLightStoryBackground(color: string | null | undefined): boolean {
  return getColorLuminance(color) > 0.62
}
