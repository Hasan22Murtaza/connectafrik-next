/**
 * LiveKitMeetingContainer — in-call experience for LiveKit-backed calls.
 * UI layout matches VideoSDK MeetingContainer (gradient, PiP, grid, overlays).
 */
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RoomAudioRenderer, useLocalParticipant, useParticipants, useRoomContext } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import { PhoneOff } from '@/shared/icons';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionIdFromAccessToken } from '@/shared/utils/sessionDeviceLabel';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';
import { patchCallSessionWithRetry, getLatestCallSession } from '@/features/chat/services/callSessionRealtime';
import { apiClient } from '@/lib/api-client';
import {
  stopAll as stopAllRingtones,
  playRingbackTone,
} from '@/features/video/services/ringtoneService';
import { useCallHeartbeat } from '@/shared/hooks/useCallHeartbeat';
import { useCallSessionSignaling } from '@/features/video/hooks/useCallSessionSignaling';
import { broadcastCallUiStatus } from '@/features/video/hooks/broadcastCallUiStatus';
import type { CallStatus, SpeakerLevel } from '@/features/video/core/types';
import { SPEAKER_VOLUMES } from '@/features/video/core/types';
import CallControls from '@/features/video/ui/CallControls';
import CallStatusOverlay from '@/features/video/ui/CallStatusOverlay';
import ScreenShareView from '@/features/video/ui/ScreenShareView';
import AddPeoplePanel from '@/features/video/ui/AddPeoplePanel';
import MessageInput from '@/features/video/ui/MessageInput';
import { LiveKitParticipantTileBridge, normalizeLiveKitParticipant } from '@/features/video/providers/livekit/components/ParticipantTileBridge';
import { LiveKitScreenShareMedia } from '@/features/video/providers/livekit/components/ScreenShareMedia';
import type { MeetingContainerProps } from '@/features/video/providers/videosdk/MeetingContainer';

// 5s used to auto-end on the last remote participant disappearing from the SDK's
// view was well inside normal mobile behaviour (Wi-Fi/LTE handover, a lift, a
// tunnel) and turned routine network blips into permanently ended calls. A
// genuine hang-up is handled immediately by ParticipantDisconnected + the
// server-confirm check below, so this fallback can afford to be far more
// patient.
const LAST_PARTICIPANT_AUTO_END_MS = 20000;
const CONNECTING_MEDIA_TO_CONNECTED_MS = 600;
const REJOIN_BACKOFF_MS = [1000, 3000, 7000];

