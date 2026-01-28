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
  // Calculate height based on device screen height (80% of screen height, min 600, max 1000)
  const screenHeight = window.screen.height
  const calculatedHeight = Math.min(Math.max(screenHeight * 0.8, 600), 1000)
  const height = Math.round(calculatedHeight)
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2

  const callWindow = window.open(
    url.toString(),
    `call-${roomId}`,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
  )

  if (!callWindow) {
    console.error('Failed to open call window. Please allow popups for this site.')
    alert(
      'Popups are blocked. To make calls, please allow popups for this site:\n\n' +
      'Chrome/Edge:\n' +
      '1. Click the popup blocked icon (🚫) in the address bar\n' +
      '2. Select "Always allow popups and redirects from [this site]"\n' +
      '3. Click "Done"\n\n' +
      'Firefox:\n' +
      '1. Click the popup blocked icon (🚫) in the address bar\n' +
      '2. Click "Allow popups for this site"\n\n' +
      'Safari:\n' +
      '1. Go to Safari > Settings > Websites > Pop-up Windows\n' +
      '2. Find this site and change to "Allow"\n\n' +
      'After allowing popups, please try making the call again.'
    )
    return null
  }

  // Focus the new window
  callWindow.focus()

  return callWindow
}
