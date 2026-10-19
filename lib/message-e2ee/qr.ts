'use client'

type QrApi = {
  toString: typeof import('qrcode').toString
  toDataURL: typeof import('qrcode').toDataURL
}

async function loadQrApi(): Promise<QrApi> {
  const mod = (await import('qrcode')) as QrApi & { default?: QrApi }
  const api = mod.default ?? mod
  if (typeof api.toString !== 'function' && typeof api.toDataURL !== 'function') {
    throw new Error('QR library failed to load')
  }
  return api
}

/**
 * Build a local QR image (SVG data URL preferred; PNG canvas fallback).
 * Never sends the payload to a network QR service.
 */
export async function linkQrDataUrl(payload: string): Promise<string> {
  const value = payload.trim()
  if (!value) throw new Error('QR payload is empty')

  const api = await loadQrApi()

  try {
    const svg = await api.toString(value, {
      type: 'svg',
      margin: 1,
      width: 280,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    })
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  } catch {
    // Canvas path when SVG encoding is unavailable in the environment.
    return api.toDataURL(value, {
      margin: 1,
      width: 280,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    })
  }
}