const LiveKitMeetingContainer: React.FC<MeetingContainerProps> = ({
  isOpen,
  onClose,
  callType,
  isIncoming = false,
  onAccept,
  onCallEnd,
  threadId,
  currentUserId,
  roomIdHint,
  callIdHint,
  meetingId,
  resolvedCallerName,
  decodedCallerName,
  decodedRecipientName,
  decodedCallerAvatarUrl,
  decodedRecipientAvatarUrl,
  refreshToken,
  livekitServerUrl,
}) => {
  const { session, user } = useAuth();
  const room = useRoomContext();
  const {
    localParticipant: localParticipantInfo,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const participants = useParticipants();

  const callSessionDeviceFields = useMemo(() => {
    const id = getSessionIdFromAccessToken(session?.access_token ?? null);
    return id ? { device_session_id: id } : {};
  }, [session?.access_token]);

  const isIncomingRef = useRef(!!isIncoming);
  isIncomingRef.current = !!isIncoming;

  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState<SpeakerLevel>('normal');
  const [effectiveCallType, setEffectiveCallType] = useState<'audio' | 'video'>(callType);
  /** Incoming video upgrade request from remote participant (1:1). */
  const [pendingVideoRequest, setPendingVideoRequest] = useState<{ fromUserId: string } | null>(
    null,
  );
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [addPeopleSearch, setAddPeopleSearch] = useState('');
  const [addPeopleResults, setAddPeopleResults] = useState<any[]>([]);
  const [addPeopleBusyById, setAddPeopleBusyById] = useState<Record<string, boolean>>({});
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(0);
  const [pipTranslate, setPipTranslate] = useState({ tx: 0, ty: 0 });
  const [pipDragging, setPipDragging] = useState(false);
  const pipTranslateRef = useRef(pipTranslate);
  pipTranslateRef.current = pipTranslate;

  const isMountedRef = useRef(true);
  const callStatusRef = useRef<CallStatus>('connecting');
  const callIdRef = useRef(callIdHint || '');
  const callDurationRef = useRef(0);
  const ringbackRef = useRef<{ stop: () => void } | null>(null);
  const remoteDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEndCallRef = useRef<() => void>(() => {});
  const rejoiningRef = useRef(false);
  const hasSignaledJoinRef = useRef(false);
  const remoteScreenShareMarkerRef = useRef<MediaStream | null>(null);
  const meetingSurfaceRef = useRef<HTMLDivElement>(null);
  const pipWrapRef = useRef<HTMLDivElement>(null);
  const pipPointerIdRef = useRef<number | null>(null);
  const pipDragStartRef = useRef<{ cx: number; cy: number; tx: number; ty: number } | null>(null);
  const localWebcamOnRef = useRef(isCameraEnabled);
  localWebcamOnRef.current = isCameraEnabled;
  const localParticipantRef = useRef(localParticipantInfo);
  localParticipantRef.current = localParticipantInfo;

  const onVideoSwitch = useMemo(
    () => ({
      setEffectiveCallType,
      toggleWebcam: () => {
        const next = !localWebcamOnRef.current;
        void localParticipantRef.current.setCameraEnabled(next).catch(() => {
          /* permission / device errors surface via LiveKit */
        });
      },
      localWebcamOnRef,
      setPendingVideoRequest,
    }),
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const id = (callIdHint || '').trim();
    if (id) callIdRef.current = id;
  }, [callIdHint]);

  useEffect(() => {
    setEffectiveCallType(callType);
  }, [callType]);

  useCallHeartbeat({
    threadId,
    callId: callIdHint || '',
    // Previously gated on connected/connecting_media only, which switched the
    // heartbeat off in exactly the states where the call is struggling (e.g.
    // reconnecting) — right when the server's 90s reaper most needs to be held
    // back. Beat whenever the call surface is open and not terminal.
    enabled: isOpen && !!threadId && !!(callIdHint || '').trim() && callStatus !== 'ended',
  });

  const setCallStatusSafe = useCallback(
    (next: CallStatus) => {
      if (callStatusRef.current === next) return;
      if (next === 'connected' && !isIncomingRef.current) {
        const remoteCount = participants.filter(
          (p) => p.identity !== localParticipantInfo.identity,
        ).length;
        if (remoteCount < 1) return;
      }
      const prev = callStatusRef.current;
      callStatusRef.current = next;
      if (isMountedRef.current) setCallStatus(next);
      if (next === 'connected' && prev !== 'connected' && threadId) {
        broadcastCallUiStatus('active', threadId, callIdHint);
      }
    },
    [localParticipantInfo.identity, participants, threadId, callIdHint],
  );

  const signaling = useCallSessionSignaling({
    isOpen,
    threadId,
    currentUserId,
    callIdHint,
    roomIdHint,
    meetingId,
    isIncoming,
    callStatus,
    callStatusRef,
    setCallStatusSafe,
    callDurationRef,
    onClose,
    ringbackRef,
    onOutgoingRingTimeout: () => handleEndCallRef.current(),
    onVideoSwitch,
  });

  const {
    isGroupCallSession,
    isGroupCallSessionRef,
    suppressSignalRef,
    signalMediaDisconnected,
    signalCallTypeSwitch,
    broadcastEnded,
  } = signaling;

  const formatDuration = useCallback((secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const clearRemoteDisconnectTimer = useCallback(() => {
    if (remoteDisconnectTimerRef.current) {
      clearTimeout(remoteDisconnectTimerRef.current);
      remoteDisconnectTimerRef.current = null;
    }
  }, []);

  /**
   * Re-establish the LiveKit transport for a session the SERVER still
   * considers alive. Previously nothing existed to do this: a resync could
   * only confirm the call was over, never bring it back, so a recoverable
   * network blip (once LiveKit's own internal reconnect gave up and fired
   * Disconnected) became a dead call. Only meaningful once we were actually
   * in a live call — never fires while still connecting/ringing pre-answer.
   */
  const attemptRejoin = useCallback(async () => {
    if (rejoiningRef.current || !isMountedRef.current) return;
    if (!refreshToken || !livekitServerUrl) {
      void signalMediaDisconnected();
      return;
    }
    rejoiningRef.current = true;
    setCallStatusSafe('reconnecting');

    for (let attempt = 0; attempt < REJOIN_BACKOFF_MS.length; attempt++) {
      await new Promise((r) => setTimeout(r, REJOIN_BACKOFF_MS[attempt]));
      if (!isMountedRef.current || suppressSignalRef.current) {
        rejoiningRef.current = false;
        return;
      }
      try {
        const { token: freshToken } = await refreshToken();
        await room.connect(livekitServerUrl, freshToken);
        rejoiningRef.current = false;
        if (isMountedRef.current) {
          // `signalMeetingJoined` no-ops past the first join (hasSignaledJoinRef),
          // so RoomEvent.Connected won't restore status on a rejoin -- do it
          // here. Target connecting_media, not connected directly: the
          // existing promotion effect re-confirms remote participants are
          // actually present (avoids a race against `participants` not having
          // re-populated the instant `connect()` resolves).
          setCallStatusSafe('connecting_media');
        }
        return;
      } catch {
        // try the next backoff step
      }
    }

    rejoiningRef.current = false;
    if (!isMountedRef.current) return;
    void signalMediaDisconnected();
  }, [refreshToken, livekitServerUrl, room, setCallStatusSafe, signalMediaDisconnected, suppressSignalRef]);

  const scheduleAutoEndWhenAlone = useCallback(() => {
    if (remoteDisconnectTimerRef.current) return;
    remoteDisconnectTimerRef.current = setTimeout(async () => {
      remoteDisconnectTimerRef.current = null;
      if (!isMountedRef.current || callStatusRef.current !== 'connected') return;
      const remoteCount = participants.filter(
        (p) => p.identity !== localParticipantInfo.identity,
      ).length;
      if (remoteCount !== 0) return;

      const activeCallId = callIdRef.current || callIdHint || '';

      // Confirm with the server before declaring the call over: our local view
      // of zero remote participants can be OUR transport dying rather than the
      // call actually ending. If the server still lists other participants,
      // we are the one who fell off -- attempt to rejoin instead of ending a
      // call that is still live for everyone else.
      if (threadId && activeCallId) {
        const latest = await getLatestCallSession(threadId, activeCallId);
        if (!isMountedRef.current) return;
        if (latest && latest.status === 'active') {
          const others = latest.participants.filter((id) => id !== currentUserId);
          if (others.length > 0) {
            void attemptRejoin();
            return;
          }
        }
      }

      if (threadId && currentUserId && activeCallId) {
        const endEvent = isGroupCallSessionRef.current ? 'leave' : 'end';
        await patchCallSessionWithRetry(threadId, {
          call_id: activeCallId,
          event: endEvent,
          duration_seconds: callDurationRef.current,
        });
      }
      broadcastEnded();
      setCallStatusSafe('ended');
      setTimeout(() => {
        if (isMountedRef.current) onClose();
      }, 1000);
    }, LAST_PARTICIPANT_AUTO_END_MS);
  }, [
    attemptRejoin,
    callIdHint,
    currentUserId,
    localParticipantInfo.identity,
    onClose,
    participants,
    setCallStatusSafe,
    threadId,
  ]);

  const signalMeetingJoined = useCallback(() => {
    if (!isMountedRef.current || hasSignaledJoinRef.current) return;
    hasSignaledJoinRef.current = true;

    if (isIncomingRef.current) {
      setCallStatusSafe('connected');
      onAccept?.();
      const joinedCallId = callIdRef.current || callIdHint || '';
      if (threadId && currentUserId && joinedCallId) {
        void patchCallSessionWithRetry(threadId, {
          call_id: joinedCallId,
          event: 'accept',
          ...callSessionDeviceFields,
        });
      }
      return;
    }

    setCallStatusSafe('ringing');
    playRingbackTone().then((r) => {
      if (isMountedRef.current) ringbackRef.current = r;
    });
  }, [
    callIdHint,
    callSessionDeviceFields,
    currentUserId,
    onAccept,
    setCallStatusSafe,
    threadId,
  ]);

  useEffect(() => {
    if (!room) return;

    const onConnected = () => signalMeetingJoined();
    const onParticipantConnected = () => {
      clearRemoteDisconnectTimer();
      if (!isIncomingRef.current) {
        if (ringbackRef.current) {
          ringbackRef.current.stop();
          ringbackRef.current = null;
        }
        stopAllRingtones();
        if (
          callStatusRef.current === 'ringing' ||
          callStatusRef.current === 'connecting'
        ) {
          setCallStatusSafe('connecting_media');
        }
      }
    };
    const onParticipantDisconnected = () => {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        const remoteCount = participants.filter(
          (p) => p.identity !== localParticipantInfo.identity,
        ).length;
        if (remoteCount === 0 && callStatusRef.current === 'connected') {
          scheduleAutoEndWhenAlone();
        }
      }, 300);
    };
    // LiveKit's own engine already retries transient drops internally (ICE
    // restart/resume) before ever emitting Disconnected. Previously nothing
    // listened for Reconnecting/Reconnected, so the UI just sat frozen on
    // "Connected" during that window with no indication anything was wrong.
    const onReconnecting = () => {
      if (callStatusRef.current === 'connected' || callStatusRef.current === 'connecting_media') {
        setCallStatusSafe('reconnecting');
      }
    };
    const onReconnected = () => {
      // Target connecting_media (not the exact prior status) regardless of
      // what preceded reconnecting: the existing connecting_media -> connected
      // promotion effect below already re-confirms remote participants are
      // actually present before calling it connected, avoiding a race against
      // `participants` not having re-populated yet at the instant this fires.
      if (callStatusRef.current === 'reconnecting') {
        setCallStatusSafe('connecting_media');
      }
    };
    const onDisconnected = () => {
      // Disconnected means LiveKit's own reconnect attempts are exhausted (or
      // this was an explicit hangup, flagged via suppressSignalRef). Only try
      // our own app-level rejoin if we were actually in a live call —
      // otherwise fall back to the existing teardown/signaling path unchanged.
      const wasLive =
        callStatusRef.current === 'connected' ||
        callStatusRef.current === 'connecting_media' ||
        callStatusRef.current === 'reconnecting';
      if (!suppressSignalRef.current && wasLive) {
        void attemptRejoin();
      } else {
        void signalMediaDisconnected();
      }
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);

    if (room.state === 'connected') {
      signalMeetingJoined();
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [
    attemptRejoin,
    clearRemoteDisconnectTimer,
    localParticipantInfo.identity,
    participants,
    room,
    scheduleAutoEndWhenAlone,
    setCallStatusSafe,
    signalMeetingJoined,
    signalMediaDisconnected,
    suppressSignalRef,
  ]);

  // connecting_media → connected with short delay (matches VideoSDK)
  useEffect(() => {
    if (callStatus !== 'connecting_media') return;
    const remoteCount = participants.filter(
      (p) => p.identity !== localParticipantInfo.identity,
    ).length;
    if (remoteCount > 0) {
      const t = setTimeout(() => setCallStatusSafe('connected'), CONNECTING_MEDIA_TO_CONNECTED_MS);
      return () => clearTimeout(t);
    }
  }, [callStatus, participants, localParticipantInfo.identity, setCallStatusSafe]);

  useEffect(() => {
    if (!isIncomingRef.current) {
      const remoteCount = participants.filter(
        (p) => p.identity !== localParticipantInfo.identity,
      ).length;
      if (
        remoteCount > 0 &&
        (callStatusRef.current === 'ringing' || callStatusRef.current === 'connecting')
      ) {
        if (ringbackRef.current) {
          ringbackRef.current.stop();
          ringbackRef.current = null;
        }
        stopAllRingtones();
        setCallStatusSafe('connecting_media');
      }
    }
  }, [localParticipantInfo.identity, participants, setCallStatusSafe]);

  useEffect(() => {
    if (callStatus !== 'connected') return;
    const timer = setInterval(() => {
      callDurationRef.current += 1;
      if (isMountedRef.current) setCallDuration(callDurationRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  const isMuted = !isMicrophoneEnabled;
  const isVideoEnabled = isCameraEnabled;
  const isLocalPresenting = isScreenShareEnabled;
  const ensuredVideoPublishRef = useRef(false);

  // Ensure camera publishes on join for video calls (incoming accept can miss initial publish).
  useEffect(() => {
    if (!room || effectiveCallType !== 'video' || ensuredVideoPublishRef.current) return;

    const ensureCamera = () => {
      if (ensuredVideoPublishRef.current || !isMountedRef.current) return;
      ensuredVideoPublishRef.current = true;
      void localParticipantInfo.setCameraEnabled(true).catch(() => {
        ensuredVideoPublishRef.current = false;
      });
    };

    if (room.state === 'connected') {
      ensureCamera();
    }
    room.on(RoomEvent.Connected, ensureCamera);
    return () => {
      room.off(RoomEvent.Connected, ensureCamera);
    };
  }, [room, effectiveCallType, localParticipantInfo]);

  const handleToggleMute = useCallback(async () => {
    await localParticipantInfo.setMicrophoneEnabled(isMuted);
  }, [isMuted, localParticipantInfo]);

  const handleToggleVideo = useCallback(async () => {
    const remoteCount = participants.filter(
      (p) => p.identity !== localParticipantInfo.identity,
    ).length;

    // 1:1 audio → request consent before enabling video (matches VideoSDK path).
    if (effectiveCallType === 'audio') {
      if (!isGroupCallSessionRef.current && remoteCount === 1) {
        const ok = await signalCallTypeSwitch('request_video');
        if (ok) {
          toast('Waiting for the other person to accept video…');
        }
        return;
      }
      const ok = await signalCallTypeSwitch('switch_to_video');
      if (ok) {
        setEffectiveCallType('video');
        await localParticipantInfo.setCameraEnabled(true);
      }
      return;
    }

    if (isVideoEnabled) {
      await localParticipantInfo.setCameraEnabled(false);
      const ok = await signalCallTypeSwitch('switch_to_audio');
      if (ok) setEffectiveCallType('audio');
    } else {
      await localParticipantInfo.setCameraEnabled(true);
      const ok = await signalCallTypeSwitch('switch_to_video');
      if (ok) setEffectiveCallType('video');
    }
  }, [
    effectiveCallType,
    isVideoEnabled,
    localParticipantInfo,
    participants,
    signalCallTypeSwitch,
    isGroupCallSessionRef,
  ]);

  const handleAcceptVideoRequest = useCallback(async () => {
    const ok = await signalCallTypeSwitch('accept_video');
    if (ok) {
      setEffectiveCallType('video');
      setPendingVideoRequest(null);
      if (!isVideoEnabled) {
        await localParticipantInfo.setCameraEnabled(true);
      }
    }
  }, [signalCallTypeSwitch, isVideoEnabled, localParticipantInfo]);

  const handleDeclineVideoRequest = useCallback(async () => {
    await signalCallTypeSwitch('decline_video');
    setPendingVideoRequest(null);
  }, [signalCallTypeSwitch]);

  const handleToggleScreenShare = useCallback(async () => {
    await localParticipantInfo.setScreenShareEnabled(!isScreenShareEnabled);
  }, [isScreenShareEnabled, localParticipantInfo]);

  const handleToggleSpeaker = useCallback(() => {
    setSpeakerLevel((prev) => (prev === 'normal' ? 'loud' : prev === 'loud' ? 'low' : 'normal'));
  }, []);

  const handleEndCall = useCallback(async () => {
    const activeCallId = callIdRef.current || callIdHint || '';
    const activeRoomId = roomIdHint || meetingId;
    const isConnected =
      callStatusRef.current === 'connected' ||
      callStatusRef.current === 'connecting_media';
    const groupLeave = isGroupCallSessionRef.current && isConnected;

    if (threadId && currentUserId) {
      try {
        if (isConnected && activeCallId) {
          const ok = await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: groupLeave ? 'leave' : 'end',
            duration_seconds: callDurationRef.current,
          });
          if (ok && !groupLeave) {
            await supabaseMessagingService.sendMessage(
              threadId,
              {
                content: 'Call ended',
                message_type: 'ended',
                metadata: {
                  callType: effectiveCallType,
                  roomId: activeRoomId,
                  callId: activeCallId,
                  endedBy: currentUserId,
                  endedAt: new Date().toISOString(),
                },
              },
              { id: currentUserId, name: user?.user_metadata?.full_name || 'User' },
            );
          }
        } else if (!isIncomingRef.current && activeCallId) {
          const ok = await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: 'missed',
          });
          if (ok) {
            await supabaseMessagingService.sendMessage(
              threadId,
              {
                content: 'Missed call',
                message_type: 'missed',
                metadata: {
                  callType,
                  roomId: activeRoomId,
                  callId: activeCallId,
                  endedBy: currentUserId,
                  endedAt: new Date().toISOString(),
                },
              },
              { id: currentUserId, name: user?.user_metadata?.full_name || 'User' },
            );
          }
        } else if (isIncomingRef.current && activeCallId) {
          await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: 'declined',
            ...callSessionDeviceFields,
          });
        }
      } catch {
        /* ignore signaling errors */
      }
    }

    suppressSignalRef.current = true;
    broadcastEnded();
    onCallEnd?.();
    try {
      await room.disconnect();
    } catch {
      /* ignore */
    }
    setCallStatusSafe('ended');
    setTimeout(() => {
      if (isMountedRef.current) onClose();
    }, 1000);
  }, [
    callIdHint,
    roomIdHint,
    meetingId,
    callSessionDeviceFields,
    currentUserId,
    onCallEnd,
    onClose,
    room,
    setCallStatusSafe,
    threadId,
    effectiveCallType,
    callType,
    broadcastEnded,
    user,
  ]);

  handleEndCallRef.current = () => {
    void handleEndCall();
  };

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !threadId || !currentUserId) return;
    try {
      await supabaseMessagingService.sendMessage(
        threadId,
        { content: messageText.trim(), message_type: 'text' },
        { id: currentUserId, name: user?.user_metadata?.full_name || 'User' },
      );
      setMessageText('');
      setShowMessageInput(false);
    } catch {
      /* ignore */
    }
  }, [messageText, threadId, currentUserId, user]);

  const handleInviteToCall = useCallback(
    async (targetUser: { id: string; full_name: string; username: string }) => {
      if (!currentUserId || invitingUserId) return;
      const exclude = (callIdRef.current || callIdHint || '').trim();
      try {
        const busyRes = await apiClient.post<{ busy: Record<string, boolean> }>(
          '/api/videosdk/room',
          {
            busy_check: true,
            user_ids: [targetUser.id],
            ...(exclude ? { exclude_call_id: exclude } : {}),
          },
        );
        if (busyRes.busy?.[targetUser.id]) {
          toast.error('This person is already in another call.');
          return;
        }
      } catch {
        /* proceed */
      }
      setInvitingUserId(targetUser.id);
      try {
        const threadRes = await apiClient.post<{ data: { id: string } }>(
          '/api/chat/threads',
          { participant_ids: [targetUser.id], type: 'direct' },
        );
        const directThreadId = threadRes?.data?.id;
        if (!directThreadId) throw new Error('Thread not found');
        await apiClient.post(`/api/chat/threads/${directThreadId}/call-sessions`, {
          call_id: callIdRef.current || callIdHint || '',
          call_type: effectiveCallType,
          room_id: roomIdHint || meetingId,
          target_user_id: targetUser.id,
          is_group_call: true,
          caller_name: resolvedCallerName,
          provider: 'livekit',
        });
        setShowAddPeople(false);
        setAddPeopleSearch('');
        setAddPeopleResults([]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not add this person to the call.';
        toast.error(message);
      } finally {
        setInvitingUserId(null);
      }
    },
    [
      currentUserId,
      invitingUserId,
      callIdHint,
      effectiveCallType,
      roomIdHint,
      meetingId,
      resolvedCallerName,
    ],
  );

  useEffect(() => {
    if (!showAddPeople || !addPeopleSearch.trim() || addPeopleSearch.length < 2) {
      setAddPeopleResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: any[] }>('/api/users/search', {
          q: addPeopleSearch,
          limit: 10,
        });
        if (isMountedRef.current) {
          setAddPeopleResults((res?.data || []).filter((u: any) => u.id !== currentUserId));
        }
      } catch {
        setAddPeopleResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [addPeopleSearch, showAddPeople, currentUserId]);

  useEffect(() => {
    if (!showAddPeople || addPeopleResults.length === 0) {
      setAddPeopleBusyById({});
      return;
    }
    let cancelled = false;
    const ids = addPeopleResults.map((u: any) => u.id).filter(Boolean);
    const run = async () => {
      try {
        const exclude = (callIdRef.current || callIdHint || '').trim();
        const res = await apiClient.post<{ busy: Record<string, boolean> }>(
          '/api/videosdk/room',
          {
            busy_check: true,
            user_ids: ids,
            ...(exclude ? { exclude_call_id: exclude } : {}),
          },
        );
        if (!cancelled && res?.busy) setAddPeopleBusyById(res.busy);
      } catch {
        if (!cancelled) setAddPeopleBusyById({});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [showAddPeople, addPeopleResults, callIdHint]);

  const localId = localParticipantInfo.identity;
  const remoteParticipants = useMemo(
    () => participants.filter((p) => p.identity !== localId),
    [participants, localId],
  );
  const remoteParticipantIds = useMemo(
    () => remoteParticipants.map((p) => p.identity),
    [remoteParticipants],
  );

  const inCallUserIds = useMemo(() => {
    const s = new Set<string>();
    if (localId) s.add(localId);
    remoteParticipantIds.forEach((id) => s.add(id));
    return Array.from(s);
  }, [localId, remoteParticipantIds]);

  const renderLiveKitTile = useCallback(
    (participant: Participant, opts: { tileCount?: number; audioOnly?: boolean; audioVolume?: number; showNameLabel?: boolean; isLocal?: boolean }) => (
      <LiveKitParticipantTileBridge
        participant={participant}
        isLocal={opts.isLocal}
        audioOnly={opts.audioOnly}
        tileCount={opts.tileCount}
        showNameLabel={opts.showNameLabel}
        audioVolume={opts.audioVolume}
      />
    ),
    [],
  );

  const participantByIdentity = useMemo(() => {
    const map = new Map<string, Participant>();
    participants.forEach((p) => map.set(p.identity, p));
    return map;
  }, [participants]);

  const participantCount = remoteParticipantIds.length + 1;
  const isGroupCall = remoteParticipantIds.length > 1 || isGroupCallSession;

  const remoteScreenShareParticipant = useMemo(
    () =>
      remoteParticipants.find(
        (p) => !!p.getTrackPublication(Track.Source.ScreenShare)?.track,
      ) ?? null,
    [remoteParticipants],
  );

  const presenterName =
    remoteScreenShareParticipant?.name ||
    remoteScreenShareParticipant?.identity ||
    'Participant';

  if (remoteScreenShareParticipant && !remoteScreenShareMarkerRef.current) {
    remoteScreenShareMarkerRef.current = new MediaStream();
  } else if (!remoteScreenShareParticipant) {
    remoteScreenShareMarkerRef.current = null;
  }

  const audioVolume = SPEAKER_VOLUMES[speakerLevel];

  const gridLayout = useMemo(() => {
    if (remoteParticipantIds.length <= 1) return null;
    const MAX_PER_PAGE = 8;
    const pageCount = Math.max(1, Math.ceil(remoteParticipantIds.length / MAX_PER_PAGE));
    const pageIndex = Math.min(groupPage, pageCount - 1);
    const start = pageIndex * MAX_PER_PAGE;
    const visibleRemote = remoteParticipantIds.slice(start, start + MAX_PER_PAGE);
    const allTiles = localId ? [...visibleRemote, localId] : visibleRemote;
    const total = allTiles.length;
    const cols = total <= 2 ? 2 : total <= 4 ? 2 : total <= 9 ? 3 : 4;
    const rows = Math.ceil(total / cols);
    return { visibleRemote, allTiles, total, cols, rows, pageIndex, pageCount };
  }, [remoteParticipantIds, localId, groupPage]);

  useEffect(() => {
    setGroupPage(0);
  }, [remoteParticipantIds.length]);

  const clampPipTranslate = useCallback((tx: number, ty: number) => {
    const surface = meetingSurfaceRef.current;
    const pip = pipWrapRef.current;
    if (!surface || !pip) return { tx, ty };
    const sw = surface.clientWidth;
    const sh = surface.clientHeight;
    const pw = pip.offsetWidth;
    const ph = pip.offsetHeight;
    const m = 12;
    const baseLeft = sw - m - pw;
    const baseTop = m;
    const l = baseLeft + tx;
    const t = baseTop + ty;
    const cl = Math.min(Math.max(l, m), sw - m - pw);
    const ct = Math.min(Math.max(t, m), sh - m - ph);
    return { tx: cl - baseLeft, ty: ct - baseTop };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPipTranslate((p) => clampPipTranslate(p.tx, p.ty));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPipTranslate]);

  const onPipPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pipPointerIdRef.current = e.pointerId;
    setPipDragging(true);
    const p = pipTranslateRef.current;
    pipDragStartRef.current = { cx: e.clientX, cy: e.clientY, tx: p.tx, ty: p.ty };
  }, []);

  const onPipPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== pipPointerIdRef.current || !pipDragStartRef.current) return;
      const s = pipDragStartRef.current;
      const dx = e.clientX - s.cx;
      const dy = e.clientY - s.cy;
      setPipTranslate(clampPipTranslate(s.tx + dx, s.ty + dy));
    },
    [clampPipTranslate],
  );

  const onPipPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== pipPointerIdRef.current) return;
    pipPointerIdRef.current = null;
    pipDragStartRef.current = null;
    setPipDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const remoteOne = remoteParticipants[0] ?? null;
  const sidebarParticipants = useMemo(() => {
    const list = [...remoteParticipants];
    if (!list.some((p) => p.identity === localId)) {
      list.push(localParticipantInfo);
    }
    return list;
  }, [localId, localParticipantInfo, remoteParticipants]);

  return (
    <div className="w-full h-full overflow-hidden">
      <div
        ref={meetingSurfaceRef}
        className="relative w-full h-screen overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #ddd3c5 0%, #c7d9d1 100%)' }}
      >
        {/* Every remote participant's audio, mounted once, OUTSIDE every layout
            branch below. Pagination (MAX_PER_PAGE), screen share replacing the
            whole grid, and the 1:1 status/type gates all used to unmount
            per-tile <AudioTrack> elements, silencing anyone not on the visible
            page or tile even though they were still connected and talking.
            RoomAudioRenderer renders every subscribed remote audio track
            regardless of what's on screen, so none of those layout decisions
            can affect who is audible. */}
        <RoomAudioRenderer volume={audioVolume} />

        {(remoteScreenShareParticipant || isLocalPresenting) && (
          <ScreenShareView
            presenter={normalizeLiveKitParticipant(
              isLocalPresenting ? localParticipantInfo : remoteScreenShareParticipant!,
              isLocalPresenting,
              { isScreenSharing: true },
            )}
            presenterName={isLocalPresenting ? 'You' : presenterName}
            sidebarParticipants={sidebarParticipants
              .filter(
                (p) =>
                  p.identity !==
                  (isLocalPresenting
                    ? localParticipantInfo.identity
                    : remoteScreenShareParticipant?.identity),
              )
              .map((p) =>
                normalizeLiveKitParticipant(p, p.identity === localId),
              )}
            isLocalPresenting={isLocalPresenting}
            callDuration={callDuration}
            participantCount={participantCount}
            formatDuration={formatDuration}
            audioVolume={audioVolume}
            onStopSharing={handleToggleScreenShare}
            screenShareMedia={
              !isLocalPresenting && remoteScreenShareParticipant ? (
                <LiveKitScreenShareMedia presenter={remoteScreenShareParticipant} />
              ) : null
            }
            renderParticipantTile={(p, opts) => {
              const lkParticipant = participantByIdentity.get(p.id);
              if (!lkParticipant) return null;
              return renderLiveKitTile(lkParticipant, {
                isLocal: p.isLocal,
                tileCount: opts.tileCount,
                showNameLabel: true,
                audioVolume: opts.audioVolume,
              });
            }}
          />
        )}

        {/* 1-on-1 video fills the screen; audio is unconditional via
            RoomAudioRenderer above, so the audio call case needs no tile. */}
        {!gridLayout &&
          !remoteScreenShareParticipant &&
          remoteParticipantIds.length === 1 &&
          remoteOne &&
          effectiveCallType === 'video' &&
          (callStatus === 'connected' || callStatus === 'connecting_media') && (
            <div className="absolute inset-0">
              {renderLiveKitTile(remoteOne, {
                tileCount: 1,
                showNameLabel: false,
                audioVolume,
              })}
            </div>
          )}

        {gridLayout && !remoteScreenShareParticipant && (
          <div
            className="absolute inset-0 flex flex-wrap justify-center content-center p-1.5 sm:p-2 md:p-3"
            style={{
              gap: '4px',
              background: 'linear-gradient(135deg, #ddd3c5 0%, #c7d9d1 100%)',
            }}
          >
            {gridLayout.allTiles.map((identity) => {
              const p = participantByIdentity.get(identity);
              if (!p) return null;
              return (
                <div
                  key={identity}
                  className="relative overflow-hidden rounded-md sm:rounded-lg"
                  style={{
                    width: `calc(${100 / gridLayout.cols}% - 6px)`,
                    height: `calc(${100 / gridLayout.rows}% - 6px)`,
                    minHeight: 0,
                  }}
                >
                  {renderLiveKitTile(p, {
                    isLocal: identity === localId,
                    tileCount: gridLayout.total,
                    showNameLabel: true,
                    audioVolume,
                  })}
                </div>
              );
            })}

            {gridLayout.pageCount > 1 && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-black/60 text-white rounded-full px-2.5 py-1.5 backdrop-blur-sm border border-white/20">
                <button
                  onClick={() => setGroupPage((p) => Math.max(0, p - 1))}
                  disabled={gridLayout.pageIndex === 0}
                  className="text-xs px-2 py-0.5 rounded bg-surface/10 hover:bg-surface/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  Prev
                </button>
                <span className="text-xs tabular-nums">
                  {gridLayout.pageIndex + 1}/{gridLayout.pageCount}
                </span>
                <button
                  onClick={() =>
                    setGroupPage((p) => Math.min(gridLayout.pageCount - 1, p + 1))
                  }
                  disabled={gridLayout.pageIndex >= gridLayout.pageCount - 1}
                  className="text-xs px-2 py-0.5 rounded bg-surface/10 hover:bg-surface/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {localId &&
          effectiveCallType === 'video' &&
          !gridLayout &&
          !remoteScreenShareParticipant &&
          isVideoEnabled &&
          callStatus === 'connected' && (
            <div
              ref={pipWrapRef}
              role="region"
              aria-label="Your camera preview — drag to move on screen"
              title="Drag to move"
              className={`absolute top-3 right-3 z-20 w-20 h-28 touch-none select-none rounded-lg border border-white shadow-xl ring-1 ring-white/20 sm:h-32 sm:w-24 md:h-44 md:w-32 sm:border-2 ${
                pipDragging
                  ? 'cursor-grabbing overflow-hidden'
                  : 'cursor-grab overflow-hidden transition-transform duration-200 hover:scale-105'
              }`}
              style={{
                transform: `translate3d(${pipTranslate.tx}px, ${pipTranslate.ty}px, 0)`,
              }}
              onPointerDown={onPipPointerDown}
              onPointerMove={onPipPointerMove}
              onPointerUp={onPipPointerUp}
              onPointerCancel={onPipPointerUp}
            >
              {renderLiveKitTile(localParticipantInfo, {
                isLocal: true,
                tileCount: 2,
                showNameLabel: false,
                audioVolume: 0,
              })}
            </div>
          )}


        <CallStatusOverlay
          callStatus={callStatus}
          callType={effectiveCallType}
          callDuration={callDuration}
          formatDuration={formatDuration}
          isIncoming={isIncoming}
          decodedCallerName={decodedCallerName}
          decodedRecipientName={decodedRecipientName}
          decodedCallerAvatarUrl={decodedCallerAvatarUrl}
          decodedRecipientAvatarUrl={decodedRecipientAvatarUrl}
          isScreenSharing={isLocalPresenting}
          remoteScreenShareStream={null}
          showConnectedGroupGallery={!!gridLayout && callStatus === 'connected'}
        />

        {callStatus === 'ringing' && !isIncoming && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-6 sm:pb-8 mb-20 sm:mb-0 z-30 pointer-events-auto">
            <button
              onClick={handleEndCall}
              className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
              aria-label="Drop call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Video upgrade confirmation prompt (1:1) — same UX as VideoSDK */}
        {pendingVideoRequest && callStatus === 'connected' && (
          <div className="absolute inset-x-0 top-16 z-40 flex justify-center px-4">
            <div className="bg-black/80 backdrop-blur-md text-white rounded-2xl px-5 py-4 shadow-2xl border border-white/20 max-w-sm w-full text-center">
              <p className="text-sm font-medium mb-3">Switch to video call?</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => void handleDeclineVideoRequest()}
                  className="px-4 py-2 rounded-full bg-surface/20 hover:bg-surface/30 text-sm font-medium transition"
                >
                  Decline
                </button>
                <button
                  onClick={() => void handleAcceptVideoRequest()}
                  className="px-4 py-2 rounded-full bg-primary-500 hover:bg-primary-600 text-sm font-medium transition"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        )}

        {callStatus === 'connected' && (
          <CallControls
            isMuted={isMuted}
            isVideoEnabled={isVideoEnabled}
            isScreenSharing={isLocalPresenting}
            remoteScreenShareStream={remoteScreenShareMarkerRef.current}
            screenShareParticipantName={presenterName}
            speakerLevel={speakerLevel}
            callType={effectiveCallType}
            showMessageInput={showMessageInput}
            showAddPeople={showAddPeople}
            onToggleMute={handleToggleMute}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
            onToggleSpeaker={handleToggleSpeaker}
            onToggleMessageInput={() => setShowMessageInput((v) => !v)}
            onToggleAddPeople={() => setShowAddPeople((v) => !v)}
            onEndCall={handleEndCall}
            isGroupCall={isGroupCall}
          />
        )}
      </div>

      {showAddPeople && (
        <AddPeoplePanel
          addPeopleSearch={addPeopleSearch}
          addPeopleResults={addPeopleResults}
          participants={remoteParticipants.map((p) => ({
            id: p.identity,
            displayName: p.name || p.identity,
          }))}
          inCallUserIds={inCallUserIds}
          busyByUserId={addPeopleBusyById}
          invitingUserId={invitingUserId}
          onSearchChange={setAddPeopleSearch}
          onClose={() => {
            setShowAddPeople(false);
            setAddPeopleSearch('');
            setAddPeopleBusyById({});
          }}
          onInvite={handleInviteToCall}
        />
      )}

      {callStatus === 'connected' && showMessageInput && (
        <div className="p-2 sm:p-3 md:p-4">
          <MessageInput
            messageText={messageText}
            onMessageChange={setMessageText}
            onSend={handleSendMessage}
            onClose={() => {
              setShowMessageInput(false);
              setMessageText('');
            }}
          />
        </div>
      )}

      <div className="sr-only" aria-hidden>
        {resolvedCallerName} · {meetingId} · {roomIdHint || meetingId}
      </div>
    </div>
  );
};

export default LiveKitMeetingContainer;

