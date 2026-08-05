'use client';

/**
 * Unified meeting entry — selects the correct provider runtime.
 * Provider SDK wrappers (MeetingProvider / LiveKitRoom) live in CallModal.
 */
import React from 'react';
import type { CallMediaProviderName } from '@/lib/call-media/types';
import VideoSDKMeetingContainer from '@/features/video/providers/videosdk/MeetingContainer';
import LiveKitMeetingContainer from '@/features/video/providers/livekit/MeetingContainer';
import type { MeetingContainerProps } from '@/features/video/providers/videosdk/MeetingContainer';

export type { MeetingContainerProps };

export interface UnifiedMeetingContainerProps extends MeetingContainerProps {
  provider: CallMediaProviderName;
}

const MeetingContainer: React.FC<UnifiedMeetingContainerProps> = ({
  provider,
  ...props
}) => {
  if (provider === 'livekit') {
    return <LiveKitMeetingContainer {...props} />;
  }
  return <VideoSDKMeetingContainer {...props} />;
};

export default MeetingContainer;
