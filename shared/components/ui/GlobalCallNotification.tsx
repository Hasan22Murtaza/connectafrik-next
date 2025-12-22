import React, { useState, useEffect } from 'react'
import { Phone, Video, PhoneOff, X } from 'lucide-react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import VideoSDKCallModal from '@/features/video/components/VideoSDKCallModal'
import { ringtoneService } from '@/features/video/services/ringtoneService'

const GlobalCallNotification: React.FC = () => {
  const { callRequests, currentUser, clearCallRequest } = useProductionChat()
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

  // Listen for custom startCall events
  useEffect(() => {
    const handleStartCall = (event: CustomEvent) => {
      const callData = event.detail
      setActiveCall({
        threadId: `call_${Date.now()}`,
        type: callData.isVideoCall ? 'video' : 'audio',
        callerName: callData.participantName,
        roomId: callData.meetingId,
        token: callData.token,
        callerId: callData.participantId
      })
      setIsCallModalOpen(true)
    }

    window.addEventListener('startCall', handleStartCall as EventListener)
    
    return () => {
      window.removeEventListener('startCall', handleStartCall as EventListener)
    }
  }, [])

  // Handle outgoing calls (when user initiates a call)
  const handleOutgoingCall = () => {
    if (ringtoneRef) {
      ringtoneRef.stop()
      setRingtoneRef(null)
    }
    ringtoneService.stopRingtone()
    // The call modal will handle the rest
  }

  // Find the first active call request
  useEffect(() => {
    console.log('📞 GlobalCallNotification: callRequests changed:', Object.keys(callRequests).length, 'requests')
    console.log('📞 GlobalCallNotification: callRequests details:', callRequests)
    console.log('📞 GlobalCallNotification: currentUser:', currentUser?.id)
    
    const callRequestEntries = Object.entries(callRequests)
    if (callRequestEntries.length > 0) {
      const [threadId, callRequest] = callRequestEntries[0]
      
      console.log('📞 GlobalCallNotification: Processing call request:', {
        threadId,
        callerId: callRequest.callerId,
        currentUserId: currentUser?.id,
        isIncoming: callRequest.callerId !== currentUser?.id
      })
      
      // Only show if it's an incoming call (not from current user)
      if (callRequest.callerId !== currentUser?.id) {
        console.log('📞 GlobalCallNotification: Setting up incoming call modal')
        setActiveCall({
          threadId,
          type: callRequest.type,
          callerName: callRequest.callerName || 'Unknown caller',
          roomId: callRequest.roomId || '',
          token: callRequest.token || '',
          callerId: callRequest.callerId || ''
        })
        setIsCallModalOpen(true)
        
        // Start ringtone for incoming call
        console.log('📞 GlobalCallNotification: Starting ringtone')
        ringtoneService.playRingtone().then(ringtone => {
          setRingtoneRef(ringtone)
          console.log('📞 GlobalCallNotification: Ringtone started')
        }).catch(err => {
          console.error('📞 GlobalCallNotification: Failed to start ringtone:', err)
        })
      } else {
        console.log('📞 GlobalCallNotification: Call request is from current user, ignoring')
      }
    } else {
      console.log('📞 GlobalCallNotification: No call requests, clearing active call')
      setActiveCall(null)
      setIsCallModalOpen(false)
      
      // Stop ringtone if no active calls
      if (ringtoneRef) {
        ringtoneRef.stop()
        setRingtoneRef(null)
      }
      ringtoneService.stopRingtone()
    }
  }, [callRequests, currentUser?.id])

  // Cleanup ringtone on unmount
  useEffect(() => {
    return () => {
      if (ringtoneRef) {
        ringtoneRef.stop()
      }
      ringtoneService.stopRingtone()
    }
  }, [ringtoneRef])

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

  // Don't render if no active call
  if (!activeCall) return null

  return (
    <VideoSDKCallModal
      isOpen={isCallModalOpen}
      onClose={handleCallEnd}
      callType={activeCall.type}
      callerName={activeCall.callerName}
      recipientName={currentUser?.name || 'You'}
      isIncoming={true} // This is for incoming calls from other users
      onAccept={handleAcceptCall}
      onReject={handleRejectCall}
      onCallEnd={handleCallEnd}
      threadId={activeCall.threadId}
      currentUserId={currentUser?.id}
      roomIdHint={activeCall.roomId}
      tokenHint={activeCall.token}
    />
  )
}

export default GlobalCallNotification
