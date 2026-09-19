'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParticipant } from '@videosdk.live/react-sdk';
import { MicOff } from '@/shared/icons';
import type { ConnectionQuality, NormalizedParticipant } from '@/features/video/core/models';
import { profileImageUrlFromMeta } from '@/features/video/core/utils/participantMeta';
import {
  inferSendQualityFromNetwork,
} from '@/features/video/services/adaptiveCallQuality';
import {
  mapRtcStatsToQuality,
  mapVideoSendQuality,
  worseConnectionQuality,
} from '@/features/video/core/utils/connectionQuality';
import VideoSDKParticipantMedia from '../components/ParticipantMedia';
import ParticipantTile from '@/features/video/ui/ParticipantTile';
import NetworkQualityIndicator from '@/features/video/ui/NetworkQualityIndicator';

function useVideoSDKConnectionQuality(
  participantId: string,
  isLocal: boolean,
  sendQuality: 'low' | 'med' | 'high' | undefined,
  getVideoStats?: () => Promise<unknown>,
  getAudioStats?: () => Promise<unknown>,
): ConnectionQuality {
  const [quality, setQuality] = useState<ConnectionQuality>(() =>
    isLocal ? mapVideoSendQuality(inferSendQualityFromNetwork()) : mapVideoSendQuality(sendQuality),
  );
  const statsRef = useRef({ isLocal, sendQuality, getVideoStats, getAudioStats });
  statsRef.current = { isLocal, sendQuality, getVideoStats, getAudioStats };

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const current = statsRef.current;
      let fromStats: ConnectionQuality = 'unknown';
      try {
        const [video, audio] = await Promise.all([
          current.getVideoStats?.() ?? Promise.resolve(undefined),
          current.getAudioStats?.() ?? Promise.resolve(undefined),
        ]);
        fromStats = worseConnectionQuality(
          mapRtcStatsToQuality(video as never),
          mapRtcStatsToQuality(audio as never),
        );
      } catch {
        fromStats = 'unknown';
      }

      const fromSend = mapVideoSendQuality(current.sendQuality);
      const fromNetwork = current.isLocal
        ? mapVideoSendQuality(inferSendQualityFromNetwork())
        : 'unknown';
      const next = worseConnectionQuality(worseConnectionQuality(fromStats, fromSend), fromNetwork);
      if (!cancelled) setQuality(next);
    };

    void poll();
    const intervalId = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [participantId]);

  return quality;
}

export function useVideoSDKNormalizedParticipant(
  participantId: string,
  isLocal = false,
  handRaised = false,
): NormalizedParticipant {
  const { micOn, webcamOn, displayName, isActiveSpeaker, participant, getVideoStats, getAudioStats } =
    useParticipant(participantId);
  const connectionQuality = useVideoSDKConnectionQuality(
    participantId,
    isLocal,
    participant?.quality,
    getVideoStats,
    getAudioStats,
  );

  return useMemo(
    () => ({
      id: participantId,
      displayName: displayName || 'Participant',
      isLocal,
      isMicOn: micOn,
      isCameraOn: webcamOn,
      isScreenSharing: false,
      isActiveSpeaker,
      avatarUrl: profileImageUrlFromMeta(participant?.metaData),
      handRaised,
      connectionQuality,
    }),
    [
      participantId,
      isLocal,
      micOn,
      webcamOn,
      displayName,
      isActiveSpeaker,
      participant?.metaData,
      handRaised,
      connectionQuality,
    ],
  );
}

export interface VideoSDKParticipantTileBridgeProps {
  participantId: string;
  isLocal?: boolean;
  audioOnly?: boolean;
  audioVolume?: number;
  tileCount?: number;
  showNameLabel?: boolean;
  handRaised?: boolean;
  onMute?: () => void;
}

/** Bridges VideoSDK SDK state into the unified ParticipantTile. */
export function VideoSDKParticipantTileBridge({
  participantId,
  isLocal = false,
  audioOnly = false,
  audioVolume = 0.85,
  tileCount = 1,
  showNameLabel = true,
  handRaised = false,
  onMute,
}: VideoSDKParticipantTileBridgeProps) {
  const normalized = useVideoSDKNormalizedParticipant(participantId, isLocal, handRaised);
  const { disableMic, micOn } = useParticipant(participantId);

  const media = (
    <VideoSDKParticipantMedia
      participantId={participantId}
      isLocal={isLocal}
      audioOnly={audioOnly}
      audioVolume={audioVolume}
    />
  );

  const handleMute = !isLocal
    ? () => {
        if (micOn) {
          try {
            disableMic();
          } catch {
            /* permission / teardown */
          }
        }
        onMute?.();
      }
    : undefined;

  return (
    <ParticipantTile
      participant={normalized}
      media={media}
      audioOnly={audioOnly}
      tileCount={tileCount}
      showNameLabel={showNameLabel}
      onMute={handleMute}
    />
  );
}

export function VideoSDKParticipantStatusChrome({
  participantId,
}: {
  participantId: string;
}) {
  const normalized = useVideoSDKNormalizedParticipant(participantId, false);
  if (normalized.isMicOn) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white shadow-md">
        <MicOff className="h-3 w-3" aria-hidden />
        Muted
      </span>
    </div>
  );
}

export function VideoSDKLocalNetworkChip({ participantId }: { participantId: string }) {
  const normalized = useVideoSDKNormalizedParticipant(participantId, true);
  return (
    <NetworkQualityIndicator
      quality={normalized.connectionQuality}
      size="md"
      embedded
      tone="onLight"
    />
  );
}

export default VideoSDKParticipantTileBridge;
