import { useAuth } from '@/contexts/AuthContext';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';
import { ringtoneService } from '@/features/video/services/ringtoneService';
import { supabase } from '@/lib/supabase';
import { videoSDKWebRTCManager } from '@/lib/videosdk-webrtc';
import { notificationService } from '@/shared/services/notificationService';
import { MessageSquare, Mic, MicOff, PhoneOff, UserPlus, Video, VideoOff, Volume1, Volume2, X, Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Stable component for per-participant video in grid layout
const ParticipantVideo = React.memo(function ParticipantVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
});

export interface VideoSDKCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'audio' | 'video';
  callerName: string;
  recipientName: string;
  isIncoming?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCallEnd?: () => void;
  threadId?: string;
  currentUserId?: string;
  roomIdHint?: string;
  tokenHint?: string;
}

const VideoSDKCallModal: React.FC<VideoSDKCallModalProps> = ({
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
  tokenHint
}) => {
  const { user } = useAuth();
  
  // Safe URL decoding function - handles already decoded strings gracefully
  const safeDecode = (str: string): string => {
    try {
      return decodeURIComponent(str || 'Unknown');
    } catch (error) {
      // If decoding fails, return the original string (might already be decoded)
      return str || 'Unknown';
    }
  };
  
  // Decode URL-encoded names (handle %20 for spaces, etc.)
  const decodedCallerName = safeDecode(callerName);
  const decodedRecipientName = safeDecode(recipientName);
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  type SpeakerLevel = 'normal' | 'low' | 'loud';
  const [speakerLevel, setSpeakerLevel] = useState<SpeakerLevel>('normal');
  const SPEAKER_VOLUMES: Record<SpeakerLevel, number> = { normal: 0.85, loud: 1, low: 0.3 };
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [participants, setParticipants] = useState<any[]>([]);
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isAcceptingCall, setIsAcceptingCall] = useState(false);

  // Per-participant video tracking for group call grid
  const participantVideoMapRef = useRef<Map<string, MediaStream>>(new Map());
  const [participantVideoMap, setParticipantVideoMap] = useState<Map<string, MediaStream>>(new Map());

  // Add People feature
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [addPeopleSearch, setAddPeopleSearch] = useState('');
  const [addPeopleResults, setAddPeopleResults] = useState<any[]>([]);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

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
  const callStatusRef = useRef<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const videoSDKModuleRef = useRef<{ VideoSDK: any } | null>(null);
  const speakerLevelRef = useRef<SpeakerLevel>(speakerLevel);

  useEffect(() => {
    speakerLevelRef.current = speakerLevel;
  }, [speakerLevel]);

  // Preload VideoSDK when incoming call modal opens so Accept is faster
  useEffect(() => {
    if (isOpen && isIncoming && roomIdHint) {
      import('@videosdk.live/js-sdk').then((mod) => {
        videoSDKModuleRef.current = mod;
      }).catch(() => {});
    }
  }, [isOpen, isIncoming, roomIdHint]);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const cleanupResources = useCallback(() => {
    // Clear timeout first
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Stop ringtone
    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.stop();
      } catch {
      }
      ringtoneRef.current = null;
    }
    ringtoneService.stopRingtone();

    // Leave the VideoSDK meeting BEFORE stopping streams
    if (currentMeetingRef.current) {
      try {
        currentMeetingRef.current.leave();
      } catch {
      }
      currentMeetingRef.current = null;
    }

    // Stop local stream
    const currentLocalStream = localStreamRef.current;
    if (currentLocalStream) {
      try {
        currentLocalStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {
      }
      localStreamRef.current = null;
    }
    if (isMountedRef.current) {
      updateLocalStream(null);
    }

    // Stop remote streams
    if (remoteStreamsRef.current.length) {
      remoteStreamsRef.current.forEach((stream) => {
        try {
          stream.getTracks().forEach((track) => {
            track.stop();
          });
        } catch {
        }
      });
      remoteStreamsRef.current = [];
    }
    if (isMountedRef.current) {
      updateRemoteStreams(() => []);
    }

    // Clear video/audio element references
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    // Keep these for backward compatibility (if any other code uses them)
    try {
      videoSDKWebRTCManager.leaveMeeting();
      videoSDKWebRTCManager.setLocalStream(null);
      // videoSDKService.leaveRoom();
    } catch {
    }

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

  // Cleanup on unmount (e.g. when parent sets call=false in URL and unmounts this modal)
  useEffect(() => {
    return () => {
      if (hasInitializedRef.current || currentMeetingRef.current) {
        cleanupResources();
      }
    };
  }, [cleanupResources]);

  // Initialize room and get media when call starts
  useEffect(() => {
    if (!isOpen) {
      // Only cleanup if we're actually closing, not just initializing
      if (hasInitializedRef.current || currentMeetingRef.current) {
        cleanupResources();
      }
      // Reset accepting state when modal closes
      setIsAcceptingCall(false);
      return;
    }

    // For incoming calls, DON'T initialize - wait for user to accept
    if (isIncoming) {
      if (roomIdHint) {
        setRoomId(roomIdHint);
        // Set status to ringing for incoming calls
        if (callStatus === 'connecting') {
          setCallStatus('ringing');
        }
      }
      return; // Don't initialize call automatically for incoming calls
    }

    // For outgoing calls, initialize immediately
    if (!isIncoming) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        initializeCall().catch(() => {
          if (isMountedRef.current) {
            setError('Failed to start call. Please try again.');
            setCallStatus('ended');
          }
        });
      }
    }

    return () => {
      // Only cleanup on unmount or when closing
      if (!isOpen) {
        cleanupResources();
      }
    };
    // We intentionally exclude initializeCall from deps to avoid re-running on state updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isIncoming, roomIdHint, callStatus, cleanupResources]);

  // Listen for call_accepted messages (for caller's side) - Set up early for outgoing calls
  useEffect(() => {
    // Only set up for outgoing calls (not incoming)
    if (!isOpen || isIncoming || !threadId) {
      return;
    }

    // Set up listener when status is 'connecting' or 'ringing' (for outgoing calls)
    if (callStatus !== 'connecting' && callStatus !== 'ringing') {
      return;
    }

    let hasAccepted = false; // Guard to prevent multiple triggers

    const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
      if (!hasAccepted && message.message_type === 'call_accepted' && message.metadata?.acceptedBy) {
        hasAccepted = true; // Prevent re-triggering

        // Stop ringtone immediately
        if (ringtoneRef.current) {
          ringtoneRef.current.stop();
          ringtoneRef.current = null;
        }
        ringtoneService.stopRingtone();

        // Clear timeout
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }

        // Transition to connected state
        // Note: The actual connection happens via participant-joined event
        // This just updates the UI state
        if (isMountedRef.current) {
          setCallStatus('connected');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, isIncoming, threadId, callStatus]); // Added callStatus dependency

  // Listen for call_rejected messages (for both caller and receiver)
  // Set up as soon as modal opens and keep it active until modal closes
  useEffect(() => {
    if (!isOpen || !threadId || !currentUserId) {
      return;
    }

    let hasRejected = false; // Guard to prevent multiple triggers

    const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
      // Verify message belongs to this thread
      if (message.thread_id !== threadId) {
        return;
      }

      // Log all call-related messages for debugging
      if (message.message_type === 'call_rejected' || message.message_type === 'call_accepted' || message.message_type === 'call_request') {
      }

      // Only process if message is from the other participant (not from current user)
      // Check current status to avoid processing if call is already ended
      if (callStatusRef.current === 'ended') {
        return;
      }

      // Check if this is a rejection message from the other participant
      const isRejectionMessage = message.message_type === 'call_rejected';
      const isFromOtherUser = message.sender_id && message.sender_id !== currentUserId;
      const hasRejectionMetadata = message.metadata?.rejectedBy;

      if (!hasRejected && isRejectionMessage && hasRejectionMetadata && isFromOtherUser) {
 
        hasRejected = true; // Prevent re-triggering

        // Stop ringtone immediately
        if (ringtoneRef.current) {
          ringtoneRef.current.stop();
          ringtoneRef.current = null;
        }
        ringtoneService.stopRingtone();

        // Clear timeout
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }

        // End the call and close modal
        if (isMountedRef.current) {
          setCallStatus('ended');
          cleanupResources();
          setTimeout(() => {
            if (isMountedRef.current) {
              onClose();
            }
          }, 1000);
        }
      } else if (isRejectionMessage && !isFromOtherUser) {
      } else if (isRejectionMessage && !hasRejectionMetadata) {
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, threadId, currentUserId, cleanupResources, onClose]);

  // Listen for call_ended messages (for both caller and receiver)
  // Set up as soon as modal opens and keep it active until modal closes
  useEffect(() => {
    if (!isOpen || !threadId || !currentUserId) {
      return;
    }

    let hasEnded = false; // Guard to prevent multiple triggers

    const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
      // Verify message belongs to this thread
      if (message.thread_id !== threadId) {
        return;
      }

      // Only process if message is from the other participant (not from current user)
      // Check current status to avoid processing if call is already ended
      if (callStatusRef.current === 'ended') {
        return;
      }

      // Check if this is an end message from the other participant
      const isEndMessage = message.message_type === 'call_ended';
      const isFromOtherUser = message.sender_id && message.sender_id !== currentUserId;
      const hasEndMetadata = message.metadata?.endedBy;

      if (!hasEnded && isEndMessage && hasEndMetadata && isFromOtherUser) {
        hasEnded = true; // Prevent re-triggering

        // Stop ringtone immediately
        if (ringtoneRef.current) {
          ringtoneRef.current.stop();
          ringtoneRef.current = null;
        }
        ringtoneService.stopRingtone();

        // Clear timeout
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }

        // End the call and close modal
        if (isMountedRef.current) {
          setCallStatus('ended');
          cleanupResources();
          setTimeout(() => {
            if (isMountedRef.current) {
              onClose();
            }
          }, 1000);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, threadId, currentUserId, cleanupResources, onClose]);

  const addRemoteStream = (stream: MediaStream) => {
    updateRemoteStreams((prev) => {
      const newTracks = [...stream.getAudioTracks(), ...stream.getVideoTracks()];
      const newTrackIds = new Set(newTracks.map(t => t.id));
      
      // Check if any of the new tracks already exist in previous streams
      const hasDuplicate = prev.some(existing => {
        const existingTracks = [...existing.getAudioTracks(), ...existing.getVideoTracks()];
        return existingTracks.some(track => newTrackIds.has(track.id));
      });
      
      if (hasDuplicate) {
        return prev; // Don't add duplicate
      }
      
      // Also check by stream.id for exact matches
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
      // Remove streams that contain the track with this ID
      return prev.filter((stream) => {
        const allTracks = [...stream.getAudioTracks(), ...stream.getVideoTracks()];
        return !allTracks.some(track => track.id === trackId);
      });
    });
  };

  // Helper function to get VideoSDK JWT token
  // Uses Next.js API route at /api/videosdk/token
  const getVideoSDKToken = async (meetingId?: string, userId?: string): Promise<string> => {
    // Use provided meetingId or roomIdHint (room should already be created)
    const roomId = meetingId || roomIdHint;
    if (!roomId) {
      throw new Error('Room ID is required. Please create a room first.');
    }
    const userIdValue = userId || user?.id || '';

    // Get auth token if available
    let authToken: string | undefined;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      authToken = sessionData.session?.access_token;
    } catch {
    }

    const response = await fetch('/api/videosdk/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({
        roomId,
        userId: userIdValue,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Failed to get VideoSDK token: ${errorMessage}`);
    }

    const data = await response.json();

    if (!data?.token || typeof data.token !== 'string') {
      throw new Error('Failed to get VideoSDK token from API: no token in response');
    }

    return data.token as string;
  };

  const initializeCall = async () => {
    try {
      setCallStatus('connecting');
      setError('');

      let meetingId = roomIdHint;
      
      // Create room if it doesn't exist
      if (!meetingId) {
        const roomResponse = await fetch('/api/videosdk/room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!roomResponse.ok) {
          const errorData = await roomResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create call room. Please try again.');
        }

        const roomData = await roomResponse.json();
        meetingId = roomData.roomId;
        
        if (!meetingId) {
          throw new Error('Failed to create call room. Please try again.');
        }
      }
      // Get secure JWT token from Supabase edge function
      const token = await getVideoSDKToken(meetingId, user?.id);
      setRoomId(meetingId);
      // Dynamically import VideoSDK to avoid SSR issues
      const { VideoSDK } = await import('@videosdk.live/js-sdk');
      // Validate token format (should be a JWT with 3 parts)
      if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
        throw new Error('Invalid VideoSDK token format. Token must be a valid JWT.');
      }
      
      // Configure VideoSDK with token (must be called before initMeeting)
      try {
        VideoSDK.config(token);
      } catch (configError: any) {
        throw new Error(`Failed to configure VideoSDK: ${configError.message || 'Unknown error'}`);
      }

      // Initialize VideoSDK meeting
      let meeting;
      try {
        meeting = VideoSDK.initMeeting({
          meetingId,
          name: user?.user_metadata?.full_name || user?.email || 'User',
          micEnabled: true,
          webcamEnabled: callType === 'video' && isVideoEnabled,
        });
      } catch (initError: any) {
        throw new Error(`Failed to initialize meeting: ${initError.message || 'Unknown error'}`);
      }

      // Store meeting reference for cleanup
      currentMeetingRef.current = meeting;

      // Set WebRTC callbacks BEFORE joining (CRITICAL FIX)
      meeting.on("meeting-joined", () => {
        if (isMountedRef.current) {
          setCallStatus(isIncoming ? 'connected' : 'ringing');

          if (!isIncoming) {
            ringtoneService.playRingtone().then(r => {
              if (isMountedRef.current) {
                ringtoneRef.current = r;
              }
            });
          }

          // Get local stream from VideoSDK meeting after joining
          try {
            const localParticipant = meeting.localParticipant;
            if (localParticipant) {
              // Listen for local stream enabled event
              if (localParticipant.on) {
                localParticipant.on("stream-enabled", (stream: any) => {
                  if (stream.kind === 'video' && callType === 'video' && stream.track) {
                    // Create new MediaStream with the new video track
                    // If we have an existing localStream with audio, preserve it
                    const newVideoStream = new MediaStream([stream.track]);
                    
                    // If we have existing audio tracks, add them to the new stream
                    if (localStreamRef.current) {
                      const audioTracks = localStreamRef.current.getAudioTracks();
                      audioTracks.forEach(track => {
                        if (track.readyState !== 'ended') {
                          newVideoStream.addTrack(track);
                        }
                      });
                    }
                    
                    updateLocalStream(newVideoStream);
                    
                    // Update video element immediately
                    if (localVideoRef.current) {
                      localVideoRef.current.srcObject = newVideoStream;
                      localVideoRef.current.play().catch(() => {});
                    }
                  }
                });

                localParticipant.on("stream-disabled", (stream: any) => {
                  if (stream.kind === 'video') {
                    // Clear video element but keep audio
                    if (localVideoRef.current) {
                      localVideoRef.current.srcObject = null;
                    }
                    // Update local stream to remove video track but keep audio
                    if (localStreamRef.current) {
                      const audioTracks = localStreamRef.current.getAudioTracks();
                      if (audioTracks.length > 0) {
                        const audioOnlyStream = new MediaStream(audioTracks);
                        updateLocalStream(audioOnlyStream);
                      } else {
                        updateLocalStream(null);
                      }
                    }
                  }
                });
              }

              // Try to get existing video track if available
              // Note: VideoSDK manages streams internally, we'll rely on stream-enabled events
              // But also check if we can access the track directly
              setTimeout(() => {
                try {
                  // VideoSDK may expose tracks differently, try accessing via mediaStream
                  if ((localParticipant as any).mediaStream) {
                    const ms = (localParticipant as any).mediaStream;
                    if (ms && ms.getVideoTracks && ms.getVideoTracks().length > 0) {
                      const track = ms.getVideoTracks()[0];
                      const localVideoStream = new MediaStream([track]);
                      updateLocalStream(localVideoStream);
                    }
                  }
                } catch (err) {
                }
              }, 500);
            }
          } catch (error) {
          }
        }
      });

      meeting.on("participant-joined", (participant: any) => {
        if (isMountedRef.current) {
          // FIXED: Update status to 'connected' when participant joins (for outgoing calls)
          if (!isIncoming && (callStatusRef.current === 'ringing' || callStatusRef.current === 'connecting')) {
            setCallStatus('connected');
            // Stop ringtone when participant joins
            if (ringtoneRef.current) {
              ringtoneRef.current.stop();
              ringtoneRef.current = null;
            }
            ringtoneService.stopRingtone();
          }

          setParticipants(prev => {
            const exists = prev.find(x => x.id === participant.id);
            if (exists) return prev;
            const updated = [...prev, participant];
            
            // FIXED: Subscribe to participant's streams using VideoSDK API
            try {
              // Subscribe to participant stream events
              if (participant.on) {
                participant.on("stream-enabled", (stream: any) => {
                  if (stream.kind === 'video' && stream.track) {
                    const videoStream = new MediaStream([stream.track]);

                    // Track per-participant video for grid layout
                    participantVideoMapRef.current.set(participant.id, videoStream);
                    if (isMountedRef.current) {
                      setParticipantVideoMap(new Map(participantVideoMapRef.current));
                    }

                    addRemoteStream(videoStream);

                    // Update remote video element for 1-on-1 calls
                    if (remoteVideoRef.current && callType === 'video') {
                      remoteVideoRef.current.srcObject = videoStream;
                      remoteVideoRef.current.play().catch(() => {});
                    }
                  } else if (stream.kind === 'audio' && stream.track) {
                    const audioStream = new MediaStream([stream.track]);
                    addRemoteStream(audioStream);
                  }
                });

                participant.on("stream-disabled", (stream: any) => {
                  if (stream.track) {
                    removeRemoteStream(stream.track.id);
                  }
                  // Remove participant video from grid map
                  if (stream.kind === 'video') {
                    participantVideoMapRef.current.delete(participant.id);
                    if (isMountedRef.current) {
                      setParticipantVideoMap(new Map(participantVideoMapRef.current));
                    }
                  }
                });
              }

              // Check if participant already has active streams
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
              
            } catch (error) {
            }
            
            return updated;
          });
        }
      });

      meeting.on("participant-left", (p: any) => {
        if (isMountedRef.current) {
          // Clean up participant video for grid layout
          participantVideoMapRef.current.delete(p.id);
          setParticipantVideoMap(new Map(participantVideoMapRef.current));

          setParticipants(prev => {
            const updated = prev.filter((x: any) => x.id !== p.id);
            
            // Check if there are any remote participants left in the meeting
            // This provides a more reliable check than just our state
            let hasRemoteParticipants = false;
            try {
              const localParticipantId = meeting.localParticipant?.id;
              const allParticipants = meeting.participants 
                ? Object.values(meeting.participants) 
                : [];
              const remoteParticipants = allParticipants.filter(
                (participant: any) => participant.id !== localParticipantId
              );
              hasRemoteParticipants = remoteParticipants.length > 0;
            } catch (error) {
              // Fallback to state-based check
              hasRemoteParticipants = updated.length > 0;
            }
            
            // If no more remote participants and call is connected, automatically close the call
            if (!hasRemoteParticipants && callStatusRef.current === 'connected') {
              // Send call_ended notification
              if (threadId && currentUserId) {
                supabaseMessagingService.sendMessage(
                  threadId,
                  {
                    content: `📞 Call ended`,
                    message_type: 'call_ended',
                    metadata: {
                      callType: callType,
                      endedBy: currentUserId,
                      endedAt: new Date().toISOString()
                    }
                  },
                  { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
                ).catch(() => {});
              }
              
              // Close the call
              setCallStatus('ended');
              cleanupResources();
              setTimeout(() => {
                if (isMountedRef.current) {
                  onClose();
                }
              }, 1000);
            }
            
            return updated;
          });
        }
      });

      // Add handler for when meeting ends unexpectedly
      meeting.on("meeting-left", async () => {
        // Send call_ended notification if meeting ends unexpectedly
        if (threadId && currentUserId && callStatusRef.current !== 'ended') {
          try {
            await supabaseMessagingService.sendMessage(
              threadId,
              {
                content: `📞 Call ended`,
                message_type: 'call_ended',
                metadata: {
                  callType: callType,
                  endedBy: currentUserId,
                  endedAt: new Date().toISOString()
                }
              },
              { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
            );
          } catch (msgError) {
          }
        }
        
        if (isMountedRef.current) {
          setCallStatus('ended');
          cleanupResources();
          setTimeout(() => {
            if (isMountedRef.current) {
              onClose();
            }
          }, 1000);
        } else {
          cleanupResources();
        }
      });
      
      // Add connection timeout (30 seconds)
      const joinTimeout = setTimeout(() => {
        if (isMountedRef.current && currentMeetingRef.current) {
          if (isMountedRef.current) {
            setError('Connection timeout. Please check your internet connection and try again.');
            setCallStatus('ended');
          }
          cleanupResources();
        }
      }, 30000);
      
      try {
        await meeting.join();
        clearTimeout(joinTimeout);
      } catch (joinError: any) {
        clearTimeout(joinTimeout);
        throw joinError;
      }

      // Local media setup - VideoSDK handles media internally
      // We still get local stream for preview and local controls
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video' && isVideoEnabled,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1
          }
        });

        updateLocalStream(stream);

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = true;

        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Enable tracks in VideoSDK meeting
        if (callType === 'video' && isVideoEnabled) {
          meeting.enableWebcam();
        }
        meeting.unmuteMic();
      } catch (mediaError: any) {
        // VideoSDK will request permissions itself, so this is not critical
      }

      // Ensure meeting is still valid before proceeding
      if (!currentMeetingRef.current) {
        throw new Error('Meeting initialization failed');
      }

    } catch (error: any) {
      setError(`Failed to start call: ${error.message || 'Please check permissions and try again.'}`);
      setCallStatus('ended');
      cleanupResources();
    }
  };

  const handleAcceptCall = async () => {
    // Prevent multiple clicks - disable button if already accepting
    if (isAcceptingCall) {
      return;
    }

    setIsAcceptingCall(true);

    try {
      // Stop ringtone immediately
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      ringtoneService.stopRingtone();

      if (!roomIdHint) {
        setError('Cannot accept call - missing room information.');
        setIsAcceptingCall(false); // Reset on error
        return;
      }

      setCallStatus('connecting');

      // CRITICAL: Always generate a NEW token for the receiver with their own userId
      // NEVER use tokenHint - tokens contain participantId in JWT payload
      if (tokenHint) {
      }

      // Run token fetch and SDK load in parallel to reduce delay
      const [token, sdkModule] = await Promise.all([
        getVideoSDKToken(roomIdHint, user?.id),
        videoSDKModuleRef.current ? Promise.resolve(videoSDKModuleRef.current) : import('@videosdk.live/js-sdk')
      ]);
      const { VideoSDK } = sdkModule;
      setRoomId(roomIdHint);
      
      // Validate token format (should be a JWT with 3 parts)
      if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
        throw new Error('Invalid VideoSDK token format. Token must be a valid JWT.');
      }
      
      // Configure VideoSDK with token (must be called before initMeeting)
      try {
        VideoSDK.config(token);
      } catch (configError: any) {
        throw new Error(`Failed to configure VideoSDK: ${configError.message || 'Unknown error'}`);
      }

      // Initialize VideoSDK meeting for accepted call
      let meeting;
      try {
        meeting = VideoSDK.initMeeting({
          meetingId: roomIdHint,
          name: user?.user_metadata?.full_name || user?.email || 'User',
          micEnabled: true,
          webcamEnabled: callType === 'video' && isVideoEnabled,
        });
      } catch (initError: any) {
        throw new Error(`Failed to initialize meeting: ${initError.message || 'Unknown error'}`);
      }

      // Store meeting reference for cleanup
      currentMeetingRef.current = meeting;

      // Set WebRTC callbacks BEFORE joining (CRITICAL FIX)
      meeting.on("meeting-joined", () => {
        if (isMountedRef.current) {
          setCallStatus('connected');

          // Get existing participants when joining (for accepted calls)
          // Use setTimeout to ensure meeting.participants is populated
          setTimeout(() => {
            try {
              // Get participants from meeting object (exclude local participant)
              const localParticipantId = meeting.localParticipant?.id;
              const allParticipants = meeting.participants 
                ? Object.values(meeting.participants) 
                : [];
              
              // Filter out local participant
              const existingParticipants = allParticipants.filter(
                (p: any) => p.id !== localParticipantId
              );
              
              if (existingParticipants.length > 0) {
                setParticipants(prev => {
                  const updated = [...prev];
                  existingParticipants.forEach((participant: any) => {
                    const exists = updated.find(x => x.id === participant.id);
                    if (!exists) {
                      updated.push(participant);
                      // Set up stream listeners for existing participants
                      if (participant.on) {
                        participant.on("stream-enabled", (stream: any) => {
                          if (stream.kind === 'video' && stream.track) {
                            // Remove any existing video streams from this participant first
                            updateRemoteStreams((prev) => {
                              return prev.filter((s) => {
                                const hasVideo = s.getVideoTracks().length > 0;
                                return !hasVideo;
                              });
                            });
                            
                            // Create new video stream with the new track
                            const videoStream = new MediaStream([stream.track]);
                            addRemoteStream(videoStream);
                            
                            // Update remote video element immediately
                            if (remoteVideoRef.current && callType === 'video') {
                              remoteVideoRef.current.srcObject = videoStream;
                              remoteVideoRef.current.play().catch(() => {});
                            }
                          } else if (stream.kind === 'audio' && stream.track) {
                            const audioStream = new MediaStream([stream.track]);
                            addRemoteStream(audioStream);
                          }
                        });

                        participant.on("stream-disabled", (stream: any) => {
                          if (stream.track) {
                            removeRemoteStream(stream.track.id);
                          }
                        });
                      }

                      // Check for existing streams
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
                      
                    }
                  });
                  return updated;
                });
              }
            } catch {
            }
          }, 500);

          // Get local stream from VideoSDK meeting after joining
          try {
            const localParticipant = meeting.localParticipant;
            if (localParticipant) {
              // Listen for local stream enabled event
              if (localParticipant.on) {
                localParticipant.on("stream-enabled", (stream: any) => {
                  if (stream.kind === 'video' && callType === 'video' && stream.track) {
                    // Create new MediaStream with the new video track
                    // If we have an existing localStream with audio, preserve it
                    const newVideoStream = new MediaStream([stream.track]);
                    
                    // If we have existing audio tracks, add them to the new stream
                    if (localStreamRef.current) {
                      const audioTracks = localStreamRef.current.getAudioTracks();
                      audioTracks.forEach(track => {
                        if (track.readyState !== 'ended') {
                          newVideoStream.addTrack(track);
                        }
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
                    // Clear video element but keep audio
                    if (localVideoRef.current) {
                      localVideoRef.current.srcObject = null;
                    }
                    // Update local stream to remove video track but keep audio
                    if (localStreamRef.current) {
                      const audioTracks = localStreamRef.current.getAudioTracks();
                      if (audioTracks.length > 0) {
                        const audioOnlyStream = new MediaStream(audioTracks);
                        updateLocalStream(audioOnlyStream);
                      } else {
                        updateLocalStream(null);
                      }
                    }
                  }
                });
              }

              // Try to get existing video track if available
              setTimeout(() => {
                try {
                  if ((localParticipant as any).mediaStream) {
                    const ms = (localParticipant as any).mediaStream;
                    if (ms && ms.getVideoTracks && ms.getVideoTracks().length > 0) {
                      const track = ms.getVideoTracks()[0];
                      const localVideoStream = new MediaStream([track]);
                      updateLocalStream(localVideoStream);
                    }
                  }
                } catch (err) {
                }
              }, 500);
            }
          } catch (error) {
          }
        }
      });

      meeting.on("participant-joined", (participant: any) => {
        if (isMountedRef.current) {
          setParticipants(prev => {
            const exists = prev.find(x => x.id === participant.id);
            if (exists) return prev;
            const updated = [...prev, participant];
            
            // FIXED: Subscribe to participant's streams using VideoSDK API
            try {
              // Subscribe to participant stream events
              if (participant.on) {
                participant.on("stream-enabled", (stream: any) => {
                  if (stream.kind === 'video' && stream.track) {
                    const videoStream = new MediaStream([stream.track]);

                    // Track per-participant video for grid layout
                    participantVideoMapRef.current.set(participant.id, videoStream);
                    if (isMountedRef.current) {
                      setParticipantVideoMap(new Map(participantVideoMapRef.current));
                    }

                    addRemoteStream(videoStream);

                    // Update remote video element for 1-on-1 calls
                    if (remoteVideoRef.current && callType === 'video') {
                      remoteVideoRef.current.srcObject = videoStream;
                      remoteVideoRef.current.play().catch(() => {});
                    }
                  } else if (stream.kind === 'audio' && stream.track) {
                    const audioStream = new MediaStream([stream.track]);
                    addRemoteStream(audioStream);
                  }
                });

                participant.on("stream-disabled", (stream: any) => {
                  if (stream.track) {
                    removeRemoteStream(stream.track.id);
                  }
                  // Remove participant video from grid map
                  if (stream.kind === 'video') {
                    participantVideoMapRef.current.delete(participant.id);
                    if (isMountedRef.current) {
                      setParticipantVideoMap(new Map(participantVideoMapRef.current));
                    }
                  }
                });
              }

              // Check if participant already has active streams
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
              
            } catch (error) {
            }
            
            return updated;
          });
        }
      });

      meeting.on("participant-left", (p: any) => {
        if (isMountedRef.current) {
          // Clean up participant video for grid layout
          participantVideoMapRef.current.delete(p.id);
          setParticipantVideoMap(new Map(participantVideoMapRef.current));

          setParticipants(prev => {
            const updated = prev.filter((x: any) => x.id !== p.id);
            
            // Check if there are any remote participants left in the meeting
            // This provides a more reliable check than just our state
            let hasRemoteParticipants = false;
            try {
              const localParticipantId = meeting.localParticipant?.id;
              const allParticipants = meeting.participants 
                ? Object.values(meeting.participants) 
                : [];
              const remoteParticipants = allParticipants.filter(
                (participant: any) => participant.id !== localParticipantId
              );
              hasRemoteParticipants = remoteParticipants.length > 0;
            } catch (error) {
              // Fallback to state-based check
              hasRemoteParticipants = updated.length > 0;
            }
            
            // If no more remote participants and call is connected, automatically close the call
            if (!hasRemoteParticipants && callStatusRef.current === 'connected') {
              // Send call_ended notification
              if (threadId && currentUserId) {
                supabaseMessagingService.sendMessage(
                  threadId,
                  {
                    content: `📞 Call ended`,
                    message_type: 'call_ended',
                    metadata: {
                      callType: callType,
                      endedBy: currentUserId,
                      endedAt: new Date().toISOString()
                    }
                  },
                  { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
                ).catch(() => {});
              }
              
              // Close the call
              setCallStatus('ended');
              cleanupResources();
              setTimeout(() => {
                if (isMountedRef.current) {
                  onClose();
                }
              }, 1000);
            }
            
            return updated;
          });
        }
      });

      // Add handler for when meeting ends unexpectedly (for accepted calls)
      meeting.on("meeting-left", async () => {
        // Send call_ended notification if meeting ends unexpectedly
        if (threadId && currentUserId && callStatusRef.current !== 'ended') {
          try {
            await supabaseMessagingService.sendMessage(
              threadId,
              {
                content: `📞 Call ended`,
                message_type: 'call_ended',
                metadata: {
                  callType: callType,
                  endedBy: currentUserId,
                  endedAt: new Date().toISOString()
                }
              },
              { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
            );
          } catch (msgError) {
          }
        }
        
        if (isMountedRef.current) {
          setCallStatus('ended');
          cleanupResources();
          setTimeout(() => {
            if (isMountedRef.current) {
              onClose();
            }
          }, 1000);
        } else {
          cleanupResources();
        }
      });

      // Join first so "connected" happens quickly; get local media after join (reduces accept delay)
      if (!currentMeetingRef.current) {
        throw new Error('Meeting initialization failed');
      }
      await meeting.join();

      // Get local stream after join (non-blocking so caller gets call_accepted immediately)
      const attachLocalMedia = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: callType === 'video' && isVideoEnabled,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 1
            }
          });
          if (!currentMeetingRef.current || !isMountedRef.current) return;
          updateLocalStream(stream);
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) audioTrack.enabled = true;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          if (callType === 'video' && isVideoEnabled) {
            meeting.enableWebcam();
          }
          meeting.unmuteMic();
        } catch (mediaError: any) {
        }
      };
      void attachLocalMedia();

      // Send call_accepted notification to caller
      if (threadId && currentUserId) {
        try {
          await supabaseMessagingService.sendMessage(
            threadId,
            {
              content: `✅ Call accepted`,
              message_type: 'call_accepted',
              metadata: {
                callType: callType,
                acceptedBy: currentUserId,
                acceptedAt: new Date().toISOString()
              }
            },
            { id: currentUserId, name: decodedRecipientName }
          );
        } catch (msgError) {
          // Don't fail the call if message sending fails
        }
      }

      onAccept?.();
    } catch (error: any) {
      setError(`Failed to accept call: ${error.message || 'Please check your camera and microphone permissions.'}`);
      setCallStatus('ended');
      setIsAcceptingCall(false); // Reset on error
      cleanupResources();
    }
  };

  const handleRejectCall = async () => {
    // Stop ringtone immediately
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current = null;
    }
    ringtoneService.stopRingtone();
    
    // Send call_rejected notification to the other participant
    if (threadId && currentUserId) {
      try {
        await supabaseMessagingService.sendMessage(
          threadId,
          {
            content: `❌ Call rejected`,
            message_type: 'call_rejected',
            metadata: {
              callType: callType,
              rejectedBy: currentUserId,
              rejectedAt: new Date().toISOString()
            }
          },
          { id: currentUserId, name: isIncoming ? decodedRecipientName : decodedCallerName }
        );
      } catch (msgError) {
        // Don't fail the rejection if message sending fails
      }

      // Send missed call notification to the caller (separate try-catch to ensure it runs)
      try {
        // Get thread participants to find the other participant
        const { data: participants, error: participantsError } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('thread_id', threadId)
          .neq('user_id', currentUserId) // Get the other participant

        if (participantsError || !participants || participants.length === 0) {
          return;
        }

        // Only send notification for incoming call rejections (when recipient rejects)
        if (!isIncoming) {
          return;
        }

        const callerId = participants[0].user_id; // The caller (other participant)
        const recipientWhoRejected = decodedRecipientName; // The recipient who rejected
        const currentRoomId = roomId || roomIdHint; // Get the room ID

        // Fetch recipient's (current user's) profile image
        let recipientImage: string | undefined;
        try {
          const { data: recipientProfile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', currentUserId)
            .single();
          recipientImage = recipientProfile?.avatar_url || undefined;
        } catch {
          // Continue without image if fetch fails
        }

        await notificationService.sendNotification({
          user_id: callerId,
          title: 'Missed Call',
          body: `${recipientWhoRejected} missed your ${callType} call`,
          notification_type: 'missed_call',
          image: recipientImage, // Recipient's profile image
          data: {
            type: 'missed_call',
            call_type: callType,
            room_id: currentRoomId || '',
            thread_id: threadId || '',
            recipient_id: currentUserId || '',
            recipient_name: recipientWhoRejected,
            recipient_image: recipientImage || '',
          }
        });
      } catch (notificationError) {
        // Don't fail the rejection if notification fails
      }
    }
    
    setCallStatus('ended');
    onReject?.();
    setTimeout(() => onClose(), 1000);
  };

  const handleEndCall = async () => {
    // Send call_ended notification to the other participant
    if (threadId && currentUserId && callStatusRef.current !== 'ended') {
      try {
        await supabaseMessagingService.sendMessage(
          threadId,
          {
            content: `📞 Call ended`,
            message_type: 'call_ended',
            metadata: {
              callType: callType,
              endedBy: currentUserId,
              endedAt: new Date().toISOString()
            }
          },
          { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
        );
      } catch (msgError) {
        // Don't fail the call end if message sending fails
      }
    }
    
    cleanupResources();
    onCallEnd?.();
    setTimeout(() => onClose(), 1000);
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // FIXED: Use VideoSDK meeting methods for mute/unmute
    if (currentMeetingRef.current) {
      try {
        if (newMutedState) {
          currentMeetingRef.current.muteMic();
        } else {
          currentMeetingRef.current.unmuteMic();
        }
      } catch (error) {
      }
    }

    // Also update local track for immediate UI feedback
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !newMutedState;
      }
    }
  };

  const toggleVideo = async () => {
    if (callType === 'video') {
      const newVideoState = !isVideoEnabled;
      setIsVideoEnabled(newVideoState);

      // FIXED: Use VideoSDK meeting methods for video enable/disable
      if (currentMeetingRef.current) {
        try {
          if (newVideoState) {
            // When enabling camera, VideoSDK will create a NEW track
            // We need to wait for the stream-enabled event to update local stream
            currentMeetingRef.current.enableWebcam();
            
            // VideoSDK will trigger stream-enabled event for local participant
            // The event listener (set up in meeting-joined) will handle updating localStream
            // But we also try to get the track directly after a short delay as fallback
            setTimeout(async () => {
              try {
                const localParticipant = currentMeetingRef.current?.localParticipant;
                if (localParticipant) {
                  const videoStreams = localParticipant.getVideoStreams?.() || [];
                  if (videoStreams.length > 0 && videoStreams[0].track) {
                    const newVideoStream = new MediaStream([videoStreams[0].track]);
                    updateLocalStream(newVideoStream);
                    
                    // Update video element
                    if (localVideoRef.current) {
                      localVideoRef.current.srcObject = newVideoStream;
                      localVideoRef.current.play().catch(() => {});
                    }
                  }
                }
              } catch {
              }
            }, 500);
          } else {
            // When disabling, stop the track and clear local stream
            currentMeetingRef.current.disableWebcam();
            
            // Stop local video track
            if (localStream) {
              const videoTrack = localStream.getVideoTracks()[0];
              if (videoTrack) {
                videoTrack.stop();
              }
            }
            
            // Clear local video element
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = null;
            }
            
            // Clear local stream state (but keep audio)
            // Actually, we should keep the stream but just remove video track
            // Let VideoSDK handle it via stream-disabled event
          }
        } catch (error) {
          // Revert state on error
          setIsVideoEnabled(!newVideoState);
        }
      } else {
        // Revert state if no meeting
        setIsVideoEnabled(!newVideoState);
      }
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
        const playPromise = audioElement.play();
        if (playPromise) playPromise.catch(() => undefined);
        // Re-apply volume after a tick (some browsers reset on play)
        requestAnimationFrame(() => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.volume = vol;
            remoteAudioRef.current.muted = false;
          }
        });
      }
      return next;
    });
  };


  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      if (threadId && currentUserId) {
        await supabaseMessagingService.sendMessage(
          threadId,
          {
            content: messageText,
            message_type: 'text'
          },
          { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
        );
        setMessageText('');
        setShowMessageInput(false);
      }
    } catch (error) {
    }
  };

  // Search users to invite to the call
  const searchUsersForInvite = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setAddPeopleResults([]);
      return;
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
        .neq('id', currentUserId || '')
        .limit(10);
      setAddPeopleResults(data || []);
    } catch {
      setAddPeopleResults([]);
    }
  }, [currentUserId]);

  // Invite a user to the current call
  const handleInviteToCall = useCallback(async (targetUser: { id: string; full_name: string; username: string }) => {
    if (!currentUserId || invitingUserId) return;
    setInvitingUserId(targetUser.id);
    try {
      const currentRoomId = roomId || roomIdHint;
      if (!currentRoomId) throw new Error('No active room');

      // Find an existing direct thread with the target user
      const { data: myParticipations } = await supabase
        .from('chat_participants')
        .select('thread_id')
        .eq('user_id', currentUserId);

      const myThreadIds = (myParticipations || []).map((p: any) => p.thread_id);
      let directThreadId: string | null = null;

      if (myThreadIds.length > 0) {
        const { data: shared } = await supabase
          .from('chat_participants')
          .select('thread_id, chat_threads!inner(type)')
          .eq('user_id', targetUser.id)
          .in('thread_id', myThreadIds);

        const directThread = shared?.find((s: any) => s.chat_threads?.type === 'direct');
        if (directThread) directThreadId = directThread.thread_id;
      }

      // Create new direct thread if none exists
      if (!directThreadId) {
        const { data: newThread } = await supabase
          .from('chat_threads')
          .insert({ type: 'direct' })
          .select()
          .single();

        if (newThread) {
          await supabase.from('chat_participants').insert([
            { thread_id: newThread.id, user_id: currentUserId, display_name: user?.user_metadata?.full_name || 'Unknown' },
            { thread_id: newThread.id, user_id: targetUser.id, display_name: targetUser.full_name || targetUser.username },
          ]);
          directThreadId = newThread.id;
        }
      }

      if (!directThreadId) throw new Error('Could not find or create thread');

      // Send call invitation with current room ID
      await supabaseMessagingService.sendMessage(
        directThreadId,
        {
          content: `📞 Incoming ${callType === 'video' ? 'video' : 'audio'} call`,
          message_type: 'call_request',
          metadata: {
            callType,
            roomId: currentRoomId,
            callerId: currentUserId,
            callerName: user?.user_metadata?.full_name || 'Unknown',
            timestamp: new Date().toISOString(),
          },
        },
        { id: currentUserId, name: user?.user_metadata?.full_name || 'Unknown' }
      );

      // Close the panel after successful invite
      setShowAddPeople(false);
      setAddPeopleSearch('');
      setAddPeopleResults([]);
    } catch (error: any) {
      console.error('Failed to invite to call:', error);
    } finally {
      setInvitingUserId(null);
    }
  }, [currentUserId, roomId, roomIdHint, callType, user, invitingUserId]);

  // Debounced search for add people
  useEffect(() => {
    if (!showAddPeople) return;
    const timer = setTimeout(() => {
      searchUsersForInvite(addPeopleSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [addPeopleSearch, showAddPeople, searchUsersForInvite]);

  // Update local video element when localStream changes
  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (videoElement && localStream) {
      try {
        if (videoElement.srcObject !== localStream) {
          videoElement.srcObject = localStream;
        }
        // Ensure video plays
        if (videoElement.paused) {
          videoElement.play().catch(() => {});
        }
      } catch (error) {
      }
    } else if (videoElement && !localStream) {
      // Clear video element if stream is removed
      videoElement.srcObject = null;
    }
  }, [localStream]);

  useEffect(() => {
    const audioElement = remoteAudioRef.current;
    if (audioElement && remoteStreams.length > 0) {
      try {
        // Create a combined stream from all audio tracks in remote streams
        const combinedStream = new MediaStream();
        const addedTrackIds = new Set<string>();

        remoteStreams.forEach((stream, index) => {
          const audioTracks = stream.getAudioTracks();
          const videoTracks = stream.getVideoTracks();

          audioTracks.forEach(track => {
            // Only add each track once
            if (!addedTrackIds.has(track.id)) {
              combinedStream.addTrack(track);
              addedTrackIds.add(track.id);

              // Ensure audio track is enabled
              if (!track.enabled) {
                track.enabled = true;
              }
            }
          });
        });

        // Attach combined stream to audio element
        const audioTrackCount = combinedStream.getAudioTracks().length;

        if (audioTrackCount > 0) {
          if (audioElement.srcObject !== combinedStream) {
            audioElement.srcObject = combinedStream;
          }

          const vol = SPEAKER_VOLUMES[speakerLevelRef.current];
          audioElement.muted = false;
          audioElement.volume = vol;

          if (audioElement.paused) {
            const playPromise = audioElement.play();
            if (playPromise) {
              playPromise
                .then(() => {
                  // Re-apply volume after stream is playing (loud speaker fix)
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.volume = SPEAKER_VOLUMES[speakerLevelRef.current];
                    remoteAudioRef.current.muted = false;
                  }
                })
                .catch(() => {});
            }
          }
        } else {
          audioElement.srcObject = null;
        }
      } catch (error) {
      }
    } else if (audioElement) {
      audioElement.srcObject = null;
    }

    const videoElement = remoteVideoRef.current;
    if (videoElement && callType === 'video' && remoteStreams.length > 0) {
      try {
        const streamWithVideo = remoteStreams.find(stream => stream.getVideoTracks().length > 0);
        if (streamWithVideo) {
          if (videoElement.srcObject !== streamWithVideo) {
            videoElement.srcObject = streamWithVideo;
          }
          // Ensure video is playing
          if (videoElement.paused) {
            videoElement.play().catch(() => {});
          }
        } else {
          videoElement.srcObject = null;
        }
      } catch (error) {
      }
    } else if (videoElement) {
      videoElement.srcObject = null;
    }
  }, [remoteStreams, speakerLevel, callType]);


  // Simulate call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Listen for call accepted event (for outgoing calls)
  useEffect(() => {
    const handleCallAccepted = (event: any) => {
      if (event.detail?.threadId === threadId && !isIncoming) {
        if (ringtoneRef.current) {
          ringtoneRef.current.stop();
          ringtoneRef.current = null;
        }
        ringtoneService.stopRingtone();
        setCallStatus('connected');
      }
    };

    window.addEventListener('call-accepted', handleCallAccepted);
    return () => window.removeEventListener('call-accepted', handleCallAccepted);
  }, [threadId, isIncoming]);

  // Auto-connect for incoming calls (simulate)
  useEffect(() => {

    // Only transition to ringing once for incoming calls
    if (isIncoming && isOpen && callStatus === 'connecting') {
      const timer = setTimeout(() => {
        setCallStatus('ringing');
        ringtoneService.playRingtone().then(ringtone => {
          ringtoneRef.current = ringtone;
        });

        // Start 45-second timeout for incoming calls
        callTimeoutRef.current = setTimeout(() => {
          handleRejectCall(); // Auto-reject if not answered
        }, 45000); // 45 seconds
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isIncoming, isOpen, callStatus]);

  // Auto-disconnect timeout for outgoing calls
  useEffect(() => {
    if (!isIncoming && callStatus === 'ringing') {
      callTimeoutRef.current = setTimeout(() => {
        handleEndCall(); // Auto-end if not answered
      }, 45000); // 45 seconds
    }

    // Clear timeout if call is answered or ended
    if (callStatus === 'connected' || callStatus === 'ended') {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }

    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };
  }, [callStatus, isIncoming]);

  // Separate effect for ringtone cleanup to avoid re-running
  useEffect(() => {
    // Stop ringtone if call status changes from ringing to connected
    if (callStatus === 'connected') {
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      ringtoneService.stopRingtone();
      // Reset accepting state when connected
      setIsAcceptingCall(false);
    }

    // Stop ringtone if call ends
    if (callStatus === 'ended') {
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      ringtoneService.stopRingtone();
      // Reset accepting state when call ends
      setIsAcceptingCall(false);
    }
  }, [callStatus]);

  // Auto-close modal when call ends
  useEffect(() => {
    if (callStatus === 'ended' && isOpen) {
      const closeTimer = setTimeout(() => {
        onClose();
      }, 2000); // Wait 2 seconds to show "Call Ended" message before closing

      return () => clearTimeout(closeTimer);
    }
  }, [callStatus, isOpen, onClose]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };



  // Don't render if not open, but also check if we're in the middle of a call
  if (!isOpen && callStatus === 'connecting') return null;
  if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[9999] bg-black animate-fadeIn">
      <div className="bg-black w-full h-full overflow-hidden">
       

        {/* Video/Audio Content - Fullscreen */}
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full h-screen overflow-hidden">
          {/* Remote Video - 1-on-1 call (single full-screen) */}
          {remoteStreams.length > 0 && callType === 'video' && participants.length <= 1 && (
            <div className="w-full h-full">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Remote Video Grid - Group call (2+ remote participants) */}
          {callType === 'video' && participants.length > 1 && (
            <div className={`w-full h-full grid gap-1 p-1 ${
              participants.length === 2 ? 'grid-cols-2' :
              participants.length <= 4 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}>
              {participants.map((p: any) => {
                const videoStream = participantVideoMap.get(p.id);
                return (
                  <div key={p.id} className="relative bg-gray-800 rounded-lg overflow-hidden min-h-0">
                    {videoStream ? (
                      <ParticipantVideo stream={videoStream} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                          <span className="text-xl sm:text-2xl font-bold text-white">
                            {(p.displayName || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 text-[10px] sm:text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
                      {p.displayName || 'Participant'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Local Video */}
          {localStream && callType === 'video' && localStream.getVideoTracks().length > 0 && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 w-16 h-20 sm:w-20 sm:h-28 md:w-28 md:h-36 bg-gray-800 rounded-lg md:rounded-xl overflow-hidden border border-white sm:border-2 shadow-xl sm:shadow-2xl ring-1 ring-white/20 sm:ring-2 hover:scale-105 transition-transform duration-200">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Audio Call Avatar */}
          {callType === 'audio' && (
            <div className="flex items-center justify-center h-full px-4">
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-2xl ring-2 sm:ring-4 ring-primary-200/50 animate-pulse-glow">
                {/* Name is shown at top of ringing section, not here during ringing */}
                {callStatus !== 'ringing' && (
                  <span className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white text-center px-2 break-words">
                    {isIncoming ? decodedCallerName : decodedRecipientName}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Participants Count */}
          {callStatus === 'connected' && (() => {
            // Get count from meeting object (most accurate)
            let displayCount = participants.length + 1; // Default: remote participants + local
            
            if (currentMeetingRef.current) {
              try {
                const meeting = currentMeetingRef.current;
                const localParticipantId = meeting.localParticipant?.id;
                const allParticipants = meeting.participants 
                  ? Object.values(meeting.participants) 
                  : [];
                
                // Count only remote participants, then add 1 for local
                const remoteParticipants = allParticipants.filter(
                  (p: any) => p.id !== localParticipantId
                );
                displayCount = remoteParticipants.length + 1;
              } catch (error) {
                // Fallback to participants.length + 1
                displayCount = participants.length + 1;
              }
            }
            
            return (
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 md:top-4 md:left-4 bg-black/60 backdrop-blur-md text-white px-2 py-1 sm:px-2.5 sm:py-1.5 md:px-4 md:py-2 rounded-full text-[10px] sm:text-xs md:text-sm font-medium shadow-lg border border-white/20">
                <span className="flex items-center gap-1 sm:gap-2">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="hidden sm:inline">{displayCount} participant{displayCount > 1 ? 's' : ''}</span>
                  <span className="sm:hidden">{displayCount}</span>
                </span>
              </div>
            );
          })()}

          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

          {/* Call Status Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
            <div className="text-center text-white">
              <div className="mb-4">
                {callStatus === 'connecting' && (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 border-3 sm:border-4 border-white border-t-transparent mb-2 sm:mb-3"></div>
                    <div className="text-sm sm:text-base font-medium">Connecting...</div>
                  </div>
                )}
                {callStatus === 'ringing' && (
                  <div className="animate-pulse">
                    {/* Caller/Recipient Name - At top of ringing section */}
                    <div className="mb-3 sm:mb-4">
                      <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold break-words px-2">
                        {isIncoming ? decodedCallerName : decodedRecipientName}
                      </div>
                    </div>
                    <div className="text-4xl sm:text-5xl mb-2 sm:mb-3 animate-bounce">📞</div>
                    <div className="text-base sm:text-lg md:text-xl font-semibold">Ringing...</div>
                    <div className="text-xs sm:text-sm opacity-75 mt-1">Waiting for answer</div>
                  </div>
                )}
                {callStatus === 'connected' && (
                  <div className="space-y-2 flex ">
                    <div className="absolute bottom-0 left-2 sm:left-4 text-xs sm:text-sm md:text-base font-bold tracking-wider text-gray-300 sm:text-gray-700">{formatDuration(callDuration)}</div>
                  </div>
                )}
                {callStatus === 'ended' && (
                  <div>
                    <div className="text-lg sm:text-xl font-semibold mb-1">Call Ended</div>
                    <div className="text-xs sm:text-sm opacity-75">Duration: {formatDuration(callDuration)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floating reaction animation */}
          {/* {callStatus === 'connected' && reactionAnimation && lastReactionEmoji && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 mb-20 ">
              <div
                className="text-3xl sm:text-4xl md:text-5xl animate-ping"
                style={{
                  animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) 1'
                }}
              >
                {lastReactionEmoji}
              </div>
            </div>
          )} */}

          {/* Accept/Reject Buttons Overlay - Inside video section for incoming calls */}
          {callStatus === 'ringing' && isIncoming && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-4 sm:pb-6 md:pb-8 mb-20 sm:mb-0 px-4 z-30 pointer-events-auto">
              <div className="flex justify-center gap-3 sm:gap-4 md:gap-6">
                <button
                  onClick={handleAcceptCall}
                  disabled={isAcceptingCall}
                  className={`rounded-full p-3 sm:p-4 md:p-5 shadow-lg transition-all duration-200 focus:outline-none ${
                    isAcceptingCall
                      ? 'bg-gray-400 cursor-not-allowed opacity-60 text-white'
                      : 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white hover:shadow-xl hover:scale-110 active:scale-95'
                  }`}
                  title={isAcceptingCall ? 'Connecting...' : 'Answer Call'}
                  aria-label={isAcceptingCall ? 'Connecting...' : 'Answer call'}
                >
                  <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rotate-180" />
                </button>
                <button
                  onClick={handleRejectCall}
                  className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-3 sm:p-4 md:p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
                  title="Decline Call"
                  aria-label="Decline call"
                >
                  <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                </button>
              </div>
            </div>
          )}

          {/* End Call Button Overlay - Inside video section for outgoing calls */}
          {callStatus === 'ringing' && !isIncoming && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-4 sm:pb-6 md:pb-8 mb-20 sm:mb-0 px-4 z-30 pointer-events-auto">
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-3 sm:p-4 md:p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
                  title="Drop Call"
                  aria-label="Drop call"
                >
                  <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                </button>
              </div>
            </div>
          )}

         

          {/* Controls Overlay - Positioned at bottom center of video */}
          {callStatus === 'connected' && (
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-2 sm:pb-3 md:pb-6 mb-20 sm:mb-0 px-2 sm:px-3 md:px-4 z-10">
              <div className="space-y-2 sm:space-y-3 md:space-y-4 w-full max-w-2xl">
                {/* Main controls - Mute, Video, Speaker, Message, End */}
                <div className="flex justify-center items-center gap-1.5 sm:gap-2 md:gap-3 flex-wrap">
                  <button
                    onClick={toggleMute}
                    className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
                      isMuted 
                        ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white' 
                        : 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                    aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
                  </button>

                  {callType === 'video' && (
                    <button
                      onClick={toggleVideo}
                      className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
                        isVideoEnabled 
                          ? 'bg-white/90 hover:bg-white text-gray-700 backdrop-blur-sm' 
                          : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white'
                      }`}
                      title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                      aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                    >
                      {isVideoEnabled ? <Video className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
                    </button>
                  )}

                  <button
                    onClick={toggleSpeaker}
                    className="rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none bg-white/90 hover:bg-white text-gray-700 backdrop-blur-sm"
                    title={speakerLevel === 'normal' ? 'Speaker: normal' : speakerLevel === 'loud' ? 'Speaker: loud' : 'Speaker: low'}
                    aria-label={`Speaker ${speakerLevel}`}
                  >
                    {speakerLevel === 'low' ? (
                      <Volume1 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                    ) : (
                      <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                    )}
                  </button>

                  {/* Send Message Button */}
                  <button
                    onClick={() => setShowMessageInput(!showMessageInput)}
                    className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
                      showMessageInput 
                        ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white' 
                        : 'bg-white/90 hover:bg-white text-gray-700 backdrop-blur-sm'
                    }`}
                    title="Send message"
                    aria-label="Send message"
                  >
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </button>

                  {/* Add People Button */}
                  <button
                    onClick={() => setShowAddPeople(!showAddPeople)}
                    className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
                      showAddPeople
                        ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white'
                        : 'bg-white/90 hover:bg-white text-gray-700 backdrop-blur-sm'
                    }`}
                    title="Add people to call"
                    aria-label="Add people to call"
                  >
                    <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </button>

                  {/* Raise Hand Button - Highlight when raised */}
                  {/* <button
                    onClick={handleRaiseHand}
                    className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
                      isHandRaised 
                        ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white' 
                        : 'bg-white/90 hover:bg-white text-gray-700 backdrop-blur-sm'
                    }`}
                    title={isHandRaised ? 'Lower hand' : 'Raise hand'}
                    aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
                  >
                    <Hand className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </button> */}

                  <button
                    onClick={handleEndCall}
                    className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-2.5 sm:p-3 md:p-4 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
                    title="End call"
                    aria-label="End call"
                  >
                    <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </button>
                </div>
                    

                
              </div>
            </div>
          )}

        </div>

        {/* Add People Panel */}
        {showAddPeople && callStatus === 'connected' && (
          <div className="absolute top-0 right-0 w-full sm:w-80 h-full bg-gray-900/95 backdrop-blur-md z-50 flex flex-col border-l border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Add People</h3>
              <button
                onClick={() => {
                  setShowAddPeople(false);
                  setAddPeopleSearch('');
                  setAddPeopleResults([]);
                }}
                className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={addPeopleSearch}
                  onChange={(e) => setAddPeopleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {addPeopleSearch.length < 2 ? (
                <p className="text-xs text-gray-500 text-center mt-4">Type at least 2 characters to search</p>
              ) : addPeopleResults.length === 0 ? (
                <p className="text-xs text-gray-500 text-center mt-4">No users found</p>
              ) : (
                addPeopleResults.map((person: any) => {
                  const isAlreadyInCall = participants.some((p: any) => p.displayName === person.full_name);
                  return (
                    <button
                      key={person.id}
                      onClick={() => !isAlreadyInCall && handleInviteToCall(person)}
                      disabled={isAlreadyInCall || invitingUserId === person.id}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                        isAlreadyInCall
                          ? 'opacity-50 cursor-not-allowed'
                          : invitingUserId === person.id
                          ? 'bg-primary-500/20'
                          : 'hover:bg-white/10'
                      }`}
                    >
                      {person.avatar_url ? (
                        <img src={person.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {(person.full_name || person.username || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{person.full_name || person.username}</p>
                        {person.username && <p className="text-xs text-gray-400 truncate">@{person.username}</p>}
                      </div>
                      {isAlreadyInCall ? (
                        <span className="text-[10px] text-green-400 font-medium">In call</span>
                      ) : invitingUserId === person.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-400 border-t-transparent" />
                      ) : (
                        <span className="text-xs text-primary-400 font-medium">Invite</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-2 sm:p-3 md:p-4 lg:p-6">
         

          {callStatus === 'connected' && (
            <div className="space-y-2 sm:space-y-3 md:space-y-4">

              {showMessageInput && (
                <div className="flex gap-1.5 sm:gap-2 animate-slideIn">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-gray-300 outline-1 border-gray-300 transition-all duration-200 text-xs sm:text-sm text-white bg-gray-800/50 backdrop-blur-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white px-3 py-2 sm:px-4 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-offset-2"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => {
                      setShowMessageInput(false);
                      setMessageText('');
                    }}
                    className="bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 px-3 py-2 sm:px-4 sm:px-5 sm:py-2.5 rounded-lg transition-all duration-200 text-xs sm:text-sm font-medium focus:outline-none"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export { VideoSDKCallModal };
export default VideoSDKCallModal;
