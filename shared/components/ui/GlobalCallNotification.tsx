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
  const callRequestsRef = useRef(callRequests)
  const currentUserIdRef = useRef<string | undefined>(undefined)
  callRequestsRef.current = callRequests
  currentUserIdRef.current = currentUser?.id

  const isRingtoneActiveRef = useRef(false)
  /** Popup we opened; reuse + focus instead of window.open again (same name reloads the accept page). */
  const callPopupRef = useRef<Window | null>(null)
  /** Set only after window.open succeeds (avoids Strict Mode / re-render skipping the open). */
  const openedIncomingSignatureRef = useRef<string>('')
  const popupOpeningForSignatureRef = useRef<string>('')
  /** Prevents ringing again after CALL_STATUS active (effect replays when e.g. profile name loads). */
  const answeredIncomingRingtoneRef = useRef<Set<string>>(new Set())

  const suppressKeyForIncoming = (threadId: string, callId: string) =>
    callId.trim() ? `${threadId}|${callId.trim()}` : `${threadId}|`

  const shouldSuppressRingtone = (threadId: string, callId: string) => {
    const s = answeredIncomingRingtoneRef.current
    const c = callId.trim()
    if (c && s.has(`${threadId}|${c}`)) return true
    // Accept postMessage omitted callId — only then we suppress by thread.
    if (s.has(`${threadId}|`)) return true
    return false
  }

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
    const cid = callRequest.callId || ''

    if (shouldSuppressRingtone(threadId, cid)) {
      return
    }

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
    const applyCallStatus = (payload: any) => {
      if (!payload || payload.type !== 'CALL_STATUS') return

      if (payload.status === 'active' && payload.threadId) {
        const activeThreadId = String(payload.threadId)
        const activeCallId =
          typeof payload.callId === 'string' && payload.callId.trim()
            ? payload.callId.trim()
            : ''
        const uid = currentUserIdRef.current
        const reqs = callRequestsRef.current
        const req = reqs[activeThreadId]
        const hasIncoming =
          Boolean(req?.callerId && uid && req.callerId !== uid)
        const sig = openedIncomingSignatureRef.current
        const openedForThread = sig.length > 0 && sig.startsWith(`${activeThreadId}|`)
        const openedForCall =
          Boolean(activeCallId) && sig.split('|')[1] === activeCallId

        if (hasIncoming || openedForThread || openedForCall) {
          answeredIncomingRingtoneRef.current.add(suppressKeyForIncoming(activeThreadId, activeCallId))
          stopCallRingtone()
          // Drop incoming row immediately so the ringtone effect does not call
          // startCallRingtone() again while call_sessions realtime catches up.
          clearCallRequest(activeThreadId)
        }
      }

      if (payload.status === 'ended' && payload.threadId) {
        const endedTid = String(payload.threadId)
        const prefix = `${endedTid}|`
        answeredIncomingRingtoneRef.current = new Set(
          [...answeredIncomingRingtoneRef.current].filter((k) => !k.startsWith(prefix)),
        )
        clearIncomingPopupGuard()
        clearCallRequest(payload.threadId)
        openedIncomingSignatureRef.current = ''
        popupOpeningForSignatureRef.current = ''
        callPopupRef.current = null
        stopCallRingtone()
      }
    }

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      applyCallStatus(event.data)
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      applyCallStatus(event.data)
    }

    /** Foreground FCM: same payloads as SW; dismiss outgoing/incoming UI when call ends or is accepted. */
    const handleFcmForeground = (event: Event) => {
      const detail = (event as CustomEvent<{ data?: Record<string, string> }>).detail
      const data = detail?.data
      if (!data || typeof data !== 'object') return
      const t = String(data.type || data.status || data.call_status || '')
        .trim()
        .toLowerCase()
      const last = String(data.last_signal || '')
        .trim()
        .toLowerCase()
      const threadId = String(
        data.thread_id || data.threadId || data.chat_thread_id || '',
      ).trim()
      const callIdRaw = data.call_id || data.callId || ''
      const callId = typeof callIdRaw === 'string' ? callIdRaw.trim() : ''

      if (t === 'active' || last === 'active') {
        applyCallStatus({
          type: 'CALL_STATUS',
          status: 'active',
          ...(threadId ? { threadId } : {}),
          ...(callId ? { callId } : {}),
        })
        return
      }
      if (
        t === 'declined' ||
        last === 'declined' ||
        t === 'ended' ||
        last === 'ended'
      ) {
        if (threadId) {
          applyCallStatus({
            type: 'CALL_STATUS',
            status: 'ended',
            threadId,
            ...(callId ? { callId } : {}),
          })
        }
      }
    }

    window.addEventListener('message', handleWindowMessage)
    window.addEventListener('fcm-foreground-message', handleFcmForeground)
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    }

    return () => {
      window.removeEventListener('message', handleWindowMessage)
      window.removeEventListener('fcm-foreground-message', handleFcmForeground)
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      }
    }
  }, [clearCallRequest])

  return null
}

export default GlobalCallNotification
