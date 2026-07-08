'use client'

import { useCallback, useEffect, useRef } from 'react'
import { apiClient } from '@/lib/api-client'

/** Send every 20–30s; 25s balances traffic vs 90s server timeout (3 missed beats). */
const HEARTBEAT_INTERVAL_MS = 25_000

export type UseCallHeartbeatOptions = {
  threadId?: string
  callId?: string
  /** When true, pings the server while the call is in progress. */
  enabled: boolean
  intervalMs?: number
}

/**
 * Keeps `call_sessions.last_heartbeat_at` fresh while a call is active.
 * Stops automatically when `enabled` becomes false (call ended / modal closed).
 */
export function useCallHeartbeat({
  threadId,
  callId,
  enabled,
  intervalMs = HEARTBEAT_INTERVAL_MS,
}: UseCallHeartbeatOptions) {
  const inFlightRef = useRef(false)

  const sendHeartbeat = useCallback(async () => {
    const tid = threadId?.trim()
    const cid = callId?.trim()
    if (!tid || !cid || inFlightRef.current) return
    inFlightRef.current = true
    try {
      await apiClient.patch(`/api/chat/threads/${tid}/call-sessions`, {
        call_id: cid,
        event: 'heartbeat',
      })
    } catch {
      // Non-fatal: next interval or visibility/online resync will retry.
    } finally {
      inFlightRef.current = false
    }
  }, [threadId, callId])

  useEffect(() => {
    if (!enabled || !threadId?.trim() || !callId?.trim()) return

    void sendHeartbeat()

    const timer = window.setInterval(() => {
      void sendHeartbeat()
    }, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat()
    }
    const onOnline = () => void sendHeartbeat()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled, threadId, callId, intervalMs, sendHeartbeat])
}
