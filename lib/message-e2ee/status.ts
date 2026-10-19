'use client'

import { apiClient } from '@/lib/api-client'

let cache: { enabled: boolean; at: number } | null = null

export async function messageE2eeActive(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (cache && Date.now() - cache.at < 30_000) return cache.enabled
  try {
    const data = await apiClient.get<{ enabled?: boolean }>('/api/message-e2ee/status')
    cache = { enabled: data?.enabled === true, at: Date.now() }
  } catch {
    cache = { enabled: false, at: Date.now() }
  }
  return cache.enabled
}
