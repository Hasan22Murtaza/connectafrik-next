"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import VideoSDKCallInterface from '@/features/video/components/VideoSDKCallInterface';
import { useProductionChat } from '@/contexts/ProductionChatContext';
import { useAuth } from '@/contexts/AuthContext';

export default function CallPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { getThreadById } = useProductionChat();

  const [callData, setCallData] = useState<{
    threadId: string;
    callType: 'audio' | 'video';
    callerName: string;
    recipientName: string;
    isIncoming: boolean;
    roomId?: string;
    token?: string;
  } | null>(null);

  useEffect(() => {
    // Get call parameters from URL
    const threadId = searchParams.get('threadId');
    const callType = searchParams.get('type') as 'audio' | 'video';
    const callerName = searchParams.get('callerName') || 'Unknown';
    const recipientName = searchParams.get('recipientName') || 'Unknown';
    const isIncoming = searchParams.get('isIncoming') === 'true';
    const roomId = searchParams.get('roomId') || undefined;
    const token = searchParams.get('token') || undefined;

    if (!threadId || !callType) {
      // Invalid call parameters, redirect or show error
      router.push('/');
      return;
    }

    // Try to get thread data to get better names
    const thread = getThreadById(threadId);
    const otherParticipants = thread?.participants?.filter(
      (p: any) => p.id !== user?.id
    ) || [];
    const primaryParticipant = otherParticipants[0];
    const currentUserName = user?.user_metadata?.full_name || user?.email || 'You';

    setCallData({
      threadId,
      callType,
      callerName: isIncoming 
        ? (primaryParticipant?.name || callerName)
        : currentUserName,
      recipientName: isIncoming
        ? currentUserName
        : (primaryParticipant?.name || recipientName),
      isIncoming,
      roomId,
      token,
    });
  }, [searchParams, router, user, getThreadById]);

  const handleClose = () => {
    // Close the window when call ends
    if (typeof window !== 'undefined') {
      window.close();
      // If window.close() doesn't work (some browsers block it), redirect to home
      setTimeout(() => {
        router.push('/');
      }, 100);
    } else {
      router.push('/');
    }
  };

  if (!callData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <p>Loading call...</p>
        </div>
      </div>
    );
  }

  return (
    <VideoSDKCallInterface
      callType={callData.callType}
      callerName={callData.callerName}
      recipientName={callData.recipientName}
      isIncoming={callData.isIncoming}
      onCallEnd={handleClose}
      threadId={callData.threadId}
      currentUserId={user?.id}
      roomIdHint={callData.roomId}
      tokenHint={callData.token}
    />
  );
}
