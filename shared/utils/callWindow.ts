/**
 * Opens a new window for video/audio calls (like Facebook calls)
 */
export function openCallWindow(params: {
  roomId: string
  callType: 'audio' | 'video'
  threadId: string
  callerName: string
  recipientName: string
  isIncoming: boolean
  callerId?: string
}) {
  const { roomId, callType, threadId, callerName, recipientName, isIncoming, callerId } = params
  
  // Build URL with query parameters
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const url = new URL(`${baseUrl}/call/${roomId}`)
  url.searchParams.set('call', 'true')
  url.searchParams.set('type', callType)
  url.searchParams.set('threadId', threadId)
  url.searchParams.set('callerName', encodeURIComponent(callerName))
  url.searchParams.set('recipientName', encodeURIComponent(recipientName))
  url.searchParams.set('isIncoming', isIncoming.toString())
  if (callerId) {
    url.searchParams.set('callerId', callerId)
  }

  // Open new window with specific dimensions (like Facebook)
  const width = 1200
  const height = 800
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2

  const callWindow = window.open(
    url.toString(),
    `call-${roomId}`,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
  )

  if (!callWindow) {
    console.error('Failed to open call window. Please allow popups for this site.')
    alert('Please allow popups to make calls. Click allow in your browser settings.')
    return null
  }

  // Focus the new window
  callWindow.focus()

  return callWindow
}
