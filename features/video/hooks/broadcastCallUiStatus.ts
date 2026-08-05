/** Broadcast call-active / call-ended to parent/opener tab via postMessage. */
export function broadcastCallUiStatus(
  status: 'active' | 'ended',
  threadId: string | undefined,
  callId?: string,
) {
  if (typeof window === 'undefined' || !threadId) return;
  const payload = {
    type: 'CALL_STATUS',
    status,
    threadId,
    ...(callId?.trim() ? { callId: callId.trim() } : {}),
  };
  try {
    window.postMessage(payload, window.location.origin);
  } catch {
    /* ignore */
  }
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
    }
  } catch {
    /* ignore */
  }
  try {
    if (window.parent !== window && !window.parent.closed) {
      window.parent.postMessage(payload, window.location.origin);
    }
  } catch {
    /* ignore */
  }
}
