/**
 * useVideoCall - Custom hook encapsulating all video call state, effects, and handlers.
 *
 * This is the "brain" of the video call modal. All stateful logic lives here;
 * the UI components are pure presentational wrappers that receive data & callbacks.
 */
import { useAuth } from '@/contexts/AuthContext';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';
import { callSessionRowToPollTerminalMessage, toCallSessionStatusMessageType } from '@/features/chat/services/callSessionRealtime';
import { stopAll as stopAllRingtones, playRingtone, playRingbackTone } from '@/features/video/services/ringtoneService';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api-client';
import { videoSDKWebRTCManager } from '@/lib/videosdk-webrtc';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CallStatus, SpeakerLevel, VideoSDKCallModalProps } from './types';
import { SPEAKER_VOLUMES } from './types';

function broadcastCallUiStatus(status: 'active' | 'ended', threadId: string | undefined) {
  if (typeof window === 'undefined' || !threadId) return;
  const payload = { type: 'CALL_STATUS', status, threadId };
  try {
    window.postMessage(payload, window.location.origin);
  } catch {
    /* ignore */
  }
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
    }
  } catch {
    /* ignore */
  }
}

export function useVideoCall(props: VideoSDKCallModalProps) {
  const {
    isOpen,
    onClose,
    callType,
    callerName,
    recipientName,
    callerAvatarUrl,
    recipientAvatarUrl,
    isGroupCallHint = false,
    isIncoming = false,
    onAccept,
    onReject,
    onCallEnd,
    threadId,
    currentUserId,
    roomIdHint,
    tokenHint,
    callIdHint,
  } = props;

  const { user } = useAuth();

  // --- Derived values ---
  const safeDecode = (str: string): string => {
    try {
      return decodeURIComponent(str || 'Unknown');
    } catch {
      return str || 'Unknown';
    }
  };
  const decodedCallerName = safeDecode(callerName);
  const decodedRecipientName = safeDecode(recipientName);
  const decodedCallerAvatarUrl = callerAvatarUrl ? safeDecode(callerAvatarUrl) : '';
  const decodedRecipientAvatarUrl = recipientAvatarUrl ? safeDecode(recipientAvatarUrl) : '';

  /** Display name for signaling when auth user_metadata.full_name is often empty (matches chat / call window). */
  const resolvedSignalingCallerName = useMemo(() => {
    const fromUrl = decodedCallerName.trim();
    if (fromUrl && fromUrl.toLowerCase() !== 'unknown') return fromUrl;
    const meta = user?.user_metadata as Record<string, string | undefined> | undefined;
    const fromMeta =
      meta?.full_name?.trim() ||
      meta?.name?.trim() ||
      meta?.display_name?.trim() ||
      meta?.preferred_username?.trim();
    if (fromMeta) return fromMeta;
    const email = user?.email?.trim();
    if (email?.includes('@')) return email.split('@')[0] || 'Someone';
    return 'Someone';
  }, [decodedCallerName, user]);

  const resolvedSignalingCallerAvatarUrl = useMemo(() => {
    const u = decodedCallerAvatarUrl.trim();
    if (u) return u;
    const meta = user?.user_metadata as Record<string, string | undefined> | undefined;
    return (meta?.avatar_url?.trim() || '');
  }, [decodedCallerAvatarUrl, user]);

  // --- State ---
  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [speakerLevel, setSpeakerLevel] = useState<SpeakerLevel>('normal');
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [currentCallId, setCurrentCallId] = useState<string>(callIdHint || '');
  const [error, setError] = useState<string>('');
  const [participants, setParticipants] = useState<any[]>([]);
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isAcceptingCall, setIsAcceptingCall] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [remoteScreenShareStream, setRemoteScreenShareStream] = useState<MediaStream | null>(null);
  const [screenShareParticipantName, setScreenShareParticipantName] = useState<string>('');
  const [participantVideoMap, setParticipantVideoMap] = useState<Map<string, MediaStream>>(new Map());
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [addPeopleSearch, setAddPeopleSearch] = useState('');
  const [addPeopleResults, setAddPeopleResults] = useState<any[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [visibleRemoteParticipantIds, setVisibleRemoteParticipantIds] = useState<string[]>([]);
  // --- Refs ---
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const participantVideoMapRef = useRef<Map<string, MediaStream>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<MediaStream[]>([]);
  const hasInitializedRef = useRef(false);
  const isMountedRef = useRef(false);
  const currentMeetingRef = useRef<any>(null);
  const callStatusRef = useRef<CallStatus>('connecting');
  const callIdRef = useRef<string>(callIdHint || '');
  const videoSDKModuleRef = useRef<{ VideoSDK: any } | null>(null);
  const speakerLevelRef = useRef<SpeakerLevel>(speakerLevel);
  const hasUpgradedVideoQualityRef = useRef(false);
  const firstRemoteTrackLoggedRef = useRef(false);
  const isGroupSessionRef = useRef(false);
  const suppressMeetingLeftSignalRef = useRef(false);
  const remoteTerminalSignalReceivedRef = useRef(false);
  const callDurationRef = useRef(0);
  const participantQualityRef = useRef<Map<string, 'high' | 'med' | 'low'>>(new Map());
  const participantPausedRef = useRef<Map<string, boolean>>(new Map());
  const presenterParticipantIdRef = useRef<string | null>(null);

  // --- Helpers ---
  const getMeetingParticipants = useCallback((meetingParticipants: any): any[] => {
    if (!meetingParticipants) return [];
    if (meetingParticipants instanceof Map) return Array.from(meetingParticipants.values());
    if (typeof meetingParticipants.values === 'function') {
      try { return Array.from(meetingParticipants.values()); } catch { /* fall through */ }
    }
    if (typeof meetingParticipants === 'object') return Object.values(meetingParticipants);
    return [];
  }, []);

  const getParticipantCount = useCallback((): number => {
    let count = participants.length + 1;
    if (currentMeetingRef.current) {
      try {
        const meeting = currentMeetingRef.current;
        const localId = meeting.localParticipant?.id;
        const all = getMeetingParticipants(meeting.participants);
        if (all.length > 0) {
          const remoteCount = all.filter((p: any) => p.id !== localId).length;
          count = Math.max(count, remoteCount + 1);
        }
      } catch { /* fallback already set */ }
    }
    return Math.max(count, 1);
  }, [participants, getMeetingParticipants]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Sync refs with state ---
  useEffect(() => { speakerLevelRef.current = speakerLevel; }, [speakerLevel]);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);
  useEffect(() => { callIdRef.current = currentCallId; }, [currentCallId]);
  useEffect(() => {
    if (isGroupCallHint) {
      isGroupSessionRef.current = true;
    }
  }, [isGroupCallHint]);
  useEffect(() => {
    if (callIdHint && callIdHint !== callIdRef.current) {
      setCurrentCallId(callIdHint);
      callIdRef.current = callIdHint;
    }
  }, [callIdHint]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const createCallId = useCallback(() => {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const getOrCreateCallId = useCallback(() => {
    if (callIdRef.current) return callIdRef.current;
    const generated = createCallId();
    callIdRef.current = generated;
    if (isMountedRef.current) setCurrentCallId(generated);
    return generated;
  }, [createCallId]);

  const clearRemoteDisconnectTimer = useCallback(() => {
    if (remoteDisconnectTimerRef.current) {
      clearTimeout(remoteDisconnectTimerRef.current);
      remoteDisconnectTimerRef.current = null;
    }
  }, []);

  const setCallStatusIfChanged = useCallback((next: CallStatus) => {
    if (callStatusRef.current === next) return;
    callStatusRef.current = next;
    if (isMountedRef.current) setCallStatus(next);
  }, []);

  const setMediaConnectingStatus = useCallback(() => {
    if (callStatusRef.current === 'ended' || callStatusRef.current === 'connected') return;
    setCallStatusIfChanged('connecting_media');
  }, [setCallStatusIfChanged]);

  const setConnectedWhenMediaReady = useCallback(() => {
    if (callStatusRef.current === 'ended') return;
    setCallStatusIfChanged('connected');
  }, [setCallStatusIfChanged]);

  /** When UI ref lags, DB `call_sessions.status` is authoritative (e.g. active after accept). */
  const resolveCallSessionPhase = useCallback(async (): Promise<'active' | 'terminal' | 'ringing_like'> => {
    const cid = callIdRef.current || callIdHint || '';
    if (!threadId || !cid) return 'ringing_like';
    try {
      const res = await apiClient.get<{ session: { status?: string } | null }>(
        `/api/chat/threads/${threadId}/call-sessions`,
        { call_id: cid }
      );
      const st = String(res?.session?.status || '').trim();
      if (st === 'active') return 'active';
      if (st === 'ended' || st === 'declined' || st === 'missed' || st === 'failed') return 'terminal';
    } catch {
      /* ignore */
    }
    return 'ringing_like';
  }, [threadId, callIdHint]);

  const markConnectionMetric = useCallback((event: string, extra?: Record<string, unknown>) => {
    console.info('[call-telemetry]', {
      event,
      ts: Date.now(),
      callId: callIdRef.current || callIdHint || '',
      roomId: roomId || roomIdHint || '',
      isIncoming,
      ...extra,
    });
  }, [callIdHint, roomId, roomIdHint, isIncoming]);

  const getConnectionStrategy = useCallback(() => {
    const joinTimeout = Number(process.env.NEXT_PUBLIC_CALL_JOIN_TIMEOUT_MS || '30000');
    const tokenRetries = Number(process.env.NEXT_PUBLIC_CALL_TOKEN_RETRY_COUNT || '1');
    const tokenRetryDelay = Number(process.env.NEXT_PUBLIC_CALL_TOKEN_RETRY_DELAY_MS || '400');
    return {
      joinTimeoutMs: Number.isFinite(joinTimeout) && joinTimeout > 0 ? joinTimeout : 30000,
      tokenRetryCount: Number.isFinite(tokenRetries) && tokenRetries >= 0 ? tokenRetries : 1,
      tokenRetryDelayMs: Number.isFinite(tokenRetryDelay) && tokenRetryDelay >= 0 ? tokenRetryDelay : 400,
    };
  }, []);

  const normalizeSignalMeta = useCallback((rawMeta: unknown): Record<string, any> => {
    if (!rawMeta) return {};
    if (typeof rawMeta === 'string') {
      try {
        const parsed = JSON.parse(rawMeta);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : {};
      } catch {
        return {};
      }
    }
    if (typeof rawMeta === 'object') return rawMeta as Record<string, any>;
    return {};
  }, []);

  const shouldHandleSignal = useCallback((msg: any, expectedType?: string) => {
    if (!msg || !threadId) return false;
    if (expectedType && msg.message_type !== expectedType) return false;
    if (msg.thread_id && msg.thread_id !== threadId) return false;
    if (msg.sender_id && currentUserId && msg.sender_id === currentUserId) return false;
    const meta = normalizeSignalMeta(msg.metadata);
    const activeCallId = callIdRef.current;
    const activeRoomId = roomId || roomIdHint || '';
    if (activeCallId && meta.callId && meta.callId !== activeCallId) return false;
    if (activeRoomId && meta.roomId && meta.roomId !== activeRoomId) return false;
    return true;
  }, [threadId, currentUserId, roomId, roomIdHint, normalizeSignalMeta]);

  const matchesActiveCallMeta = useCallback((meta: Record<string, any>) => {
    const normalized = normalizeSignalMeta(meta);
    const activeCallId = callIdRef.current;
    const activeRoomId = roomId || roomIdHint || '';
    if (activeCallId && normalized.callId && normalized.callId !== activeCallId) return false;
    if (activeRoomId && normalized.roomId && normalized.roomId !== activeRoomId) return false;
    return true;
  }, [roomId, roomIdHint, normalizeSignalMeta]);

  // Preload VideoSDK when modal opens
  useEffect(() => {
    if (isOpen && !videoSDKModuleRef.current) {
      import('@videosdk.live/js-sdk').then((mod) => {
        videoSDKModuleRef.current = mod;
      }).catch(() => {});
    }
  }, [isOpen]);

  // --- Stream helpers ---
  const updateLocalStream = useCallback((stream: MediaStream | null) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  }, []);

  const updateRemoteStreams = useCallback((updater: (prev: MediaStream[]) => MediaStream[]) => {
    setRemoteStreams((prev) => {
      const next = updater(prev);
      remoteStreamsRef.current = next;
      return next;
    });
  }, []);

  const addRemoteStream = (stream: MediaStream) => {
    updateRemoteStreams((prev) => {
      const newTracks = [...stream.getAudioTracks(), ...stream.getVideoTracks()];
      const newTrackIds = new Set(newTracks.map(t => t.id));
      const hasDuplicate = prev.some(existing => {
        const existingTracks = [...existing.getAudioTracks(), ...existing.getVideoTracks()];
        return existingTracks.some(track => newTrackIds.has(track.id));
      });
      if (hasDuplicate) return prev;
      const existingIndex = prev.findIndex((existing) => existing.id === stream.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = stream;
        return next;
      }
      return [...prev, stream];
    });
  };

  const removeRemoteStream = (trackId: string) => {
    updateRemoteStreams((prev) => {
      return prev.filter((stream) => {
        const allTracks = [...stream.getAudioTracks(), ...stream.getVideoTracks()];
        return !allTracks.some(track => track.id === trackId);
      });
    });
  };

  // --- Cleanup ---
  const cleanupResources = useCallback(() => {
    if (typeof window !== 'undefined' && threadId && callStatusRef.current !== 'ended') {
      broadcastCallUiStatus('ended', threadId);
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    clearRemoteDisconnectTimer();
    if (ringtoneRef.current) {
      try { ringtoneRef.current.stop(); } catch {}
      ringtoneRef.current = null;
    }
    stopAllRingtones();
    if (currentMeetingRef.current) {
      try { currentMeetingRef.current.disableScreenShare(); } catch {}
      try { currentMeetingRef.current.leave(); } catch {}
      currentMeetingRef.current = null;
    }
    setIsScreenSharing(false);
    setScreenShareStream(null);
    setRemoteScreenShareStream(null);
    setScreenShareParticipantName('');
    const currentLocalStream = localStreamRef.current;
    if (currentLocalStream) {
      try { currentLocalStream.getTracks().forEach((track) => track.stop()); } catch {}
      localStreamRef.current = null;
    }
    if (isMountedRef.current) updateLocalStream(null);
    if (remoteStreamsRef.current.length) {
      remoteStreamsRef.current.forEach((stream) => {
        try { stream.getTracks().forEach((track) => track.stop()); } catch {}
      });
      remoteStreamsRef.current = [];
    }
    if (isMountedRef.current) updateRemoteStreams(() => []);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    try {
      videoSDKWebRTCManager.leaveMeeting();
      videoSDKWebRTCManager.setLocalStream(null);
    } catch {}
    if (isMountedRef.current) {
      setParticipants([]);
      participantVideoMapRef.current.clear();
      setParticipantVideoMap(new Map());
      setCallStatusIfChanged('ended');
      setRoomId('');
      setCurrentCallId(callIdHint || '');
      setError('');
    }
    hasUpgradedVideoQualityRef.current = false;
    firstRemoteTrackLoggedRef.current = false;
    isGroupSessionRef.current = false;
    participantQualityRef.current.clear();
    participantPausedRef.current.clear();
    presenterParticipantIdRef.current = null;
    callIdRef.current = callIdHint || '';
    hasInitializedRef.current = false;
  }, [updateLocalStream, updateRemoteStreams, clearRemoteDisconnectTimer, callIdHint, threadId, setCallStatusIfChanged]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasInitializedRef.current || currentMeetingRef.current) {
        cleanupResources();
      }
    };
  }, [cleanupResources]);

  // --- Shared: subscribe to a participant's streams ---
  const subscribeParticipantStreams = (participant: any) => {
    if (participant.on) {
      participant.on("stream-enabled", (stream: any) => {
        if (!isMountedRef.current) return;
        if (!firstRemoteTrackLoggedRef.current && stream?.track) {
          firstRemoteTrackLoggedRef.current = true;
          markConnectionMetric('first_remote_track', { kind: stream.kind || 'unknown' });
          setConnectedWhenMediaReady();
        }
        if (stream.kind === 'video' && stream.track) {
          const videoStream = new MediaStream([stream.track]);
          participantVideoMapRef.current.set(participant.id, videoStream);
          setParticipantVideoMap(new Map(participantVideoMapRef.current));
          addRemoteStream(videoStream);
          if (remoteVideoRef.current && callType === 'video') {
            remoteVideoRef.current.srcObject = videoStream;
            remoteVideoRef.current.play().catch(() => {});
          }
        } else if (stream.kind === 'audio' && stream.track) {
          addRemoteStream(new MediaStream([stream.track]));
        } else if (stream.kind === 'share' && stream.track) {
          setRemoteScreenShareStream(new MediaStream([stream.track]));
          setScreenShareParticipantName(participant.displayName || 'Participant');
        }
      });

      participant.on("stream-disabled", (stream: any) => {
        if (!isMountedRef.current) return;
        if (stream.track) removeRemoteStream(stream.track.id);
        if (stream.kind === 'video') {
          participantVideoMapRef.current.delete(participant.id);
          setParticipantVideoMap(new Map(participantVideoMapRef.current));
        }
        if (stream.kind === 'share') {
          setRemoteScreenShareStream(null);
          setScreenShareParticipantName('');
        }
      });
    }

    // Check existing streams
    try {
      const streams = participant.streams;
      if (streams) {
        const entries = streams instanceof Map ? Array.from(streams.values()) : Object.values(streams);
        for (const s of entries as any[]) {
          if (!firstRemoteTrackLoggedRef.current && s?.track) {
            firstRemoteTrackLoggedRef.current = true;
            markConnectionMetric('first_remote_track', { kind: s.kind || 'unknown', source: 'existing_streams' });
            setConnectedWhenMediaReady();
          }
          if (s.kind === 'video' && s.track) {
            const stream = new MediaStream([s.track]);
            participantVideoMapRef.current.set(participant.id, stream);
            setParticipantVideoMap(new Map(participantVideoMapRef.current));
            addRemoteStream(stream);
            if (remoteVideoRef.current && callType === 'video') {
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current.play().catch(() => {});
            }
          } else if (s.kind === 'audio' && s.track) {
            addRemoteStream(new MediaStream([s.track]));
          } else if (s.kind === 'share' && s.track) {
            setRemoteScreenShareStream(new MediaStream([s.track]));
            setScreenShareParticipantName(participant.displayName || 'Participant');
          }
        }
      }
    } catch {}

    // Fallback for older SDK
    const videoStreams = participant.getVideoStreams?.() || [];
    videoStreams.forEach((vs: any) => {
      if (vs.track) {
        if (!firstRemoteTrackLoggedRef.current) {
          firstRemoteTrackLoggedRef.current = true;
          markConnectionMetric('first_remote_track', { kind: 'video', source: 'legacy_video_streams' });
          setConnectedWhenMediaReady();
        }
        const stream = new MediaStream([vs.track]);
        addRemoteStream(stream);
        if (remoteVideoRef.current && callType === 'video') {
          remoteVideoRef.current.srcObject = stream;
        }
      }
    });
  };

  const syncExistingParticipants = (meeting: any) => {
    try {
      const localParticipantId = meeting.localParticipant?.id;
      const allParticipants = getMeetingParticipants(meeting.participants);
      const existing = allParticipants.filter((p: any) => p.id !== localParticipantId);
      if (existing.length === 0) return;
      if (existing.length > 1) {
        isGroupSessionRef.current = true;
      }

      setParticipants((prev) => {
        const updated = [...prev];
        existing.forEach((participant: any) => {
          if (!updated.find((x: any) => x.id === participant.id)) {
            updated.push(participant);
            try { subscribeParticipantStreams(participant); } catch {}
          }
        });
        return updated;
      });
    } catch {}
  };

  const refreshRemoteTracksFromMeeting = useCallback((meeting: any) => {
    try {
      const localParticipantId = meeting.localParticipant?.id;
      const allParticipants = getMeetingParticipants(meeting.participants).filter((pt: any) => pt.id !== localParticipantId);

      const nextVideoMap = new Map<string, MediaStream>();
      const nextStreams: MediaStream[] = [];

      allParticipants.forEach((participant: any) => {
        const streams = participant?.streams;
        const entries = streams instanceof Map ? Array.from(streams.values()) : streams && typeof streams === 'object' ? Object.values(streams) : [];
        entries.forEach((s: any) => {
          const track = s?.track;
          if (!track || track.readyState !== 'live') return;
          if (s.kind === 'video') {
            const ms = new MediaStream([track]);
            nextVideoMap.set(participant.id, ms);
            nextStreams.push(ms);
          } else if (s.kind === 'audio') {
            nextStreams.push(new MediaStream([track]));
          }
        });
      });

      participantVideoMapRef.current = nextVideoMap;
      setParticipantVideoMap(new Map(nextVideoMap));
      updateRemoteStreams(() => nextStreams);
    } catch {}
  }, [getMeetingParticipants, updateRemoteStreams]);

  // --- Shared: set up presenter-changed handler ---
  const setupPresenterChanged = (meeting: any) => {
    meeting.on("presenter-changed", (presenterId: string | null) => {
      if (!isMountedRef.current) return;
      presenterParticipantIdRef.current = presenterId;
      if (!presenterId) {
        setRemoteScreenShareStream(null);
        setScreenShareParticipantName('');
        return;
      }
      const localId = meeting.localParticipant?.id;
      if (presenterId === localId) return;
      const presenter = meeting.participants?.get?.(presenterId);
      if (presenter) {
        setScreenShareParticipantName(presenter.displayName || 'Participant');
        try {
          const streams = presenter.streams;
          if (streams) {
            const entries = streams instanceof Map ? Array.from(streams.values()) : Object.values(streams);
            for (const s of entries as any[]) {
              if (s.kind === 'share' && s.track) {
                setRemoteScreenShareStream(new MediaStream([s.track]));
                break;
              }
            }
          }
        } catch {}
        if (presenter.on) {
          presenter.on("stream-enabled", (stream: any) => {
            if (!isMountedRef.current) return;
            if (stream.kind === 'share' && stream.track) {
              setRemoteScreenShareStream(new MediaStream([stream.track]));
            }
          });
          presenter.on("stream-disabled", (stream: any) => {
            if (!isMountedRef.current) return;
            if (stream.kind === 'share') {
              setRemoteScreenShareStream(null);
              setScreenShareParticipantName('');
            }
          });
        }
      }
    });
  };

  // --- Shared: set up local stream listeners ---
  const setupLocalStreamListeners = (meeting: any) => {
    const localParticipant = meeting.localParticipant;
    if (!localParticipant) return;
    if (localParticipant.on) {
      localParticipant.on("stream-enabled", (stream: any) => {
        if (stream.kind === 'video' && callType === 'video' && stream.track) {
          const newVideoStream = new MediaStream([stream.track]);
          if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            audioTracks.forEach(track => {
              if (track.readyState !== 'ended') newVideoStream.addTrack(track);
            });
          }
          updateLocalStream(newVideoStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = newVideoStream;
            localVideoRef.current.play().catch(() => {});
          }
        }
      });
      localParticipant.on("stream-disabled", (stream: any) => {
        if (stream.kind === 'video') {
          if (localVideoRef.current) localVideoRef.current.srcObject = null;
          if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            updateLocalStream(audioTracks.length > 0 ? new MediaStream(audioTracks) : null);
          }
        }
      });
    }
    const syncLocalStreamFromParticipant = () => {
      try {
        if ((localParticipant as any).mediaStream) {
          const ms = (localParticipant as any).mediaStream;
          if (ms?.getVideoTracks?.().length > 0) {
            updateLocalStream(new MediaStream([ms.getVideoTracks()[0]]));
          }
        }
      } catch {}
    };
    syncLocalStreamFromParticipant();
    Promise.resolve().then(syncLocalStreamFromParticipant);
  };

  // --- Shared: participant-joined handler ---
  const setupParticipantJoined = (meeting: any, options?: { isOutgoing?: boolean }) => {
    meeting.on("participant-joined", (participant: any) => {
      if (!isMountedRef.current) return;
      clearRemoteDisconnectTimer();
      try {
        const localParticipantId = meeting.localParticipant?.id;
        const allP = getMeetingParticipants(meeting.participants);
        const remoteCount = allP.filter((pt: any) => pt.id !== localParticipantId).length;
        if (remoteCount > 1) isGroupSessionRef.current = true;
      } catch {}
      if (options?.isOutgoing && (callStatusRef.current === 'ringing' || callStatusRef.current === 'connecting')) {
        setMediaConnectingStatus();
        if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
        stopAllRingtones();
      }
      setParticipants(prev => {
        if (prev.find(x => x.id === participant.id)) return prev;
        const updated = [...prev, participant];
        try { subscribeParticipantStreams(participant); } catch {}
        return updated;
      });
    });
  };

  // --- Shared: participant-left handler ---
  const setupParticipantLeft = (meeting: any) => {
    meeting.on("participant-left", (p: any) => {
      if (!isMountedRef.current) return;
      // Remove departed participant tracks immediately to avoid stale media bindings
      // when group calls shrink back to 1:1.
      try {
        const mappedVideoStream = participantVideoMapRef.current.get(p.id);
        if (mappedVideoStream) {
          const mappedTrackIds = [...mappedVideoStream.getAudioTracks(), ...mappedVideoStream.getVideoTracks()].map((t) => t.id);
          mappedTrackIds.forEach((trackId) => removeRemoteStream(trackId));
        }
      } catch {}
      try {
        const participantStreams = p?.streams;
        const streamEntries = participantStreams instanceof Map
          ? Array.from(participantStreams.values())
          : participantStreams && typeof participantStreams === 'object'
          ? Object.values(participantStreams)
          : [];
        streamEntries.forEach((s: any) => {
          const tid = s?.track?.id;
          if (tid) removeRemoteStream(tid);
        });
      } catch {}
      // Keep only live tracks in remote stream state.
      updateRemoteStreams((prev) =>
        prev
          .map((stream) => {
            const liveTracks = [...stream.getAudioTracks(), ...stream.getVideoTracks()].filter((t) => t.readyState === 'live');
            return liveTracks.length > 0 ? new MediaStream(liveTracks) : null;
          })
          .filter((stream): stream is MediaStream => Boolean(stream))
      );
      participantVideoMapRef.current.delete(p.id);
      participantQualityRef.current.delete(p.id);
      participantPausedRef.current.delete(p.id);
      setParticipantVideoMap(new Map(participantVideoMapRef.current));
      setParticipants(prev => {
        const updated = prev.filter((x: any) => x.id !== p.id);
        // Re-sync remaining participants so surviving video tracks stay bound after a member leaves.
        refreshRemoteTracksFromMeeting(meeting);
        if (isGroupSessionRef.current) {
          // In group sessions, one participant leaving must not impact ongoing call for others.
          clearRemoteDisconnectTimer();
          return updated;
        }
        let hasRemoteParticipants = false;
        try {
          const localParticipantId = meeting.localParticipant?.id;
          const allP = getMeetingParticipants(meeting.participants);
          hasRemoteParticipants = allP.filter((pt: any) => pt.id !== localParticipantId).length > 0;
        } catch {
          hasRemoteParticipants = updated.length > 0;
        }
        if (!hasRemoteParticipants && callStatusRef.current === 'connected') {
          clearRemoteDisconnectTimer();
          remoteDisconnectTimerRef.current = setTimeout(() => {
            let stillNoRemoteParticipants = true;
            try {
              const localParticipantId = meeting.localParticipant?.id;
              const allP = getMeetingParticipants(meeting.participants);
              stillNoRemoteParticipants = allP.filter((pt: any) => pt.id !== localParticipantId).length === 0;
            } catch {
              stillNoRemoteParticipants = true;
            }
            if (!stillNoRemoteParticipants || callStatusRef.current !== 'connected') return;
            if (threadId && currentUserId) {
              const activeCallId = callIdRef.current || callIdHint || '';
              void apiClient
                .patch(`/api/chat/threads/${threadId}/call-sessions`, {
                  call_id: activeCallId,
                  event: 'end',
                  duration_seconds: callDurationRef.current,
                })
                .catch(() => {});
            }
            cleanupResources();
            setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000);
          }, 15000);
        }
        return updated;
      });
    });
  };

  // --- Shared: meeting-left handler ---
  const setupMeetingLeft = (meeting: any) => {
    meeting.on("meeting-left", async () => {
      const shouldBroadcastEndSignal = !isGroupSessionRef.current && !suppressMeetingLeftSignalRef.current;
      if (shouldBroadcastEndSignal && threadId && currentUserId && callStatusRef.current !== 'ended') {
        try {
          const activeCallId = callIdRef.current || callIdHint || '';
          const activeRoomId = roomId || roomIdHint || '';
          let substantive =
            callStatusRef.current === 'connected' || callStatusRef.current === 'connecting_media';
          let skipSessionPatches = false;
          if (!substantive && activeCallId) {
            const phase = await resolveCallSessionPhase();
            if (phase === 'active') substantive = true;
            if (phase === 'terminal') skipSessionPatches = true;
          }
          if (!skipSessionPatches && activeCallId) {
            if (substantive) {
              await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, {
                call_id: activeCallId,
                event: 'end',
                duration_seconds: callDurationRef.current,
              });
            } else if (isIncoming) {
              await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, {
                call_id: activeCallId,
                event: 'declined',
              });
            } else {
              await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, {
                call_id: activeCallId,
                event: 'missed',
              });
            }
          }
          if (!skipSessionPatches) {
            if (substantive) {
              await supabaseMessagingService.sendMessage(threadId, {
                content: 'Call ended',
                message_type: 'ended',
                metadata: {
                  callType,
                  roomId: activeRoomId,
                  callId: activeCallId,
                  endedBy: currentUserId,
                  endedAt: new Date().toISOString(),
                },
              }, { id: currentUserId, name: user?.user_metadata?.full_name || 'User' });
            } else if (!isIncoming && activeCallId) {
              await supabaseMessagingService.sendMessage(threadId, {
                content: 'Missed call',
                message_type: 'missed',
                metadata: {
                  callType,
                  roomId: activeRoomId,
                  callId: activeCallId,
                  endedBy: currentUserId,
                  endedAt: new Date().toISOString(),
                },
              }, { id: currentUserId, name: user?.user_metadata?.full_name || 'User' });
            }
          }
        } catch {}
      }
      if (isMountedRef.current) {
        cleanupResources();
        setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000);
      } else {
        cleanupResources();
      }
    });
  };

  // Adaptive video constraints based on screen size & device capabilities
  const getVideoConstraints = useCallback(() => {
    const screenW = typeof window !== 'undefined' ? window.screen.width * (window.devicePixelRatio || 1) : 1920;
    const screenH = typeof window !== 'undefined' ? window.screen.height * (window.devicePixelRatio || 1) : 1080;
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    // Desktop with high-res display: Full HD
    if (!isMobile && screenW >= 1920 && screenH >= 1080) {
      return { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 30, min: 20 }, facingMode: 'user' };
    }
    // Desktop standard or tablet landscape: 720p HD
    if (!isMobile && screenW >= 1280) {
      return { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, frameRate: { ideal: 30, min: 20 }, facingMode: 'user' };
    }
    // Tablet portrait or large phone
    if (screenW >= 768) {
      return { width: { ideal: 960, min: 640 }, height: { ideal: 540, min: 360 }, frameRate: { ideal: 24, min: 15 }, facingMode: 'user' };
    }
    // Mobile phone
    return { width: { ideal: 640, min: 480 }, height: { ideal: 480, min: 360 }, frameRate: { ideal: 24, min: 15 }, facingMode: 'user' };
  }, []);

  // Start with a lighter video profile and ramp to full quality after connection stabilizes
  const getInitialVideoConstraints = useCallback(() => {
    return { width: { ideal: 640, min: 480 }, height: { ideal: 360, min: 240 }, frameRate: { ideal: 20, min: 15 }, facingMode: 'user' };
  }, []);

  const getInitialWebcamResolution = useCallback(() => 'h360p_w640p', []);

  const getPreferredVideoSDKRegion = useCallback(() => {
    const envRegion = (process.env.NEXT_PUBLIC_VIDEOSDK_REGION || '').trim();
    return envRegion || undefined;
  }, []);

  const publishLocalVideoTrack = useCallback(async (meeting: any, constraints: MediaTrackConstraints) => {
    try {
      const videoOnly = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
      const newVideoTrack = videoOnly.getVideoTracks()[0];
      if (!newVideoTrack || !isMountedRef.current || !currentMeetingRef.current) {
        videoOnly.getTracks().forEach((track) => track.stop());
        return;
      }

      const currentAudioTracks = localStreamRef.current?.getAudioTracks().filter((track) => track.readyState === 'live') || [];
      const oldVideoTracks = localStreamRef.current?.getVideoTracks() || [];
      oldVideoTracks.forEach((track) => { if (track.id !== newVideoTrack.id) track.stop(); });

      try { meeting.enableWebcam(newVideoTrack); } catch { meeting.enableWebcam(); }

      const merged = new MediaStream([...currentAudioTracks, newVideoTrack]);
      updateLocalStream(merged);
      if (localVideoRef.current) localVideoRef.current.srcObject = merged;
    } catch {}
  }, [updateLocalStream]);

  // --- Shared: attach local media after join ---
  const attachLocalMedia = async (meeting: any) => {
    try {
      const existingLocalStream = localStreamRef.current;
      const existingAudio = existingLocalStream?.getAudioTracks().filter((track) => track.readyState === 'live') || [];
      const audioStream = existingAudio.length > 0
        ? new MediaStream(existingAudio)
        : await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 },
          });
      if (!currentMeetingRef.current || !isMountedRef.current) return;
      updateLocalStream(audioStream);
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = true;
      meeting.unmuteMic();

      if (callType === 'video' && isVideoEnabled) {
        hasUpgradedVideoQualityRef.current = false;
        void publishLocalVideoTrack(meeting, getInitialVideoConstraints());
      }
    } catch {}
  };

  // --- Token helper ---
  const getVideoSDKToken = async (meetingId?: string, userId?: string): Promise<string> => {
    const rid = meetingId || roomIdHint;
    if (!rid) throw new Error('Room ID is required.');
    const uid = userId || user?.id || '';
    let authToken: string | undefined;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      authToken = sessionData.session?.access_token;
    } catch {}
    const { tokenRetryCount, tokenRetryDelayMs } = getConnectionStrategy();
    let attempt = 0;
    let lastError: unknown = null;
    while (attempt <= tokenRetryCount) {
      try {
        const response = await fetch('/api/videosdk/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authToken && { Authorization: `Bearer ${authToken}` }) },
          body: JSON.stringify({ roomId: rid, userId: uid }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Failed to get VideoSDK token: ${errorData.error || response.statusText}`);
        }
        const data = await response.json();
        if (!data?.token || typeof data.token !== 'string') throw new Error('No token in response');
        return data.token as string;
      } catch (err) {
        lastError = err;
        if (attempt >= tokenRetryCount) break;
        await new Promise((resolve) => setTimeout(resolve, tokenRetryDelayMs * (attempt + 1)));
      }
      attempt += 1;
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to get VideoSDK token');
  };

  // ===== MAIN HANDLERS =====

  const initializeCall = async () => {
    try {
      suppressMeetingLeftSignalRef.current = false;
      remoteTerminalSignalReceivedRef.current = false;
      markConnectionMetric('call_window_initialize');
      setCallStatusIfChanged('connecting');
      setError('');
      getOrCreateCallId();
      const { joinTimeoutMs } = getConnectionStrategy();

      let meetingId = roomIdHint;
      if (!meetingId) {
        const roomResponse = await fetch('/api/videosdk/room', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!roomResponse.ok) {
          const errData = await roomResponse.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create call room.');
        }
        const roomData = await roomResponse.json();
        meetingId = roomData.roomId;
        if (!meetingId) throw new Error('Failed to create call room.');
        markConnectionMetric('room_created', { meetingId });
      }

      const [token, sdkModule] = await Promise.all([
        getVideoSDKToken(meetingId, user?.id).then((t) => {
          markConnectionMetric('token_received');
          return t;
        }),
        (videoSDKModuleRef.current ? Promise.resolve(videoSDKModuleRef.current) : import('@videosdk.live/js-sdk')).then((mod) => {
          markConnectionMetric('sdk_loaded');
          return mod;
        }),
      ]);
      const { VideoSDK } = sdkModule;
      videoSDKModuleRef.current = sdkModule;
      setRoomId(meetingId);

      if (!token || token.split('.').length !== 3) throw new Error('Invalid token format.');
      try { VideoSDK.config(token); } catch (e: any) { throw new Error(`Config failed: ${e.message}`); }

      let meeting;
      try {
        const preferredRegion = getPreferredVideoSDKRegion();
        meeting = VideoSDK.initMeeting({
          meetingId,
          name: user?.user_metadata?.full_name || user?.email || 'User',
          micEnabled: true,
          webcamEnabled: false,
          multiStream: false,
          webcamResolution: getInitialWebcamResolution(),
          customCameraVideoTrack: null,
          ...(preferredRegion ? { region: preferredRegion } : {}),
        });
      } catch (e: any) { throw new Error(`Init failed: ${e.message}`); }

      currentMeetingRef.current = meeting;

      meeting.on("meeting-joined", () => {
        if (!isMountedRef.current) return;
        setCallStatusIfChanged(isIncoming ? 'connected' : 'ringing');
        if (threadId && !isIncoming) broadcastCallUiStatus('active', threadId);
        setupLocalStreamListeners(meeting);
      });

      setupParticipantJoined(meeting, { isOutgoing: !isIncoming });
      setupParticipantLeft(meeting);
      setupMeetingLeft(meeting);
      setupPresenterChanged(meeting);

      const joinTimeout = setTimeout(() => {
        if (isMountedRef.current && currentMeetingRef.current) {
          setError('Connection timeout.');
          cleanupResources();
        }
      }, joinTimeoutMs);

      markConnectionMetric('meeting_join_start');
      try {
        await meeting.join();
        clearTimeout(joinTimeout);
        markConnectionMetric('meeting_join_end');
      } catch (e) {
        clearTimeout(joinTimeout);
        throw e;
      }
      if (!currentMeetingRef.current) throw new Error('Meeting initialization failed');

      void attachLocalMedia(meeting);
    } catch (error: any) {
      setError(`Failed to start call: ${error.message || 'Check permissions and try again.'}`);
      cleanupResources();
    }
  };

  const handleAcceptCall = async () => {
    if (isAcceptingCall) return;
    setIsAcceptingCall(true);
    try {
      suppressMeetingLeftSignalRef.current = false;
      remoteTerminalSignalReceivedRef.current = false;
      markConnectionMetric('incoming_accept_start');
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
      stopAllRingtones();
      broadcastCallUiStatus('active', threadId);
      if (!roomIdHint) { setError('Cannot accept call - missing room information.'); setIsAcceptingCall(false); return; }
      const acceptedCallId = getOrCreateCallId();
      setCallStatusIfChanged('connecting');
      const { joinTimeoutMs } = getConnectionStrategy();

      const [token, sdkModule] = await Promise.all([
        getVideoSDKToken(roomIdHint, user?.id).then((t) => {
          markConnectionMetric('token_received');
          return t;
        }),
        (videoSDKModuleRef.current ? Promise.resolve(videoSDKModuleRef.current) : import('@videosdk.live/js-sdk')).then((mod) => {
          markConnectionMetric('sdk_loaded');
          return mod;
        }),
      ]);
      const { VideoSDK } = sdkModule;
      videoSDKModuleRef.current = sdkModule;
      setRoomId(roomIdHint);

      if (!token || token.split('.').length !== 3) throw new Error('Invalid token format.');
      try { VideoSDK.config(token); } catch (e: any) { throw new Error(`Config failed: ${e.message}`); }

      let meeting;
      try {
        const preferredRegion = getPreferredVideoSDKRegion();
        meeting = VideoSDK.initMeeting({
          meetingId: roomIdHint,
          name: user?.user_metadata?.full_name || user?.email || 'User',
          micEnabled: true,
          webcamEnabled: false,
          multiStream: false,
          webcamResolution: getInitialWebcamResolution(),
          customCameraVideoTrack: null,
          ...(preferredRegion ? { region: preferredRegion } : {}),
        });
      } catch (e: any) { throw new Error(`Init failed: ${e.message}`); }

      currentMeetingRef.current = meeting;

      meeting.on("meeting-joined", () => {
        if (!isMountedRef.current) return;
        setMediaConnectingStatus();

        syncExistingParticipants(meeting);
        Promise.resolve().then(() => syncExistingParticipants(meeting));

        setupLocalStreamListeners(meeting);
      });

      setupParticipantJoined(meeting);
      setupParticipantLeft(meeting);
      setupMeetingLeft(meeting);
      setupPresenterChanged(meeting);

      const joinTimeout = setTimeout(() => {
        if (isMountedRef.current && currentMeetingRef.current) {
          setError('Connection timeout.');
          cleanupResources();
        }
      }, joinTimeoutMs);

      markConnectionMetric('meeting_join_start');
      try {
        await meeting.join();
      } finally {
        clearTimeout(joinTimeout);
      }
      markConnectionMetric('meeting_join_end');
      void attachLocalMedia(meeting);

      if (threadId && currentUserId) {
        try {
          await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, {
            call_id: acceptedCallId,
            event: 'accept',
          });
        } catch {}
      }
      onAccept?.();
    } catch (error: any) {
      setError(`Failed to accept call: ${error.message || 'Check permissions.'}`);
      setIsAcceptingCall(false);
      cleanupResources();
    }
  };

  const handleRejectCall = async () => {
    const activeCallId = callIdRef.current || callIdHint || '';
    if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    stopAllRingtones();
    if (threadId && activeCallId) {
      try {
        await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, {
          call_id: activeCallId,
          event: 'reject',
        });
      } catch (error) {
        console.error('Failed to send declined signal:', error);
      }
    }
    setCallStatusIfChanged('ended');
    onReject?.();
    setTimeout(() => onClose(), 1000);
  };

  const handleEndCall = async () => {
    const activeCallId = callIdRef.current || callIdHint || '';
    const activeRoomId = roomId || roomIdHint || '';
    let isConnectedCall =
      callStatusRef.current === 'connected' || callStatusRef.current === 'connecting_media';
    if (!isConnectedCall && activeCallId && threadId) {
      const phase = await resolveCallSessionPhase();
      if (phase === 'active') isConnectedCall = true;
      if (phase === 'terminal') remoteTerminalSignalReceivedRef.current = true;
    }
    const shouldBroadcastEndSignal = !isGroupSessionRef.current;
    const buildSignalMeta = () => ({
      callType,
      roomId: activeRoomId,
      callId: activeCallId,
      endedBy: currentUserId,
      endedAt: new Date().toISOString(),
    });
    if (threadId && currentUserId && callStatusRef.current !== 'ended' && shouldBroadcastEndSignal) {
      try {
        if (remoteTerminalSignalReceivedRef.current) {
          // Peer already finalized the session (declined / ended / missed).
        } else if (isConnectedCall) {
          if (activeCallId) {
            await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, {
              call_id: activeCallId,
              event: 'end',
              duration_seconds: callDuration,
            });
          }
          await supabaseMessagingService.sendMessage(threadId, {
            content: 'Call ended',
            message_type: 'ended',
            metadata: buildSignalMeta(),
          }, { id: currentUserId, name: user?.user_metadata?.full_name || 'User' });
        } else if (activeCallId) {
          // Pre-answer: caller hang-up → missed; callee hang-up / dismiss → declined (reject).
          if (isIncoming) {
            await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, {
              call_id: activeCallId,
              event: 'declined',
            });
          } else {
            await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, {
              call_id: activeCallId,
              event: 'missed',
            });
            await supabaseMessagingService.sendMessage(threadId, {
              content: 'Missed call',
              message_type: 'missed',
              metadata: buildSignalMeta(),
            }, { id: currentUserId, name: user?.user_metadata?.full_name || 'User' });
          }
        }
      } catch {}
    }
    suppressMeetingLeftSignalRef.current = true;
    cleanupResources();
    onCallEnd?.();
    setTimeout(() => onClose(), 1000);
  };

  // --- Media controls ---
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (currentMeetingRef.current) {
      try { newMutedState ? currentMeetingRef.current.muteMic() : currentMeetingRef.current.unmuteMic(); } catch {}
    }
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !newMutedState;
    }
  };

  const toggleVideo = async () => {
    if (callType !== 'video') return;
    const newVideoState = !isVideoEnabled;
    setIsVideoEnabled(newVideoState);
    if (currentMeetingRef.current) {
      try {
        if (newVideoState) {
          // Re-enable with adaptive HD quality track
          try {
            const hdStream = await navigator.mediaDevices.getUserMedia({ video: getVideoConstraints() });
            const hdTrack = hdStream.getVideoTracks()[0];
            if (hdTrack) {
              currentMeetingRef.current.enableWebcam(hdTrack);
            } else {
              currentMeetingRef.current.enableWebcam();
            }
          } catch {
            currentMeetingRef.current.enableWebcam();
          }
          setTimeout(async () => {
            try {
              const lp = currentMeetingRef.current?.localParticipant;
              if (lp) {
                const vs = lp.getVideoStreams?.() || [];
                if (vs.length > 0 && vs[0].track) {
                  const nvs = new MediaStream([vs[0].track]);
                  updateLocalStream(nvs);
                  if (localVideoRef.current) { localVideoRef.current.srcObject = nvs; localVideoRef.current.play().catch(() => {}); }
                }
              }
            } catch {}
          }, 500);
        } else {
          currentMeetingRef.current.disableWebcam();
          if (localStream) { const vt = localStream.getVideoTracks()[0]; if (vt) vt.stop(); }
        }
      } catch {
        setIsVideoEnabled(!newVideoState);
      }
    } else {
      setIsVideoEnabled(!newVideoState);
    }
  };

  const toggleSpeaker = () => {
    setSpeakerLevel(prev => {
      const next: SpeakerLevel = prev === 'normal' ? 'loud' : prev === 'loud' ? 'low' : 'normal';
      speakerLevelRef.current = next;
      const vol = SPEAKER_VOLUMES[next];
      const audioElement = remoteAudioRef.current;
      if (audioElement) {
        audioElement.muted = false;
        audioElement.volume = vol;
        const p = audioElement.play();
        if (p) p.catch(() => undefined);
        requestAnimationFrame(() => {
          if (remoteAudioRef.current) { remoteAudioRef.current.volume = vol; remoteAudioRef.current.muted = false; }
        });
      }
      return next;
    });
  };

  const toggleScreenShare = async () => {
    if (!currentMeetingRef.current) return;
    if (isScreenSharing) {
      try { currentMeetingRef.current.disableScreenShare(); } catch {}
      if (screenShareStream) screenShareStream.getTracks().forEach(t => t.stop());
      setScreenShareStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        currentMeetingRef.current.enableScreenShare();
        const lp = currentMeetingRef.current.localParticipant;
        if (lp?.on) {
          lp.on("stream-enabled", (stream: any) => {
            if (!isMountedRef.current) return;
            if (stream.kind === 'share' && stream.track) {
              setIsScreenSharing(true);
              setScreenShareStream(new MediaStream([stream.track]));
              stream.track.addEventListener('ended', () => {
                if (isMountedRef.current) {
                  try { currentMeetingRef.current?.disableScreenShare(); } catch {}
                  setScreenShareStream(null);
                  setIsScreenSharing(false);
                }
              });
            }
          });
          lp.on("stream-disabled", (stream: any) => {
            if (!isMountedRef.current) return;
            if (stream.kind === 'share') { setScreenShareStream(null); setIsScreenSharing(false); }
          });
        }
        const meeting = currentMeetingRef.current;
        const onPC = (presenterId: string | null) => {
          if (!isMountedRef.current) return;
          if (presenterId === meeting.localParticipant?.id) setIsScreenSharing(true);
          else if (!presenterId) { setIsScreenSharing(false); setScreenShareStream(null); }
          try { meeting.off?.("presenter-changed", onPC); } catch {}
        };
        try { meeting.on("presenter-changed", onPC); } catch {}
      } catch {
        setIsScreenSharing(false);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try {
      if (threadId && currentUserId) {
        await supabaseMessagingService.sendMessage(threadId, {
          content: messageText.trim(),
          message_type: 'text',
        }, { id: currentUserId, name: user?.user_metadata?.full_name || 'User' });
        setMessageText('');
        setShowMessageInput(false);
      }
    } catch {}
  };

  // --- Add people ---
  const searchUsersForInvite = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) { setAddPeopleResults([]); return; }
    try {
      const res = await apiClient.get<{ data: any[] }>('/api/users/search', { q: query, limit: 10 });
      const users = (res?.data || []).filter((u: any) => u.id !== currentUserId);
      setAddPeopleResults(users);
    } catch { setAddPeopleResults([]); }
  }, [currentUserId]);

  const handleInviteToCall = useCallback(async (targetUser: { id: string; full_name: string; username: string }) => {
    if (!currentUserId || invitingUserId) return;
    setInvitingUserId(targetUser.id);
    try {
      const currentRoomId = roomId || roomIdHint;
      if (!currentRoomId) throw new Error('No active room');
      const threadRes = await apiClient.post<{ data: { id: string } }>('/api/chat/threads', {
        participant_ids: [targetUser.id],
        type: 'direct',
      });
      const directThreadId = threadRes?.data?.id;
      if (!directThreadId) throw new Error('Could not find or create thread');
      await apiClient.post(`/api/chat/threads/${directThreadId}/call-sessions`, {
        call_id: callIdRef.current || callIdHint || '',
        call_type: callType,
        room_id: currentRoomId,
        target_user_id: targetUser.id,
        is_group_call: true,
        caller_name: resolvedSignalingCallerName,
        caller_avatar_url: resolvedSignalingCallerAvatarUrl,
      });
      setShowAddPeople(false);
      setAddPeopleSearch('');
      setAddPeopleResults([]);
    } catch (error: any) {
      console.error('Failed to invite to call:', error);
    } finally {
      setInvitingUserId(null);
    }
  }, [
    currentUserId,
    roomId,
    roomIdHint,
    callType,
    invitingUserId,
    callIdHint,
    resolvedSignalingCallerName,
    resolvedSignalingCallerAvatarUrl,
  ]);

  // ===== EFFECTS =====

  // VideoSDK layout policy (quality + pagination stream optimization).
  useEffect(() => {
    if (callType !== 'video') return;
    const meeting = currentMeetingRef.current;
    if (!meeting) return;

    const localParticipantId = meeting.localParticipant?.id;
    const remoteParticipants = getMeetingParticipants(meeting.participants).filter((p: any) => p.id !== localParticipantId);
    if (remoteParticipants.length === 0) return;

    const visibleRemoteSet = new Set(
      (visibleRemoteParticipantIds.length > 0
        ? visibleRemoteParticipantIds
        : remoteParticipants.map((p: any) => p.id)
      ).filter(Boolean)
    );

    const hasScreenShareLayout = Boolean(remoteScreenShareStream || isScreenSharing);
    const visibleRemoteCount = remoteParticipants.filter((p: any) => visibleRemoteSet.has(p.id)).length;
    const visibleTileCount = visibleRemoteCount + 1; // local tile included
    const gridQuality: 'high' | 'med' | 'low' =
      visibleTileCount < 3 ? 'high' : visibleTileCount <= 6 ? 'med' : 'low';

    remoteParticipants.forEach((participant: any) => {
      const participantId = participant.id as string;
      const isVisible = visibleRemoteSet.has(participantId);
      const isPresenter = presenterParticipantIdRef.current === participantId;

      const targetQuality: 'high' | 'med' | 'low' = hasScreenShareLayout
        ? (isPresenter ? 'high' : 'low')
        : (isVisible ? gridQuality : 'low');

      if (participantQualityRef.current.get(participantId) !== targetQuality) {
        try { participant.setQuality?.(targetQuality); } catch {}
        participantQualityRef.current.set(participantId, targetQuality);
      }

      const shouldPause = !isPresenter && !isVisible;
      if (participantPausedRef.current.get(participantId) !== shouldPause) {
        try {
          const participantStreams = participant?.streams;
          const entries = participantStreams instanceof Map
            ? Array.from(participantStreams.values())
            : participantStreams && typeof participantStreams === 'object'
            ? Object.values(participantStreams)
            : [];

          entries.forEach((stream: any) => {
            if (shouldPause) stream?.pause?.();
            else stream?.resume?.();
          });
        } catch {}
        participantPausedRef.current.set(participantId, shouldPause);
      }
    });

    const activeIds = new Set(remoteParticipants.map((p: any) => p.id as string));
    participantQualityRef.current.forEach((_, participantId) => {
      if (!activeIds.has(participantId)) participantQualityRef.current.delete(participantId);
    });
    participantPausedRef.current.forEach((_, participantId) => {
      if (!activeIds.has(participantId)) participantPausedRef.current.delete(participantId);
    });
  }, [
    callType,
    participants,
    visibleRemoteParticipantIds,
    isScreenSharing,
    remoteScreenShareStream,
    getMeetingParticipants,
  ]);

  // Initialize call when modal opens
  useEffect(() => {
    if (!isOpen) {
      if (hasInitializedRef.current || currentMeetingRef.current) cleanupResources();
      setIsAcceptingCall(false);
      return;
    }
    if (isIncoming) { if (roomIdHint) setRoomId(roomIdHint); return; }
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initializeCall().catch(() => {
        if (isMountedRef.current) {
          broadcastCallUiStatus('ended', threadId);
          setError('Failed to start call.');
          setCallStatusIfChanged('ended');
        }
      });
    }
    return () => { if (!isOpen) cleanupResources(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isIncoming, roomIdHint, callStatus, cleanupResources]);

  // Single call lifecycle signaling subscription (lightweight channel, routed by type + call metadata)
  useEffect(() => {
    if (!isOpen || !threadId) return;

    const closeCallUi = (delayMs: number) => {
      remoteTerminalSignalReceivedRef.current = true;
      suppressMeetingLeftSignalRef.current = true;
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
      stopAllRingtones();
      if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
      if (isMountedRef.current) {
        cleanupResources();
        setTimeout(() => { if (isMountedRef.current) onClose(); }, delayMs);
      }
    };

    const unsub = supabaseMessagingService.subscribeToCallSignals(threadId, (msg) => {
      if (callStatusRef.current === 'ended') return;
      const messageType = msg?.message_type;
      if (!messageType) return;
      const meta = normalizeSignalMeta(msg.metadata);
      if (!matchesActiveCallMeta(meta)) return;

      const matchesRemoteSignal = shouldHandleSignal(msg, messageType);
      const mt = toCallSessionStatusMessageType(messageType as string);
      const isAccept = mt === 'active';
      const isReject = mt === 'declined';
      const isMissed = mt === 'missed';
      const isEnded = mt === 'ended';
      const isFailed = mt === 'failed';
      const acceptedElsewhereByMe = isAccept && meta?.acceptedBy === currentUserId;
      const rejectedElsewhereByMe = isReject && meta?.rejectedBy === currentUserId;

      if (isAccept) {
        if (!isIncoming && matchesRemoteSignal && meta?.acceptedBy) {
          if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
          stopAllRingtones();
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          setMediaConnectingStatus();
          return;
        }

        if (isIncoming && acceptedElsewhereByMe && !isAcceptingCall) {
          closeCallUi(800);
        }
        return;
      }

      if (isReject) {
        if (isGroupSessionRef.current) return;
        if (matchesRemoteSignal || (isIncoming && rejectedElsewhereByMe)) {
          closeCallUi(isIncoming ? 800 : 1000);
        }
        return;
      }

      if (isMissed) {
        if (isGroupSessionRef.current) return;
        if (matchesRemoteSignal) {
          closeCallUi(1000);
        }
        return;
      }

      if ((isEnded || isFailed) && !isGroupSessionRef.current && matchesRemoteSignal && (meta?.endedBy || isFailed)) {
        closeCallUi(1000);
      }
    });

    return () => { unsub(); };
  }, [isOpen, threadId, currentUserId, isIncoming, isAcceptingCall, cleanupResources, onClose, shouldHandleSignal, matchesActiveCallMeta, setMediaConnectingStatus, normalizeSignalMeta, setCallStatusIfChanged]);

  // Polling fallback for call end (outgoing ring only). Incoming accept UI already uses Realtime;
  // polling here hit /call-sessions every 3s and contributed to duplicate requests / flicker.
  useEffect(() => {
    if (!isOpen || !threadId) return;
    if (isIncoming) return;
    if (isGroupSessionRef.current) return;
    if (callStatus === 'connected' || callStatus === 'connecting_media' || callStatus === 'ended') return;
    if (isAcceptingCall) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const cid = callIdRef.current || callIdHint || '';
        if (!cid) return;
        const res = await apiClient.get<{ session: Record<string, unknown> | null }>(
          `/api/chat/threads/${threadId}/call-sessions`,
          { call_id: cid }
        );
        if (cancelled) return;
        const session = res?.session;
        const latest = session ? callSessionRowToPollTerminalMessage(session) : null;
        if (latest && shouldHandleSignal(latest) && Date.now() - new Date(latest.updated_at || latest.created_at).getTime() < 120000) {
          remoteTerminalSignalReceivedRef.current = true;
          suppressMeetingLeftSignalRef.current = true;
          if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
          stopAllRingtones();
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          if (isMountedRef.current) { cleanupResources(); setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000); }
          return;
        }
      } catch {}
    };
    const interval = setInterval(poll, 8000);
    const initial = setTimeout(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); clearTimeout(initial); };
  }, [isOpen, threadId, currentUserId, isIncoming, callStatus, isAcceptingCall, cleanupResources, onClose, shouldHandleSignal, setCallStatusIfChanged, callIdHint]);

  // Screen share video ref fallback
  useEffect(() => {
    if (screenShareVideoRef.current && remoteScreenShareStream) {
      screenShareVideoRef.current.srcObject = remoteScreenShareStream;
      screenShareVideoRef.current.play().catch(() => {});
    } else if (screenShareVideoRef.current) {
      screenShareVideoRef.current.srcObject = null;
    }
  }, [remoteScreenShareStream]);

  // Debounced add people search
  useEffect(() => {
    if (!showAddPeople) return;
    const timer = setTimeout(() => { searchUsersForInvite(addPeopleSearch); }, 300);
    return () => clearTimeout(timer);
  }, [addPeopleSearch, showAddPeople, searchUsersForInvite]);

  // Update local video element
  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStream) {
      try { if (el.srcObject !== localStream) el.srcObject = localStream; if (el.paused) el.play().catch(() => {}); } catch {}
    } else if (el && !localStream) { el.srcObject = null; }
  }, [localStream]);

  // Update remote audio/video elements
  useEffect(() => {
    const audioElement = remoteAudioRef.current;
    if (audioElement && remoteStreams.length > 0) {
      try {
        const combined = new MediaStream();
        const added = new Set<string>();
        remoteStreams.forEach(s => {
          s.getAudioTracks().forEach(t => { if (!added.has(t.id)) { combined.addTrack(t); added.add(t.id); if (!t.enabled) t.enabled = true; } });
        });
        if (combined.getAudioTracks().length > 0) {
          if (audioElement.srcObject !== combined) audioElement.srcObject = combined;
          const vol = SPEAKER_VOLUMES[speakerLevelRef.current];
          audioElement.muted = false; audioElement.volume = vol;
          if (audioElement.paused) {
            const p = audioElement.play();
            if (p) p.then(() => { if (remoteAudioRef.current) { remoteAudioRef.current.volume = SPEAKER_VOLUMES[speakerLevelRef.current]; remoteAudioRef.current.muted = false; } }).catch(() => {});
          }
        } else { audioElement.srcObject = null; }
      } catch {}
    } else if (audioElement) { audioElement.srcObject = null; }
    const videoElement = remoteVideoRef.current;
    if (videoElement && callType === 'video' && remoteStreams.length > 0) {
      try {
        const streamWithVideo = remoteStreams.find(s => s.getVideoTracks().length > 0);
        if (streamWithVideo) { if (videoElement.srcObject !== streamWithVideo) videoElement.srcObject = streamWithVideo; if (videoElement.paused) videoElement.play().catch(() => {}); } else { videoElement.srcObject = null; }
      } catch {}
    } else if (videoElement) { videoElement.srcObject = null; }
  }, [remoteStreams, speakerLevel, callType]);

  // Upgrade local video quality after call is connected and remote media starts flowing
  useEffect(() => {
    if (callType !== 'video' || !isVideoEnabled) return;
    if (callStatus !== 'connected') return;
    if (remoteStreams.length === 0) return;
    if (hasUpgradedVideoQualityRef.current) return;
    const meeting = currentMeetingRef.current;
    if (!meeting) return;
    hasUpgradedVideoQualityRef.current = true;
    void publishLocalVideoTrack(meeting, getVideoConstraints());
  }, [callType, isVideoEnabled, callStatus, remoteStreams, publishLocalVideoTrack, getVideoConstraints]);

  // Call duration timer
  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') { interval = setInterval(() => setCallDuration(p => p + 1), 1000); }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Listen for call-accepted custom event
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.threadId === threadId && !isIncoming) {
        if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
        stopAllRingtones();
        setMediaConnectingStatus();
      }
    };
    window.addEventListener('call-accepted', handler);
    return () => window.removeEventListener('call-accepted', handler);
  }, [threadId, isIncoming, setMediaConnectingStatus]);

  // Ringtone/ringback
  useEffect(() => {
    if (!isOpen || callStatus !== 'ringing') return;
    if (isIncoming) { playRingtone().then(r => { ringtoneRef.current = r; }); }
    else { playRingbackTone().then(r => { ringtoneRef.current = r; }); }
    return () => { if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; } stopAllRingtones(); };
  }, [isOpen, callStatus, isIncoming]);

  // Transition incoming to ringing
  useEffect(() => {
    if (isIncoming && isOpen && callStatus === 'connecting' && !isAcceptingCall) {
      setCallStatusIfChanged('ringing');
      callTimeoutRef.current = setTimeout(() => { handleRejectCall(); }, 45000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIncoming, isOpen, callStatus, isAcceptingCall]);

  // Auto-disconnect timeout for outgoing
  useEffect(() => {
    if (!isIncoming && callStatus === 'ringing') {
      callTimeoutRef.current = setTimeout(() => { handleEndCall(); }, 45000);
    }
    if (callStatus === 'connected' || callStatus === 'connecting_media' || callStatus === 'ended') {
      if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    }
    return () => { if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, isIncoming]);

  // Ringtone cleanup on status change
  useEffect(() => {
    if (callStatus === 'connected' || callStatus === 'connecting_media' || callStatus === 'ended') {
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
      stopAllRingtones();
      setIsAcceptingCall(false);
    }
  }, [callStatus]);

  // Auto-close modal
  useEffect(() => {
    if (callStatus === 'ended' && isOpen) {
      const timer = setTimeout(() => onClose(), 2000);
      return () => clearTimeout(timer);
    }
  }, [callStatus, isOpen, onClose]);

  // ===== RETURN =====
  return {
    // State
    callStatus, isMuted, isVideoEnabled, speakerLevel, callDuration,
    localStream, remoteStreams, roomId, error, participants,
    showMessageInput, messageText, isAcceptingCall,
    isScreenSharing, screenShareStream, remoteScreenShareStream, screenShareParticipantName,
    participantVideoMap, showAddPeople, addPeopleSearch, addPeopleResults, invitingUserId,
    setVisibleRemoteParticipantIds,
    // Derived
    decodedCallerName, decodedRecipientName, isIncoming, callType,
    decodedCallerAvatarUrl, decodedRecipientAvatarUrl,
    user,
    // Refs (for attaching to DOM elements)
    localVideoRef, remoteVideoRef, remoteAudioRef, screenShareVideoRef,
    // Functions
    getParticipantCount, formatDuration,
    handleAcceptCall, handleRejectCall, handleEndCall,
    toggleMute, toggleVideo, toggleSpeaker, toggleScreenShare,
    handleSendMessage, handleInviteToCall,
    // Setters for UI-only state
    setShowMessageInput, setMessageText, setShowAddPeople, setAddPeopleSearch,
  };
}
