export type CallWindowParams = {
  roomId: string
  callType: 'audio' | 'video'
  threadId: string
  isGroupCall?: boolean
  isIncoming: boolean
  callerId?: string
  callId?: string
  /** Defaults to true. Set false when marking the call window as ended. */
  call?: boolean
}

/** Decoded call query values (roomId comes from the path, not the payload). */
export type DecodedCallUrlParams = {
  call: boolean
  callType: 'audio' | 'video'
  threadId: string
  isGroupCall: boolean
  isIncoming: boolean
  callerId: string
  callId: string
}

/** Compact payload stored in the `d` query param. */
type CallUrlPayload = {
  c: boolean
  t: 'audio' | 'video'
  tid: string
  g?: boolean
  i: boolean
  cid?: string
  id?: string
}

const CALL_PAYLOAD_PARAM = 'd'

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const binary = atob(padded + '='.repeat(padLen))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Encode call query values into an opaque URL-safe string. */
export function encodeCallUrlParams(
  params: Omit<CallWindowParams, 'roomId'>,
): string {
  const payload: CallUrlPayload = {
    c: params.call !== false,
    t: params.callType === 'audio' ? 'audio' : 'video',
    tid: params.threadId,
    i: Boolean(params.isIncoming),
  }
  if (typeof params.isGroupCall === 'boolean') {
    payload.g = params.isGroupCall
  }
  if (params.callerId) payload.cid = params.callerId
  if (params.callId) payload.id = params.callId

  const json = JSON.stringify(payload)
  return bytesToBase64Url(new TextEncoder().encode(json))
}

/** Decode an opaque call payload back into typed query values. */
export function decodeCallUrlParams(
  encoded: string | null | undefined,
): DecodedCallUrlParams | null {
  if (!encoded || typeof encoded !== 'string') return null
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(encoded.trim()))
    const raw = JSON.parse(json) as Partial<CallUrlPayload>
    if (!raw || typeof raw !== 'object') return null
    if (typeof raw.tid !== 'string' || !raw.tid) return null

    const callType = raw.t === 'audio' ? 'audio' : 'video'
    return {
      call: raw.c !== false,
      callType,
      threadId: raw.tid,
      isGroupCall: raw.g === true,
      isIncoming: raw.i === true,
      callerId: typeof raw.cid === 'string' ? raw.cid : '',
      callId: typeof raw.id === 'string' ? raw.id : '',
    }
  } catch {
    return null
  }
}

/**
 * Read call params from the current search string.
 * Prefers the encoded `d` payload; falls back to legacy plain query keys.
 */
export function parseCallSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): DecodedCallUrlParams {
  const encoded = searchParams.get(CALL_PAYLOAD_PARAM)
  const decoded = decodeCallUrlParams(encoded)
  if (decoded) return decoded

  // Legacy plaintext query support (older call windows / bookmarks).
  return {
    call: (searchParams.get('call') ?? 'true') === 'true',
    callType: (searchParams.get('type') || 'video') === 'audio' ? 'audio' : 'video',
    threadId: searchParams.get('threadId') || '',
    isGroupCall: searchParams.get('isGroupCall') === 'true',
    isIncoming: searchParams.get('isIncoming') === 'true',
    callerId: searchParams.get('callerId') || '',
    callId: searchParams.get('callId') || '',
  }
}

/**
 * Builds the `/call/[roomId]` URL shared by the popup path and any in-page
 * fallback (e.g. GlobalCallNotification's blocked-popup card, or a same-tab
 * navigate when an outgoing call's window.open is blocked).
 *
 * Query values are base64url-encoded into a single `d` param so UUIDs and
 * call flags are not exposed as plaintext in the address bar.
 */
export function buildCallUrl(params: CallWindowParams): string {
  const { roomId, ...rest } = params
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const url = new URL(`${baseUrl}/call/${roomId}`)
  url.searchParams.set(CALL_PAYLOAD_PARAM, encodeCallUrlParams(rest))
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
