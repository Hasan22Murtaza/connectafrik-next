'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  familyService,
  type FamilyMeStatus,
} from '@/features/settings/services/familyService'
import {
  areAllMessageTypesLocked,
  isCallKindAllowed,
  isMessageKindAllowed,
  type ParentalCallKind,
  type ParentalControls,
} from '@/shared/types/family'

const STATUS_POLL_MS = 60_000

export type ParentalCapabilities = {
  loading: boolean
  controlsActive: boolean
  controls: ParentalControls | null
  refresh: () => Promise<void>
  canSendText: boolean
  canSendImage: boolean
  canSendVideo: boolean
  canSendAudio: boolean
  canSendEmergency: boolean
  /** True when no regular message type is allowed (emergency may still be). */
  onlyEmergencyMessaging: boolean
  canAudioCall: boolean
  canVideoCall: boolean
  canGroupAudioCall: boolean
  canGroupVideoCall: boolean
  canCall: (kind: ParentalCallKind) => boolean
  canMessage: (kind: 'text' | 'image' | 'video' | 'audio' | 'emergency' | 'other') => boolean
  reelsRestrictionEnabled: boolean
  allowedReelCategories: string[] | null
}

/**
 * Client-side parental capability flags for managed child/teen accounts.
 * Non-managed users get everything allowed.
 */
export function useParentalControls(): ParentalCapabilities {
  const { user, loading: authLoading } = useAuth()
  const [me, setMe] = useState<FamilyMeStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setMe(null)
      setLoading(false)
      return
    }
    try {
      const status = await familyService.getMe()
      setMe(status)
    } catch {
      // Non-fatal offline / auth edge cases
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  useEffect(() => {
    if (!user || !me?.controls_active) return
    const id = window.setInterval(() => {
      void refresh()
    }, STATUS_POLL_MS)
    return () => window.clearInterval(id)
  }, [user, me?.controls_active, refresh])

  const controls = me?.controls_active ? me.controls : null

  return useMemo(() => {
    const canMessage = (
      kind: 'text' | 'image' | 'video' | 'audio' | 'emergency' | 'other'
    ) => isMessageKindAllowed(controls, kind)
    const canCall = (kind: ParentalCallKind) => isCallKindAllowed(controls, kind)

    const onlyEmergency =
      Boolean(controls) &&
      areAllMessageTypesLocked(controls) &&
      isMessageKindAllowed(controls, 'emergency')

    return {
      loading: authLoading || loading,
      controlsActive: Boolean(me?.controls_active),
      controls,
      refresh,
      canSendText: canMessage('text'),
      canSendImage: canMessage('image'),
      canSendVideo: canMessage('video'),
      canSendAudio: canMessage('audio'),
      canSendEmergency: canMessage('emergency'),
      onlyEmergencyMessaging: onlyEmergency,
      canAudioCall: canCall('audio'),
      canVideoCall: canCall('video'),
      canGroupAudioCall: canCall('group_audio'),
      canGroupVideoCall: canCall('group_video'),
      canCall,
      canMessage,
      reelsRestrictionEnabled: controls?.reels_restriction_enabled === true,
      allowedReelCategories: controls?.reels_restriction_enabled
        ? controls.reels_allowed_categories || []
        : null,
    }
  }, [authLoading, loading, me, controls, refresh])
}
