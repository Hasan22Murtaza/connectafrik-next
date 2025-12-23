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

  // Find the first active call request
  // NOTE: This component only handles INCOMING calls (calls from other users)
  // Outgoing calls (calls initiated by current user) are handled by ChatWindow
  useEffect(() => {
    console.log('📞 GlobalCallNotification: callRequests changed:', Object.keys(callRequests).length, 'requests')
    console.log('📞 GlobalCallNotification: callRequests details:', callRequests)
    console.log('📞 GlobalCallNotification: currentUser:', currentUser?.id)
    console.log('📞 GlobalCallNotification: activeCall:', activeCall?.threadId)
    
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
        // Only set up new call if we don't already have an active call for this thread
        if (!activeCall || activeCall.threadId !== threadId) {
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
          console.log('📞 GlobalCallNotification: Call already active for this thread, keeping modal open')
        }
      } else {
        console.log('📞 GlobalCallNotification: Call request is from current user, ignoring')
      }
    } else {
      // ✅ FIXED: Don't automatically close modal when callRequests becomes empty
      // Once activeCall is set, keep the modal open until user explicitly accepts/rejects
      // or the call ends. This prevents premature closing.
      if (activeCall) {
        console.log('📞 GlobalCallNotification: callRequests is empty but activeCall exists - keeping modal open')
        // Keep modal open - don't close automatically
        // The modal will close when:
        // 1. User accepts (VideoSDKCallModal handles it)
        // 2. User rejects (handleRejectCall)
        // 3. Call ends (handleCallEnd)
        // 4. Other side rejects (VideoSDKCallModal listener)
      } else {
        console.log('📞 GlobalCallNotification: No call requests and no active call - clearing')
        // Only clear if there's truly no active call
        setActiveCall(null)
        setIsCallModalOpen(false)
        
        // Stop ringtone if no active calls
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
