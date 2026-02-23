import { useProductionChat } from '@/contexts/ProductionChatContext'
import { playRingtone, stopRingtone, stopAll } from '@/features/video/services/ringtoneService'
import React, { useEffect, useRef, useState } from 'react'

const GlobalCallNotification: React.FC = () => {
  const { callRequests, currentUser, clearCallRequest } = useProductionChat()
  const openedForRoomIdRef = useRef<string | null>(null)
  const isRingtoneActiveRef = useRef(false)
  const [activeCall, setActiveCall] = useState<{
    threadId: string
    type: 'audio' | 'video'
    callerName: string
    roomId: string
    token: string
    callerId: string
  } | null>(null)

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

  // Detect incoming call requests and open the call popup window + start ringtone
  useEffect(() => {
    const callRequestEntries = Object.entries(callRequests)
    if (callRequestEntries.length > 0) {
      const [threadId, callRequest] = callRequestEntries[0]

      // Only handle incoming calls (not from current user)
      if (callRequest.callerId !== currentUser?.id) {
        const roomId = callRequest.roomId || ''
        const alreadyOpenedForThisRoom = openedForRoomIdRef.current === roomId
        if (!activeCall || activeCall.threadId !== threadId) {
          setActiveCall({
            threadId,
            type: callRequest.type,
            callerName: callRequest.callerName || 'Unknown caller',
            roomId,
            token: callRequest.token || '',
            callerId: callRequest.callerId || ''
          })

          if (typeof window !== 'undefined' && roomId && !alreadyOpenedForThisRoom) {
            openedForRoomIdRef.current = roomId
            import('@/shared/utils/callWindow').then(({ openCallWindow }) => {
              openCallWindow({
                roomId,
                callType: callRequest.type,
                threadId,
                callerName: callRequest.callerName || 'Unknown',
                recipientName: currentUser?.name || 'You',
                isIncoming: true,
                callerId: callRequest.callerId
              })
            })
          }

          startCallRingtone()
        }
      }
    } else if (!activeCall) {
      openedForRoomIdRef.current = null
      stopCallRingtone()
    }
  }, [callRequests, currentUser?.id, activeCall])

  // Cleanup all tones on unmount
  useEffect(() => {
    return () => { stopAll() }
  }, [])

  // Handle CALL_ACCEPTED / CALL_ENDED messages posted by the call popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data?.type === 'CALL_ACCEPTED') {
        stopCallRingtone()
      }

      if (event.data?.type === 'CALL_ENDED' && event.data?.threadId) {
        clearCallRequest(event.data.threadId)
        setActiveCall(null)
        openedForRoomIdRef.current = null
        stopCallRingtone()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [clearCallRequest])

  return null
}

export default GlobalCallNotification
