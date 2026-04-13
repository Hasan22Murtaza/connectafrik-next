/**
 * Maps browser network hints to VideoSDK send quality / capture tier.
 *
 * Uses the Network Information API when available (Chrome/Edge/Android WebView).
 * Avoids VideoSDK getNetworkStats() here — that runs multi‑MB speed tests and is
 * too heavy for periodic tuning.
 */

export type SendQuality = 'low' | 'med' | 'high'

/** Outgoing video tier for useParticipant(...).setQuality(...) */
export function inferSendQualityFromNetwork(): SendQuality {
  if (typeof navigator === 'undefined') return 'med'

  const c =
    (navigator as Navigator & { connection?: NetworkInformation }).connection ||
    (navigator as unknown as { mozConnection?: NetworkInformation }).mozConnection ||
    (navigator as unknown as { webkitConnection?: NetworkInformation }).webkitConnection

  if (!c) return 'med'

  const eff = c.effectiveType
  const down = typeof c.downlink === 'number' ? c.downlink : undefined
  const rtt = typeof c.rtt === 'number' ? c.rtt : undefined

  if (eff === 'slow-2g' || eff === '2g') return 'low'
  if (rtt != null && rtt >= 500) return 'low'
  if (eff === '3g') {
    if (down != null && down >= 3 && rtt != null && rtt < 250) return 'med'
    return 'low'
  }
  if (down != null && down < 1.25) return 'low'
  if (down != null && down < 4) return 'med'
  if (rtt != null && rtt >= 250) return 'med'
  return 'high'
}

/** Initial MeetingProvider cap — SD saves CPU/bandwidth on weak links. */
export function inferMeetingMaxResolution(): 'hd' | 'sd' {
  const q = inferSendQualityFromNetwork()
  if (q === 'high') return 'hd'
  return 'sd'
}

interface NetworkInformation {
  effectiveType?: string
  downlink?: number
  rtt?: number
  addEventListener(type: 'change', listener: () => void): void
  removeEventListener(type: 'change', listener: () => void): void
}
