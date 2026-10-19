'use client'

/**
 * Client-side QR for device linking.
 * next.config aliases `qrcode` → `lib/browser.js` so Turbopack/webpack never
 * load the Node server/canvas entry (which fails in the browser).
 */

type QrApi = {
  toString: (text: string, options?: Record<string, unknown>) => Promise<string>
  toDataURL: (text: string, options?: Record<string, unknown>) => Promise<string>
}

function asQrApi(mod: unknown): QrApi | null {
  if (!mod || typeof mod !== 'object') return null
  const record = mod as Record<string, unknown>
  const nested = record.default
  const candidate = (
    nested && typeof nested === 'object' ? nested : record
  ) as Record<string, unknown>
  if (typeof candidate.toString === 'function' || typeof candidate.toDataURL === 'function') {
    return candidate as unknown as QrApi
  }
  return null
}

async function loadQrApi(): Promise<QrApi> {
  const mod = await import('qrcode')
  const api = asQrApi(mod)
  if (!api) throw new Error('QR library failed to load')
  return api
}

const QR_OPTS = {
  margin: 1,
  width: 280,
  errorCorrectionLevel: 'M' as const,
  color: { dark: '#111111', light: '#ffffff' },
}

/**
 * Build a local QR image (PNG data URL preferred; SVG data URL fallback).
 * Never sends the payload to a network QR service.
 */
export async function linkQrDataUrl(payload: string): Promise<string> {
  const value = payload.trim()
  if (!value) throw new Error('QR payload is empty')

  const api = await loadQrApi()

  // PNG via canvas — reliable in <img src>. Requires document (browser only).
  if (typeof api.toDataURL === 'function' && typeof document !== 'undefined') {
    try {
      const png = await api.toDataURL(value, QR_OPTS)
      if (typeof png === 'string' && png.startsWith('data:image/')) return png
    } catch (err) {
      console.warn('[message-e2ee/qr] toDataURL failed, trying SVG', {
        reason: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  if (typeof api.toString !== 'function') {
    throw new Error('QR library has no renderer')
  }

  const svg = await api.toString(value, { ...QR_OPTS, type: 'svg' })
  if (typeof svg !== 'string' || !svg.includes('<svg')) {
    throw new Error('QR SVG render failed')
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
