/**
 * useVideoCall - Custom hook encapsulating all video call state, effects, and handlers.
 *
 * This is the "brain" of the video call modal. All stateful logic lives here;
 * the UI components are pure presentational wrappers that receive data & callbacks.
 */
import { useAuth } from '@/contexts/AuthContext';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';
import { stopAll as stopAllRingtones, playRingtone, playRingbackTone } from '@/features/video/services/ringtoneService';
import { supabase } from '@/lib/supabase';
import { videoSDKWebRTCManager } from '@/lib/videosdk-webrtc';
import { notificationService } from '@/shared/services/notificationService';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallStatus, SpeakerLevel, VideoSDKCallModalProps } from './types';
import { SPEAKER_VOLUMES } from './types';

export function useVideoCall(props: VideoSDKCallModalProps) {
  const {
    isOpen,
    onClose,
    callType,
    callerName,
    recipientName,
    isIncoming = false,
    onAccept,
    onReject,
    onCallEnd,
    threadId,
    currentUserId,
    roomIdHint,
    tokenHint,
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

  // --- State ---
  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [speakerLevel, setSpeakerLevel] = useState<SpeakerLevel>('normal');
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [roomId, setRoomId] = useState<string>('');
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

  // --- Refs ---
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const participantVideoMapRef = useRef<Map<string, MediaStream>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<MediaStream[]>([]);
  const hasInitializedRef = useRef(false);
  const isMountedRef = useRef(false);
  const currentMeetingRef = useRef<any>(null);
  const callStatusRef = useRef<CallStatus>('connecting');
  const videoSDKModuleRef = useRef<{ VideoSDK: any } | null>(null);
  const speakerLevelRef = useRef<SpeakerLevel>(speakerLevel);

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
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
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
      setCallStatus('ended');
      setRoomId('');
      setError('');
    }
    hasInitializedRef.current = false;
  }, [updateLocalStream, updateRemoteStreams]);

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
        const stream = new MediaStream([vs.track]);
        addRemoteStream(stream);
        if (remoteVideoRef.current && callType === 'video') {
          remoteVideoRef.current.srcObject = stream;
        }
      }
    });
  };

  // --- Shared: set up presenter-changed handler ---
  const setupPresenterChanged = (meeting: any) => {
    meeting.on("presenter-changed", (presenterId: string | null) => {
      if (!isMountedRef.current) return;
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
    setTimeout(() => {
      try {
        if ((localParticipant as any).mediaStream) {
          const ms = (localParticipant as any).mediaStream;
          if (ms?.getVideoTracks?.().length > 0) {
            updateLocalStream(new MediaStream([ms.getVideoTracks()[0]]));
          }
        }
      } catch {}
    }, 500);
  };

  // --- Shared: participant-joined handler ---
  const setupParticipantJoined = (meeting: any, options?: { isOutgoing?: boolean }) => {
    meeting.on("participant-joined", (participant: any) => {
      if (!isMountedRef.current) return;
      if (options?.isOutgoing && (callStatusRef.current === 'ringing' || callStatusRef.current === 'connecting')) {
        setCallStatus('connected');
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
      participantVideoMapRef.current.delete(p.id);
      setParticipantVideoMap(new Map(participantVideoMapRef.current));
      setParticipants(prev => {
        const updated = prev.filter((x: any) => x.id !== p.id);
        let hasRemoteParticipants = false;
        try {
          const localParticipantId = meeting.localParticipant?.id;
          const allP = getMeetingParticipants(meeting.participants);
          hasRemoteParticipants = allP.filter((pt: any) => pt.id !== localParticipantId).length > 0;
        } catch {
          hasRemoteParticipants = updated.length > 0;
        }
        if (!hasRemoteParticipants && callStatusRef.current === 'connected') {
          if (threadId && currentUserId) {
            supabaseMessagingService.sendMessage(threadId, {
              content: '📞 Call ended',
              message_type: 'call_ended',
              metadata: { callType, endedBy: currentUserId, endedAt: new Date().toISOString() },
            }, { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }).catch(() => {});
          }
          setCallStatus('ended');
          cleanupResources();
          setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000);
        }
        return updated;
      });
    });
  };

  // --- Shared: meeting-left handler ---
  const setupMeetingLeft = (meeting: any) => {
    meeting.on("meeting-left", async () => {
      if (threadId && currentUserId && callStatusRef.current !== 'ended') {
        try {
          await supabaseMessagingService.sendMessage(threadId, {
            content: '📞 Call ended',
            message_type: 'call_ended',
            metadata: { callType, endedBy: currentUserId, endedAt: new Date().toISOString() },
          }, { id: currentUserId, name: user?.user_metadata?.full_name || 'User' });
        } catch {}
      }
      if (isMountedRef.current) {
        setCallStatus('ended');
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

  const getWebcamResolution = useCallback(() => {
    const screenW = typeof window !== 'undefined' ? window.screen.width * (window.devicePixelRatio || 1) : 1920;
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile && screenW >= 1920) return 'h1080p_w1920p';
    if (!isMobile && screenW >= 1280) return 'h720p_w1280p';
    if (screenW >= 768) return 'h540p_w960p';
    return 'h480p_w640p';
  }, []);

  // --- Shared: attach local media after join ---
  const attachLocalMedia = async (meeting: any) => {
    try {
      const constraints = getVideoConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video' && isVideoEnabled ? constraints : false,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 },
      });
      if (!currentMeetingRef.current || !isMountedRef.current) return;
      updateLocalStream(stream);
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = true;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      if (callType === 'video' && isVideoEnabled) {
        // Pass custom track to VideoSDK for HD quality
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          try { meeting.enableWebcam(videoTrack); } catch { meeting.enableWebcam(); }
        } else {
          meeting.enableWebcam();
        }
      }
      meeting.unmuteMic();
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
  };

  // ===== MAIN HANDLERS =====

  const initializeCall = async () => {
    try {
      setCallStatus('connecting');
      setError('');

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
      }

      const [token, sdkModule] = await Promise.all([
        getVideoSDKToken(meetingId, user?.id),
        videoSDKModuleRef.current ? Promise.resolve(videoSDKModuleRef.current) : import('@videosdk.live/js-sdk'),
      ]);
      const { VideoSDK } = sdkModule;
      videoSDKModuleRef.current = sdkModule;
      setRoomId(meetingId);

      if (!token || token.split('.').length !== 3) throw new Error('Invalid token format.');
      try { VideoSDK.config(token); } catch (e: any) { throw new Error(`Config failed: ${e.message}`); }

      let meeting;
      try {
        meeting = VideoSDK.initMeeting({
          meetingId,
          name: user?.user_metadata?.full_name || user?.email || 'User',
          micEnabled: true,
          webcamEnabled: callType === 'video' && isVideoEnabled,
          multiStream: false,
          webcamResolution: getWebcamResolution(),
          customCameraVideoTrack: null,
        });
      } catch (e: any) { throw new Error(`Init failed: ${e.message}`); }

      currentMeetingRef.current = meeting;

      meeting.on("meeting-joined", () => {
        if (!isMountedRef.current) return;
        setCallStatus(isIncoming ? 'connected' : 'ringing');
        setupLocalStreamListeners(meeting);
      });

      setupParticipantJoined(meeting, { isOutgoing: !isIncoming });
      setupParticipantLeft(meeting);
      setupMeetingLeft(meeting);
      setupPresenterChanged(meeting);

      const joinTimeout = setTimeout(() => {
        if (isMountedRef.current && currentMeetingRef.current) {
          setError('Connection timeout.');
          setCallStatus('ended');
          cleanupResources();
        }
      }, 30000);

      try { await meeting.join(); clearTimeout(joinTimeout); } catch (e) { clearTimeout(joinTimeout); throw e; }
      if (!currentMeetingRef.current) throw new Error('Meeting initialization failed');

      void attachLocalMedia(meeting);
    } catch (error: any) {
      setError(`Failed to start call: ${error.message || 'Check permissions and try again.'}`);
      setCallStatus('ended');
      cleanupResources();
    }
  };

  const handleAcceptCall = async () => {
    if (isAcceptingCall) return;
    setIsAcceptingCall(true);
    try {
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
      stopAllRingtones();
      if (typeof window !== 'undefined' && window.opener) {
        try { window.opener.postMessage({ type: 'CALL_ACCEPTED', threadId }, window.location.origin); } catch {}
      }
      if (!roomIdHint) { setError('Cannot accept call - missing room information.'); setIsAcceptingCall(false); return; }
      setCallStatus('connecting');

      const [token, sdkModule] = await Promise.all([
        getVideoSDKToken(roomIdHint, user?.id),
        videoSDKModuleRef.current ? Promise.resolve(videoSDKModuleRef.current) : import('@videosdk.live/js-sdk'),
        navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' ? getVideoConstraints() : false }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {}),
      ]);
      const { VideoSDK } = sdkModule;
      videoSDKModuleRef.current = sdkModule;
      setRoomId(roomIdHint);

      if (!token || token.split('.').length !== 3) throw new Error('Invalid token format.');
      try { VideoSDK.config(token); } catch (e: any) { throw new Error(`Config failed: ${e.message}`); }

      let meeting;
      try {
        meeting = VideoSDK.initMeeting({
          meetingId: roomIdHint,
          name: user?.user_metadata?.full_name || user?.email || 'User',
          micEnabled: true,
          webcamEnabled: callType === 'video' && isVideoEnabled,
          multiStream: false,
          webcamResolution: getWebcamResolution(),
          customCameraVideoTrack: null,
        });
      } catch (e: any) { throw new Error(`Init failed: ${e.message}`); }

      currentMeetingRef.current = meeting;

      meeting.on("meeting-joined", () => {
        if (!isMountedRef.current) return;
        setCallStatus('connected');

        // Get existing participants
        setTimeout(() => {
          try {
            const localParticipantId = meeting.localParticipant?.id;
            const allP = getMeetingParticipants(meeting.participants);
            const existing = allP.filter((p: any) => p.id !== localParticipantId);
            if (existing.length > 0) {
              setParticipants(prev => {
                const updated = [...prev];
                existing.forEach((participant: any) => {
                  if (!updated.find(x => x.id === participant.id)) {
                    updated.push(participant);
                    if (participant.on) {
                      participant.on("stream-enabled", (stream: any) => {
                        if (stream.kind === 'video' && stream.track) {
                          updateRemoteStreams(p => p.filter(s => s.getVideoTracks().length === 0));
                          const videoStream = new MediaStream([stream.track]);
                          addRemoteStream(videoStream);
                          if (remoteVideoRef.current && callType === 'video') {
                            remoteVideoRef.current.srcObject = videoStream;
                            remoteVideoRef.current.play().catch(() => {});
                          }
                        } else if (stream.kind === 'audio' && stream.track) {
                          addRemoteStream(new MediaStream([stream.track]));
                        }
                      });
                      participant.on("stream-disabled", (stream: any) => {
                        if (stream.track) removeRemoteStream(stream.track.id);
                      });
                    }
                    const videoStreams = participant.getVideoStreams?.() || [];
                    videoStreams.forEach((vs: any) => {
                      if (vs.track) {
                        const s = new MediaStream([vs.track]);
                        addRemoteStream(s);
                        if (remoteVideoRef.current && callType === 'video') remoteVideoRef.current.srcObject = s;
                      }
                    });
                  }
                });
                return updated;
              });
            }
          } catch {}
        }, 500);

        setupLocalStreamListeners(meeting);
      });

      setupParticipantJoined(meeting);
      setupParticipantLeft(meeting);
      setupMeetingLeft(meeting);
      setupPresenterChanged(meeting);

      await meeting.join();
      void attachLocalMedia(meeting);

      if (threadId && currentUserId) {
        try {
          await supabaseMessagingService.sendMessage(threadId, {
            content: '✅ Call accepted',
            message_type: 'call_accepted',
            metadata: { callType, acceptedBy: currentUserId, acceptedAt: new Date().toISOString() },
          }, { id: currentUserId, name: decodedRecipientName });
        } catch {}
      }
      onAccept?.();
    } catch (error: any) {
      setError(`Failed to accept call: ${error.message || 'Check permissions.'}`);
      setCallStatus('ended');
      setIsAcceptingCall(false);
      cleanupResources();
    }
  };

  const handleRejectCall = async () => {
    if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    stopAllRingtones();
    if (threadId && currentUserId) {
      try {
        await supabaseMessagingService.sendMessage(threadId, {
          content: '❌ Call rejected',
          message_type: 'call_rejected',
          metadata: { callType, rejectedBy: currentUserId, rejectedAt: new Date().toISOString() },
        }, { id: currentUserId, name: isIncoming ? decodedRecipientName : decodedCallerName });
      } catch {}
      try {
        const { data: parts } = await supabase.from('chat_participants').select('user_id').eq('thread_id', threadId).neq('user_id', currentUserId);
        if (isIncoming && parts && parts.length > 0) {
          const callerId = parts[0].user_id;
          await notificationService.sendNotification({
            user_id: callerId, title: '📞 Missed Call', body: `${decodedRecipientName} missed your ${callType} call`,
            notification_type: 'missed_call', tag: `incoming-call-${threadId}`, actions: [], requireInteraction: false, silent: true,
            data: { type: 'missed_call', call_type: callType, room_id: roomId || roomIdHint || '', thread_id: threadId || '', recipient_id: currentUserId || '', recipient_name: decodedRecipientName },
          });
          await notificationService.sendNotification({
            user_id: currentUserId, title: '📞 Missed Call', body: `You missed a ${callType} call from ${decodedCallerName}`,
            notification_type: 'missed_call', tag: `incoming-call-${threadId}`, actions: [], requireInteraction: false, silent: true,
            data: { type: 'missed_call', call_type: callType, thread_id: threadId || '', caller_id: callerId, caller_name: decodedCallerName },
          });
        }
      } catch {}
    }
    setCallStatus('ended');
    onReject?.();
    setTimeout(() => onClose(), 1000);
  };

  const handleEndCall = async () => {
    const wasNeverConnected = callStatusRef.current === 'ringing' || callStatusRef.current === 'connecting';
    if (threadId && currentUserId && callStatusRef.current !== 'ended') {
      try {
        await supabaseMessagingService.sendMessage(threadId, {
          content: '📞 Call ended',
          message_type: 'call_ended',
          metadata: { callType, endedBy: currentUserId, endedAt: new Date().toISOString() },
        }, { id: currentUserId, name: user?.user_metadata?.full_name || 'User' });
      } catch {}
      if (wasNeverConnected && !isIncoming) {
        try {
          const { data: parts } = await supabase.from('chat_participants').select('user_id').eq('thread_id', threadId).neq('user_id', currentUserId);
          if (parts && parts.length > 0) {
            const callerDisplayName = decodedCallerName || user?.user_metadata?.full_name || 'Someone';
            for (const p of parts) {
              try {
                await notificationService.sendNotification({
                  user_id: p.user_id, title: '📞 Missed Call', body: `${callerDisplayName} tried to ${callType} call you`,
                  notification_type: 'missed_call', tag: `incoming-call-${threadId}`, actions: [], requireInteraction: false, silent: true,
                  data: { type: 'missed_call', call_type: callType, thread_id: threadId, caller_id: currentUserId, caller_name: callerDisplayName },
                });
              } catch {}
            }
          }
        } catch {}
      }
    }
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
      const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url')
        .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`).neq('id', currentUserId || '').limit(10);
      setAddPeopleResults(data || []);
    } catch { setAddPeopleResults([]); }
  }, [currentUserId]);

  const handleInviteToCall = useCallback(async (targetUser: { id: string; full_name: string; username: string }) => {
    if (!currentUserId || invitingUserId) return;
    setInvitingUserId(targetUser.id);
    try {
      const currentRoomId = roomId || roomIdHint;
      if (!currentRoomId) throw new Error('No active room');
      const { data: myP } = await supabase.from('chat_participants').select('thread_id').eq('user_id', currentUserId);
      const myThreadIds = (myP || []).map((p: any) => p.thread_id);
      let directThreadId: string | null = null;
      if (myThreadIds.length > 0) {
        const { data: shared } = await supabase.from('chat_participants').select('thread_id, chat_threads!inner(type)')
          .eq('user_id', targetUser.id).in('thread_id', myThreadIds);
        const dt = shared?.find((s: any) => s.chat_threads?.type === 'direct');
        if (dt) directThreadId = dt.thread_id;
      }
      if (!directThreadId) {
        const { data: newThread } = await supabase.from('chat_threads').insert({ type: 'direct' }).select().single();
        if (newThread) {
          await supabase.from('chat_participants').insert([
            { thread_id: newThread.id, user_id: currentUserId, display_name: user?.user_metadata?.full_name || 'Unknown' },
            { thread_id: newThread.id, user_id: targetUser.id, display_name: targetUser.full_name || targetUser.username },
          ]);
          directThreadId = newThread.id;
        }
      }
      if (!directThreadId) throw new Error('Could not find or create thread');
      await supabaseMessagingService.sendMessage(directThreadId, {
        content: `📞 Incoming ${callType === 'video' ? 'video' : 'audio'} call`,
        message_type: 'call_request',
        metadata: { callType, roomId: currentRoomId, callerId: currentUserId, callerName: user?.user_metadata?.full_name || 'Unknown', timestamp: new Date().toISOString() },
      }, { id: currentUserId, name: user?.user_metadata?.full_name || 'Unknown' });
      setShowAddPeople(false);
      setAddPeopleSearch('');
      setAddPeopleResults([]);
    } catch (error: any) {
      console.error('Failed to invite to call:', error);
    } finally {
      setInvitingUserId(null);
    }
  }, [currentUserId, roomId, roomIdHint, callType, user, invitingUserId]);

  // ===== EFFECTS =====

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
        if (isMountedRef.current) { setError('Failed to start call.'); setCallStatus('ended'); }
      });
    }
    return () => { if (!isOpen) cleanupResources(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isIncoming, roomIdHint, callStatus, cleanupResources]);

  // Listen for call_accepted messages (outgoing)
  useEffect(() => {
    if (!isOpen || isIncoming || !threadId) return;
    if (callStatus !== 'connecting' && callStatus !== 'ringing') return;
    let accepted = false;
    const unsub = supabaseMessagingService.subscribeToThread(threadId, (msg) => {
      if (!accepted && msg.message_type === 'call_accepted' && msg.metadata?.acceptedBy) {
        accepted = true;
        if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
        stopAllRingtones();
        if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
        if (isMountedRef.current) setCallStatus('connected');
      }
    });
    return () => { unsub(); };
  }, [isOpen, isIncoming, threadId, callStatus]);

  // Listen for call_rejected messages
  useEffect(() => {
    if (!isOpen || !threadId || !currentUserId) return;
    let rejected = false;
    const unsub = supabaseMessagingService.subscribeToThread(threadId, (msg) => {
      if (msg.thread_id !== threadId || callStatusRef.current === 'ended') return;
      if (!rejected && msg.message_type === 'call_rejected' && msg.metadata?.rejectedBy && msg.sender_id && msg.sender_id !== currentUserId) {
        rejected = true;
        if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
        stopAllRingtones();
        if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
        if (isMountedRef.current) { setCallStatus('ended'); cleanupResources(); setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000); }
      }
    });
    return () => { unsub(); };
  }, [isOpen, threadId, currentUserId, cleanupResources, onClose]);

  // Listen for call_ended messages
  useEffect(() => {
    if (!isOpen || !threadId || !currentUserId) return;
    let ended = false;
    const unsub = supabaseMessagingService.subscribeToThread(threadId, (msg) => {
      if (msg.thread_id !== threadId || callStatusRef.current === 'ended') return;
      if (!ended && msg.message_type === 'call_ended' && msg.metadata?.endedBy && msg.sender_id && msg.sender_id !== currentUserId) {
        ended = true;
        if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
        stopAllRingtones();
        if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
        if (isMountedRef.current) { setCallStatus('ended'); cleanupResources(); setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000); }
      }
    });
    return () => { unsub(); };
  }, [isOpen, threadId, currentUserId, cleanupResources, onClose]);

  // Polling fallback for call end
  useEffect(() => {
    if (!isOpen || !threadId || !currentUserId) return;
    if (callStatus === 'connected' || callStatus === 'ended') return;
    if (isAcceptingCall) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await supabase.from('chat_messages').select('id, message_type, sender_id, metadata, created_at')
          .eq('thread_id', threadId).in('message_type', ['call_ended', 'call_rejected']).neq('sender_id', currentUserId).order('created_at', { ascending: false }).limit(1);
        if (cancelled) return;
        if (data && data.length > 0 && Date.now() - new Date(data[0].created_at).getTime() < 120000) {
          if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
          stopAllRingtones();
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          if (isMountedRef.current) { setCallStatus('ended'); cleanupResources(); setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000); }
          return;
        }
      } catch {}
    };
    const interval = setInterval(poll, 3000);
    const initial = setTimeout(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); clearTimeout(initial); };
  }, [isOpen, threadId, currentUserId, callStatus, isAcceptingCall, cleanupResources, onClose]);

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

  // Call duration timer
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
        setCallStatus('connected');
      }
    };
    window.addEventListener('call-accepted', handler);
    return () => window.removeEventListener('call-accepted', handler);
  }, [threadId, isIncoming]);

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
      setCallStatus('ringing');
      callTimeoutRef.current = setTimeout(() => { handleRejectCall(); }, 45000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIncoming, isOpen, callStatus, isAcceptingCall]);

  // Auto-disconnect timeout for outgoing
  useEffect(() => {
    if (!isIncoming && callStatus === 'ringing') {
      callTimeoutRef.current = setTimeout(() => { handleEndCall(); }, 45000);
    }
    if (callStatus === 'connected' || callStatus === 'ended') {
      if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    }
    return () => { if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, isIncoming]);

  // Ringtone cleanup on status change
  useEffect(() => {
    if (callStatus === 'connected' || callStatus === 'ended') {
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
    // Derived
    decodedCallerName, decodedRecipientName, isIncoming, callType,
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
