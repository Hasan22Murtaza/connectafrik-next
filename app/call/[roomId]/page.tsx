'use client'

import React from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import VideoSDKCallModal from '@/features/video/components/VideoSDKCallModal'
import { useAuth } from '@/contexts/AuthContext'
import { useProductionChat } from '@/contexts/ProductionChatContext'

export default function CallWindowPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { currentUser } = useProductionChat()
  
  const roomId = params?.roomId as string
  const callType = (searchParams?.get('type') || 'video') as 'audio' | 'video'
  const threadId = searchParams?.get('threadId') || ''
  const callerName = searchParams?.get('callerName') || 'Unknown'
  const recipientName = searchParams?.get('recipientName') || 'Unknown'
  const isIncoming = searchParams?.get('isIncoming') === 'true'
  const callerId = searchParams?.get('callerId') || ''

  // Close window when call ends
  const handleCallEnd = () => {
    // Close the window after a short delay
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.close()
      }
    }, 1000)
  }



  return (
    <div className="w-full h-screen bg-black overflow-hidden">
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
    </div>
  )
}
