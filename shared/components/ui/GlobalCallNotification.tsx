import { useProductionChat, type CallRequest } from '@/contexts/ProductionChatContext'
import { playRingtone, stopRingtone, stopAll } from '@/features/video/services/ringtoneService'
import React, { useEffect, useMemo, useRef } from 'react'

/** Survives React Strict Mode remount (refs reset while callRequests in parent stays set). */
const INCOMING_POPUP_GUARD_KEY = 'ca_incoming_popup_guard'
const INCOMING_POPUP_GUARD_TTL_MS = 15_000

function readIncomingPopupGuard(): { signature: string; t: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(INCOMING_POPUP_GUARD_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { signature?: string; t?: number }
    if (typeof p.signature !== 'string' || typeof p.t !== 'number') return null
    return { signature: p.signature, t: p.t }
  } catch {
    return null
  }
}

function writeIncomingPopupGuard(signature: string) {
  try {
    sessionStorage.setItem(INCOMING_POPUP_GUARD_KEY, JSON.stringify({ signature, t: Date.now() }))
  } catch {
    /* private mode / quota */
  }
}

function clearIncomingPopupGuard() {
  try {
    sessionStorage.removeItem(INCOMING_POPUP_GUARD_KEY)
  } catch {
    /* ignore */
  }
}

function pickPrimaryIncoming(
  callRequests: Record<string, CallRequest | undefined>,
  currentUserId: string | undefined
): { threadId: string; callRequest: CallRequest } | null {
  const threadIds = Object.keys(callRequests).sort()
  for (const threadId of threadIds) {
    const callRequest = callRequests[threadId]
    if (!callRequest) continue
    if (callRequest.callerId && currentUserId && callRequest.callerId === currentUserId) continue
    return { threadId, callRequest }
  }
  return null
}

const GlobalCallNotification: React.FC = () => {
  const { callRequests, currentUser, clearCallRequest } = useProductionChat()
  const isRingtoneActiveRef = useRef(false)
  /** Popup we opened; reuse + focus instead of window.open again (same name reloads the accept page). */
  const callPopupRef = useRef<Window | null>(null)
  /** Set only after window.open succeeds (avoids Strict Mode / re-render skipping the open). */
  const openedIncomingSignatureRef = useRef<string>('')
  const popupOpeningForSignatureRef = useRef<string>('')

  const startCallRingtone = () => {
    if (isRingtoneActiveRef.current) return
    isRingtoneActiveRef.current = true
    playRingtone().catch(() => {})
  }

  const stopCallRingtone = () => {
    if (!isRingtoneActiveRef.current) return
    isRingtoneActiveRef.current = false
    stopRingtone()
  }

  const primaryIncoming = useMemo(
    () => pickPrimaryIncoming(callRequests, currentUser?.id),
    [callRequests, currentUser?.id]
  )

  const incomingSignature = useMemo(() => {
    if (!primaryIncoming) return ''
    const { threadId, callRequest } = primaryIncoming
    const roomId = callRequest.roomId || ''
    const callId = callRequest.callId || ''
    return `${threadId}|${callId}|${roomId}|${callRequest.type}`
  }, [primaryIncoming])

  // If callRequests flickers empty for one frame, clearing openedIncomingSignatureRef caused a second
  // window.open (same as duplicate accept / full popup reload). Debounce ref reset instead.
  useEffect(() => {
    if (incomingSignature) return
    stopCallRingtone()
    const t = window.setTimeout(() => {
      openedIncomingSignatureRef.current = ''
      popupOpeningForSignatureRef.current = ''
    }, 750)
    return () => window.clearTimeout(t)
  }, [incomingSignature])

  useEffect(() => {
    if (!incomingSignature || !primaryIncoming) {
      return
    }

    const { threadId, callRequest } = primaryIncoming
    const roomId = callRequest.roomId || ''

    if (openedIncomingSignatureRef.current === incomingSignature) {
      const w = callPopupRef.current
      if (w && !w.closed) {
        try {
          w.focus()
        } catch {
          /* ignore */
        }
      }
      startCallRingtone()
      return
    }

    if (popupOpeningForSignatureRef.current === incomingSignature) {
      return
    }

    if (typeof window !== 'undefined' && roomId) {
      const guard = readIncomingPopupGuard()
      if (
        guard &&
        guard.signature === incomingSignature &&
        Date.now() - guard.t < INCOMING_POPUP_GUARD_TTL_MS
      ) {
        openedIncomingSignatureRef.current = incomingSignature
        startCallRingtone()
        return
      }

      popupOpeningForSignatureRef.current = incomingSignature
      writeIncomingPopupGuard(incomingSignature)
      import('@/shared/utils/callWindow').then(({ openCallWindow }) => {
        try {
          const next = openCallWindow({
            roomId,
            callType: callRequest.type,
            threadId,
            callerName: callRequest.callerName || 'Unknown',
            recipientName: currentUser?.name || 'You',
            callerAvatarUrl: callRequest.callerAvatarUrl,
            isGroupCall: callRequest.isGroupCall === true,
            isIncoming: true,
            callerId: callRequest.callerId,
            callId: callRequest.callId,
          })
          if (next) {
            callPopupRef.current = next
            openedIncomingSignatureRef.current = incomingSignature
          } else {
            clearIncomingPopupGuard()
          }
        } finally {
          if (popupOpeningForSignatureRef.current === incomingSignature) {
            popupOpeningForSignatureRef.current = ''
          }
        }
        startCallRingtone()
      })
    }
  }, [incomingSignature, primaryIncoming, currentUser?.name])

  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data?.type === 'CALL_STATUS' && event.data?.status === 'active') {
        stopCallRingtone()
      }

      if (event.data?.type === 'CALL_STATUS' && event.data?.status === 'ended' && event.data?.threadId) {
        clearIncomingPopupGuard()
        clearCallRequest(event.data.threadId)
        openedIncomingSignatureRef.current = ''
        popupOpeningForSignatureRef.current = ''
        callPopupRef.current = null
        stopCallRingtone()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [clearCallRequest])

  return null
}

export default GlobalCallNotification
