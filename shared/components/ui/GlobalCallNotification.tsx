import { useProductionChat } from '@/contexts/ProductionChatContext'
import { ringtoneService } from '@/features/video/services/ringtoneService'
import React, { useEffect, useState, useRef } from 'react'

const GlobalCallNotification: React.FC = () => {
  const { callRequests, currentUser, clearCallRequest, getThreadById } = useProductionChat()
  const [activeCall, setActiveCall] = useState<{
    threadId: string
    type: 'audio' | 'video'
    callerName: string
    roomId: string
    token: string
    callerId: string
  } | null>(null)
  const [ringtoneRef, setRingtoneRef] = useState<{ stop: () => void } | null>(null)
  const callWindowRef = useRef<Window | null>(null)
  const processedCallRef = useRef<string | null>(null)

  // Find the first active call request
  // NOTE: This component only handles INCOMING calls (calls from other users)
  // Outgoing calls (calls initiated by current user) are handled by ChatWindow
  useEffect(() => {
    const callRequestEntries = Object.entries(callRequests)
    if (callRequestEntries.length > 0) {
      const [threadId, callRequest] = callRequestEntries[0]
    
      // Only show if it's an incoming call (not from current user)
      if (callRequest.callerId !== currentUser?.id) {
        // Only open new window if we haven't already processed this call
        if (processedCallRef.current !== threadId) {
          processedCallRef.current = threadId;
          
          setActiveCall({
            threadId,
            type: callRequest.type,
            callerName: callRequest.callerName || 'Unknown caller',
            roomId: callRequest.roomId || '',
            token: callRequest.token || '',
            callerId: callRequest.callerId || ''
          })
          
          // Get thread to get better participant names
          const thread = getThreadById(threadId);
          const otherParticipants = thread?.participants?.filter(
            (p: any) => p.id !== currentUser?.id
          ) || [];
          const primaryParticipant = otherParticipants[0];
          
          // Open new window for incoming call
          const callUrl = new URL('/call', window.location.origin);
          callUrl.searchParams.set('threadId', threadId);
          callUrl.searchParams.set('type', callRequest.type);
          callUrl.searchParams.set('callerName', primaryParticipant?.name || callRequest.callerName || 'Unknown');
          callUrl.searchParams.set('recipientName', currentUser?.name || 'You');
          callUrl.searchParams.set('isIncoming', 'true');
          callUrl.searchParams.set('roomId', callRequest.roomId);
          callUrl.searchParams.set('token', callRequest.token);
          
          callWindowRef.current = window.open(
            callUrl.toString(),
            'call',
            'width=1200,height=800,resizable=yes,scrollbars=no'
          );
          
          if (!callWindowRef.current) {
            console.error('Failed to open call window - popup may be blocked');
          }
          
          // Start ringtone for incoming call
          console.log('📞 GlobalCallNotification: Starting ringtone')
          ringtoneService.playRingtone().then(ringtone => {
            setRingtoneRef(ringtone)
            console.log('📞 GlobalCallNotification: Ringtone started')
          }).catch(err => {
            console.error('📞 GlobalCallNotification: Failed to start ringtone:', err)
          })
        }
      } else {
        console.log('📞 GlobalCallNotification: Call request is from current user, ignoring')
      }
    } else {
      // No call requests - clear state
      if (activeCall) {
        processedCallRef.current = null;
      } else {
        console.log('📞 GlobalCallNotification: No call requests and no active call - clearing')
        setActiveCall(null)
        
        // Stop ringtone if no active calls
        if (ringtoneRef) {
          ringtoneRef.stop()
          setRingtoneRef(null)
        }
        ringtoneService.stopRingtone()
      }
    }
  }, [callRequests, currentUser?.id, activeCall, getThreadById])

  // Cleanup ringtone on unmount
  useEffect(() => {
    return () => {
      if (ringtoneRef) {
        ringtoneRef.stop()
      }
      ringtoneService.stopRingtone()
    }
  }, [ringtoneRef])

  // Monitor call window and clean up when it closes
  useEffect(() => {
    if (!callWindowRef.current) return;

    const checkWindow = setInterval(() => {
      if (callWindowRef.current?.closed) {
        // Window was closed, clean up
        if (activeCall) {
          clearCallRequest(activeCall.threadId);
        }
        if (ringtoneRef) {
          ringtoneRef.stop();
          setRingtoneRef(null);
        }
        ringtoneService.stopRingtone();
        setActiveCall(null);
        processedCallRef.current = null;
        callWindowRef.current = null;
        clearInterval(checkWindow);
      }
    }, 1000);

    return () => clearInterval(checkWindow);
  }, [activeCall, ringtoneRef, clearCallRequest]);

  // Don't render anything - calls are handled in new window
  return null;
}

export default GlobalCallNotification
