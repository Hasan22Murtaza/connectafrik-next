import { useProductionChat } from '@/contexts/ProductionChatContext'
import { ringtoneService } from '@/features/video/services/ringtoneService'
import React, { useEffect, useRef, useState } from 'react'

const GlobalCallNotification: React.FC = () => {
  const { callRequests, currentUser, clearCallRequest } = useProductionChat()
  const openedForRoomIdRef = useRef<string | null>(null)
  const [activeCall, setActiveCall] = useState<{
    threadId: string
    type: 'audio' | 'video'
    callerName: string
    roomId: string
    token: string
    callerId: string
  } | null>(null)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [ringtoneRef, setRingtoneRef] = useState<{ stop: () => void } | null>(null)

  // Find the first active call request
  // NOTE: This component only handles INCOMING calls (calls from other users)
  // Outgoing calls (calls initiated by current user) are handled by ChatWindow
  useEffect(() => {
    
    
    const callRequestEntries = Object.entries(callRequests)
    if (callRequestEntries.length > 0) {
      const [threadId, callRequest] = callRequestEntries[0]
    
      
      // Only show if it's an incoming call (not from current user)
      if (callRequest.callerId !== currentUser?.id) {
        const roomId = callRequest.roomId || ''
        // Only open new window once per room (avoid multiple accept screens)
        const alreadyOpenedForThisRoom = openedForRoomIdRef.current === roomId
        if (!activeCall || activeCall.threadId !== threadId) {
          const newActiveCall = {
            threadId,
            type: callRequest.type,
            callerName: callRequest.callerName || 'Unknown caller',
            roomId,
            token: callRequest.token || '',
            callerId: callRequest.callerId || ''
          }
          setActiveCall(newActiveCall)
          
          // Open call window only once per room (openCallWindow also reuses/focuses existing window)
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
          
          // Start ringtone for incoming call
          console.log('📞 GlobalCallNotification: Starting ringtone')
          ringtoneService.playRingtone().then(ringtone => {
            setRingtoneRef(ringtone)
            console.log('📞 GlobalCallNotification: Ringtone started')
          }).catch(err => {
            console.error('📞 GlobalCallNotification: Failed to start ringtone:', err)
          })
        } else {
          console.log('📞 GlobalCallNotification: Call already active for this thread')
        }
      } else {
        console.log('📞 GlobalCallNotification: Call request is from current user, ignoring')
      }
    } else {
      if (activeCall) {
        // keep activeCall until CLEAR
      } else {
        console.log('📞 GlobalCallNotification: No call requests and no active call - clearing')
        setActiveCall(null)
        setIsCallModalOpen(false)
        openedForRoomIdRef.current = null
        if (ringtoneRef) {
          ringtoneRef.stop()
          setRingtoneRef(null)
        }
        ringtoneService.stopRingtone()
      }
    }
  }, [callRequests, currentUser?.id, activeCall])

  // Cleanup ringtone on unmount
  useEffect(() => {
    return () => {
      if (ringtoneRef) {
        ringtoneRef.stop()
      }
      ringtoneService.stopRingtone()
    }
  }, [ringtoneRef])

  // When call window closes (End call, Reject, or user closes with X), it posts CALL_ENDED.
  // Clear callRequests and activeCall so the next call can ring on callee and caller does not get stuck ringing.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'CALL_ENDED' && event.data?.threadId) {
        clearCallRequest(event.data.threadId)
        setActiveCall(null)
        setIsCallModalOpen(false)
        openedForRoomIdRef.current = null
        if (ringtoneRef) {
          ringtoneRef.stop()
          setRingtoneRef(null)
        }
        ringtoneService.stopRingtone()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [clearCallRequest, ringtoneRef])

  const handleAcceptCall = () => {
    if (ringtoneRef) {
      ringtoneRef.stop()
      setRingtoneRef(null)
    }
    ringtoneService.stopRingtone()
    // The call modal will handle the rest
  }

  const handleRejectCall = () => {
    if (activeCall) {
      clearCallRequest(activeCall.threadId)
    }
    if (ringtoneRef) {
      ringtoneRef.stop()
      setRingtoneRef(null)
    }
    ringtoneService.stopRingtone()
    setActiveCall(null)
    setIsCallModalOpen(false)
  }

  const handleCallEnd = () => {
    if (activeCall) {
      clearCallRequest(activeCall.threadId)
    }
    if (ringtoneRef) {
      ringtoneRef.stop()
      setRingtoneRef(null)
    }
    ringtoneService.stopRingtone()
    setActiveCall(null)
    setIsCallModalOpen(false)
  }

  // Don't render modal - calls now open in new windows (like Facebook)
  // This component just manages the call request state and opens windows
  return null
}

export default GlobalCallNotification
