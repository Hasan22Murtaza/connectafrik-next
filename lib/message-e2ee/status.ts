'use client'

import { apiClient } from '@/lib/api-client'

type StatusCache = { enabled: boolean; ready: boolean; at: number }

let cache: StatusCache | null = null

export type MessageE2eeClientStatus = {
  /** MESSAGE_E2EE rollout flag for this account */
  enabled: boolean
  /** Crypto tables reachable (migrations applied) */
  ready: boolean
}

export async function messageE2eeStatus(): Promise<MessageE2eeClientStatus> {
  if (typeof window === 'undefined') return { enabled: false, ready: false }
  if (cache && Date.now() - cache.at < 30_000) {
    return { enabled: cache.enabled, ready: cache.ready }
  }
  try {
    const data = await apiClient.get<{ enabled?: boolean; ready?: boolean }>('/api/message-e2ee/status')
    const enabled = data?.enabled === true
    // Backward compatible: older servers returned only `enabled` meaning ready+flag.
    const ready = typeof data?.ready === 'boolean' ? data.ready : enabled
    cache = { enabled, ready, at: Date.now() }
  } catch (err) {
    console.warn('[message-e2ee/status] status request failed', {
      reason: err instanceof Error ? err.message : 'unknown',
    })
    // Keep prior cache so a blip does not blank the Link a device UI.
    if (cache) return { enabled: cache.enabled, ready: cache.ready }
    cache = { enabled: false, ready: false, at: Date.now() }
  }
  return { enabled: cache.enabled, ready: cache.ready }
}

/**
 * True when this account should use Signal encrypt/decrypt paths.
 * Requires both the rollout flag and reachable crypto storage.
 */
export async function messageE2eeActive(): Promise<boolean> {
  const status = await messageE2eeStatus()
  return status.enabled && status.ready
}

/** True when MESSAGE_E2EE is on — use for Link a device UI even if storage is not ready yet. */
export async function messageE2eeFlagOn(): Promise<boolean> {
  const status = await messageE2eeStatus()
  return status.enabled
}

export function clearMessageE2eeStatusCache() {
  cache = null
}
