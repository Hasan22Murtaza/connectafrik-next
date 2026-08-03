export type CallWindowParams = {
  roomId: string
  callType: 'audio' | 'video'
  threadId: string
  isGroupCall?: boolean
  isIncoming: boolean
  callerId?: string
  callId?: string
}

/**
 * Builds the `/call/[roomId]` URL shared by the popup path and any in-page
 * fallback (e.g. GlobalCallNotification's blocked-popup card, or a same-tab
 * navigate when an outgoing call's window.open is blocked).
 */
export function buildCallUrl(params: CallWindowParams): string {
  const { roomId, callType, threadId, isGroupCall, isIncoming, callerId, callId } = params
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const url = new URL(`${baseUrl}/call/${roomId}`)
  url.searchParams.set('call', 'true')
  url.searchParams.set('type', callType)
  url.searchParams.set('threadId', threadId)
  if (typeof isGroupCall === 'boolean') {
    url.searchParams.set('isGroupCall', isGroupCall ? 'true' : 'false')
  }
  url.searchParams.set('isIncoming', String(isIncoming))
  if (callerId) {
    url.searchParams.set('callerId', callerId)
  }
  if (callId) {
    url.searchParams.set('callId', callId)
  }
  return url.toString()
}

/**
 * Opens a new window for video/audio calls (like Facebook calls).
 * Identity (names/avatars) is not passed on the URL — the call page hydrates
 * from `/api/chat/threads/.../call-sessions` and thread data.
 */
export function openCallWindow(params: CallWindowParams) {
  const { roomId, isIncoming, callId } = params
  const urlString = buildCallUrl(params)

  const width = 1200
  const screenHeight = window.screen.height
  const calculatedHeight = Math.min(Math.max(screenHeight * 0.8, 600), 1000)
  const height = Math.round(calculatedHeight)
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2

  const windowName = callId ? `call-${roomId}-${callId}` : `call-${roomId}`

  const callWindow = window.open(
    urlString,
    windowName,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
  )

  if (!callWindow) {
    // Blocked. An inbound call is never a user gesture, so this fires reliably
    // on default browser policy. Do NOT alert() here: it blocks the main thread
    // on a call the user hasn't consented to interact with yet, and it used to
    // be the only signal a blocked popup ever produced. Callers of this
    // function render a proper in-page answer/decline fallback instead
    // (see GlobalCallNotification's `popupBlocked` state) -- this just logs.
    console.warn('[callWindow] window.open blocked; falling back to in-page call UI', { roomId, isIncoming })
    return null
  }

  callWindow.focus()

  return callWindow
}
