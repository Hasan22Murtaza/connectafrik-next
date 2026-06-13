'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { callSessionRowToCallMetadata } from '@/features/chat/services/callSessionRealtime'
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService'

export interface ActiveCallSession {
  callId: string
  roomId: string
  callType: 'audio' | 'video'
  status: string
  isGroupCall: boolean
  participants: string[]
  createdBy: string
  metadata: Record<string, unknown>
  participantProfiles: Array<{
    id: string
    full_name?: string | null
    username?: string | null
    avatar_url?: string | null
  }>
}

function rowToActiveSession(
  row: Record<string, unknown>,
  participantProfiles: ActiveCallSession['participantProfiles'] = [],
): ActiveCallSession | null {
  const status = String(row.status || '')
  if (!['initiated', 'ringing', 'active'].includes(status)) return null
  const callId = typeof row.call_id === 'string' ? row.call_id : ''
  const roomId = typeof row.room_id === 'string' ? row.room_id : ''
  if (!callId || !roomId) return null
  const meta = callSessionRowToCallMetadata(row)
  const participants = Array.isArray(row.participants)
    ? (row.participants as string[]).filter(Boolean)
    : []
  return {
    callId,
    roomId,
    callType: row.call_type === 'video' ? 'video' : 'audio',
    status,
    isGroupCall: meta.isGroupCall === true || participants.length > 2,
    participants,
    createdBy: String(row.created_by || ''),
    metadata: meta,
    participantProfiles,
  }
}

/** Poll + Realtime hook for the active call on a thread (group rejoin, Join Call button). */
export function useActiveCallSession(
  threadId: string | undefined,
  currentUserId: string | undefined,
) {
  const [activeSession, setActiveSession] = useState<ActiveCallSession | null>(null)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  const fetchActive = useCallback(async () => {
    if (!threadId) {
      setActiveSession(null)
      return
    }
    try {
      const res = await apiClient.get<{
        session: Record<string, unknown> | null
        participant_profiles?: Array<{
          id: string
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
        }>
      }>(
        `/api/chat/threads/${threadId}/call-sessions`,
        { active: '1', include_participants: '1' },
      )
      if (!mountedRef.current) return
      setActiveSession(
        res?.session
          ? rowToActiveSession(res.session, res.participant_profiles || [])
          : null,
      )
    } catch {
      if (mountedRef.current) setActiveSession(null)
    }
  }, [threadId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!threadId) {
      setActiveSession(null)
      return
    }
    setLoading(true)
    void fetchActive().finally(() => {
      if (mountedRef.current) setLoading(false)
    })
  }, [threadId, fetchActive])

  useEffect(() => {
    if (!threadId) return
    const unsub = supabaseMessagingService.subscribeToCallSignals(threadId, () => {
      void fetchActive()
    })
    const interval = setInterval(() => void fetchActive(), 15_000)
    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [threadId, fetchActive])

  const canJoin =
    !!activeSession &&
    !!currentUserId &&
    activeSession.status === 'active' &&
    activeSession.isGroupCall &&
    !activeSession.participants.includes(currentUserId)

  const isInCall =
    !!activeSession &&
    !!currentUserId &&
    activeSession.participants.includes(currentUserId)

  return {
    activeSession,
    loading,
    canJoin,
    isInCall,
    refresh: fetchActive,
  }
}
