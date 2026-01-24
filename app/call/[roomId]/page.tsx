'use client'

import React, { useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import VideoSDKCallModal from '@/features/video/components/VideoSDKCallModal'
import { useAuth } from '@/contexts/AuthContext'
import { useProductionChat } from '@/contexts/ProductionChatContext'

const CALL_ENDED = 'CALL_ENDED'

function notifyParentCallEnded(threadId: string) {
  if (typeof window !== 'undefined' && threadId && window.opener) {
    try {
      window.opener.postMessage({ type: CALL_ENDED, threadId }, window.location.origin)
    } catch {}
  }
}

export default function CallWindowPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const { currentUser } = useProductionChat()

  // Safe URL decoding function - handles already decoded strings gracefully
  const safeDecode = (str: string | null): string => {
    if (!str) return 'Unknown';
    try {
      return decodeURIComponent(str);
    } catch (error) {
      // If decoding fails, return the original string (might already be decoded)
      return str;
    }
  };

  const roomId = params?.roomId as string
  const callParam = searchParams?.get('call') ?? 'true'
  const isOpen = callParam === 'true'
  const callType = (searchParams?.get('type') || 'video') as 'audio' | 'video'
  const threadId = searchParams?.get('threadId') || ''
  const callerName = safeDecode(searchParams?.get('callerName'))
  const recipientName = safeDecode(searchParams?.get('recipientName'))
  const isIncoming = searchParams?.get('isIncoming') === 'true'
  const callerId = searchParams?.get('callerId') || ''

  // Notify parent tab when call ends so it can clear callRequests/activeCall and stop ringtone
  // This fixes: after first call closes, second call does not ring on callee and caller stays ringing
  const handleCallEnd = () => {
    notifyParentCallEnded(threadId)
    const newParams = new URLSearchParams(searchParams?.toString() || '')
    newParams.set('call', 'false')
    router.replace(`/call/${roomId}?${newParams.toString()}`)
    setTimeout(() => {
      if (typeof window !== 'undefined') window.close()
    }, 1500)
  }

  // If user closes window via X, still notify parent to clear state
  useEffect(() => {
    const onBeforeUnload = () => notifyParentCallEnded(threadId)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [threadId])

  return (
    <div className="w-full h-screen bg-black overflow-hidden">
      {isOpen ? (
        <VideoSDKCallModal
          isOpen={true}
          onClose={handleCallEnd}
          callType={callType}
          callerName={callerName}
          recipientName={recipientName || currentUser?.name || 'You'}
          isIncoming={isIncoming}
          onAccept={() => {}}
          onReject={handleCallEnd}
          onCallEnd={handleCallEnd}
          threadId={threadId}
          currentUserId={currentUser?.id || user?.id}
          roomIdHint={roomId}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-white text-lg">Call ended</div>
      )}
    </div>
  )
}
