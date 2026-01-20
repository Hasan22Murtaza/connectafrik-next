import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, VolumeX, MoreVertical, Share2, Hand, MessageSquare, Smile } from 'lucide-react';
import { ringtoneService } from '@/features/video/services/ringtoneService';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';
import { videoSDKWebRTCManager } from '@/lib/videosdk-webrtc';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/shared/services/notificationService';

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
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [participants, setParticipants] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [lastReactionEmoji, setLastReactionEmoji] = useState<string | null>(null);
  const [reactionAnimation, setReactionAnimation] = useState(false);
  const [isAcceptingCall, setIsAcceptingCall] = useState(false);

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
    console.log('📞 VideoSDKCallModal cleanup - stopping all media and ringtones');

    // Clear timeout first
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Stop ringtone
    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.stop();
      } catch (error) {
        console.warn('⚠️ Error stopping ringtone:', error);
      }
      ringtoneRef.current = null;
    }
    ringtoneService.stopRingtone();

    // Leave the VideoSDK meeting BEFORE stopping streams
    if (currentMeetingRef.current) {
      try {
        console.log('📞 Leaving VideoSDK meeting...');
        currentMeetingRef.current.leave();
      } catch (error) {
        console.warn('⚠️ Error leaving meeting:', error);
      }
      currentMeetingRef.current = null;
    }

    // Stop local stream
    const currentLocalStream = localStreamRef.current;
    if (currentLocalStream) {
      try {
        currentLocalStream.getTracks().forEach((track) => {
          track.stop();
          console.log('🛑 Stopped local track:', track.kind);
        });
      } catch (error) {
        console.warn('⚠️ Error stopping local stream:', error);
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
            console.log('🛑 Stopped remote track:', track.kind);
          });
        } catch (error) {
          console.warn('⚠️ Error stopping remote stream:', error);
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
    } catch (error) {
      console.warn('⚠️ Error in backward compatibility cleanup:', error);
    }

    if (isMountedRef.current) {
      setParticipants([]);
      setCallStatus('ended');
      setRoomId('');
      setError('');
    }
    hasInitializedRef.current = false;
  }, [updateLocalStream, updateRemoteStreams]);

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
        console.log('📞 Incoming call for room:', roomIdHint);
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
        initializeCall().catch((error) => {
          console.error('❌ Failed to initialize call:', error);
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

    console.log('📞 Setting up call_accepted listener for caller (status:', callStatus, ')');

    let hasAccepted = false; // Guard to prevent multiple triggers

    const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
      if (!hasAccepted && message.message_type === 'call_accepted' && message.metadata?.acceptedBy) {
        console.log('📞 Call accepted by receiver - stopping ringtone and transitioning to connected');
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
      console.log('📞 Cleaning up call_accepted listener');
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
        console.warn('⚠️ Received message for different thread:', {
          messageThreadId: message.thread_id,
          currentThreadId: threadId
        });
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
        console.warn('⚠️ Received call_rejected message without metadata:', message);
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
      const existingIndex = prev.findIndex((existing) => existing.id === stream.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = stream;
        return next;
      }
      return [...prev, stream];
    });
  };

  const removeRemoteStream = (streamId: string) => {
    updateRemoteStreams((prev) => prev.filter((stream) => stream.id !== streamId));
  };

  // Helper function to get VideoSDK JWT token
  // Uses Next.js API route at /api/videosdk/token
  const getVideoSDKToken = async (meetingId?: string, userId?: string): Promise<string> => {
    console.log('📞 Requesting VideoSDK token from API route');

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
    } catch (error) {
      console.warn('⚠️ Could not get auth session:', error);
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
      console.error('❌ Failed to get VideoSDK token:', errorMessage);
      throw new Error(`Failed to get VideoSDK token: ${errorMessage}`);
    }

    const data = await response.json();
    console.log('🔑 VideoSDK token data:', data);

    if (!data?.token || typeof data.token !== 'string') {
      console.error('❌ API response missing token:', data);
      throw new Error('Failed to get VideoSDK token from API: no token in response');
    }

    console.log('✅ VideoSDK token received from API route');
    return data.token as string;
  };

  const initializeCall = async () => {
    try {
      setCallStatus('connecting');
      setError('');

      let meetingId = roomIdHint;
      
      // ✅ Create room if it doesn't exist
      if (!meetingId) {
        const roomResponse = await fetch('/api/videosdk/room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!roomResponse.ok) {
          const errorData = await roomResponse.json().catch(() => ({}));
          console.error('Failed to create VideoSDK room:', errorData);
          throw new Error(errorData.error || 'Failed to create call room. Please try again.');
        }

        const roomData = await roomResponse.json();
        meetingId = roomData.roomId;
        
        if (!meetingId) {
          throw new Error('Failed to create call room. Please try again.');
        }
      }
      // ✅ Get secure JWT token from Supabase edge function
      const token = await getVideoSDKToken(meetingId, user?.id);
      setRoomId(meetingId);
      // ✅ Dynamically import VideoSDK to avoid SSR issues
      const { VideoSDK } = await import('@videosdk.live/js-sdk');
      // ✅ Validate token format (should be a JWT with 3 parts)
      if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
        throw new Error('Invalid VideoSDK token format. Token must be a valid JWT.');
      }
      
      // ✅ Configure VideoSDK with token (must be called before initMeeting)
      try {
        VideoSDK.config(token);
      } catch (configError: any) {
        console.error('❌ VideoSDK config error:', configError);
        throw new Error(`Failed to configure VideoSDK: ${configError.message || 'Unknown error'}`);
      }

      // ✅ Initialize VideoSDK meeting
      let meeting;
      try {
        meeting = VideoSDK.initMeeting({
          meetingId,
          name: user?.user_metadata?.full_name || user?.email || 'User',
          micEnabled: true,
          webcamEnabled: callType === 'video' && isVideoEnabled,
        });
      } catch (initError: any) {
        console.error('❌ VideoSDK initMeeting error:', initError);
        throw new Error(`Failed to initialize meeting: ${initError.message || 'Unknown error'}`);
      }

      // Store meeting reference for cleanup
      currentMeetingRef.current = meeting;

      // ✅ Set WebRTC callbacks BEFORE joining (CRITICAL FIX)
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

          // ✅ Get local stream from VideoSDK meeting after joining
          try {
            const localParticipant = meeting.localParticipant;
            if (localParticipant) {
              // Listen for local stream enabled event
              if (localParticipant.on) {
                localParticipant.on("stream-enabled", (stream: any) => {
                  if (stream.kind === 'video' && callType === 'video' && stream.track) {
                    const localVideoStream = new MediaStream([stream.track]);
                    updateLocalStream(localVideoStream);
                    console.log('📹 Local video stream enabled from VideoSDK');
                  }
                });

                localParticipant.on("stream-disabled", (stream: any) => {
                  if (stream.kind === 'video') {
                    console.log('📹 Local video stream disabled');
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
                      console.log('📹 Local video stream obtained from VideoSDK mediaStream');
                    }
                  }
                } catch (err) {
                  console.log('📹 Could not get local stream directly, will wait for stream-enabled event');
                }
              }, 500);
            }
          } catch (error) {
            console.warn('⚠️ Error setting up local stream listener from VideoSDK:', error);
          }
        }
      });

      meeting.on("participant-joined", (participant: any) => {
        if (isMountedRef.current) {
          // ✅ FIXED: Update status to 'connected' when participant joins (for outgoing calls)
          if (!isIncoming && (callStatusRef.current === 'ringing' || callStatusRef.current === 'connecting')) {
            console.log('📞 Participant joined - updating status to connected (current status:', callStatusRef.current, ')');
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
            
            // ✅ FIXED: Subscribe to participant's streams using VideoSDK API
            try {
              // Subscribe to participant stream events
              if (participant.on) {
                participant.on("stream-enabled", (stream: any) => {
                  console.log("📹 Stream enabled for participant:", participant.id, stream.kind);
                  
                  if (stream.kind === 'video') {
                    const videoStream = new MediaStream([stream.track]);
                    addRemoteStream(videoStream);
                    if (remoteVideoRef.current && callType === 'video') {
                      remoteVideoRef.current.srcObject = videoStream;
                      remoteVideoRef.current.play().catch(err => 
                        console.warn('⚠️ Video playback error:', err)
                      );
                    }
                  } else if (stream.kind === 'audio') {
                    const audioStream = new MediaStream([stream.track]);
                    addRemoteStream(audioStream);
                  }
                });

                participant.on("stream-disabled", (stream: any) => {
                  console.log("📹 Stream disabled for participant:", participant.id, stream.kind);
                  if (stream.track) {
                    removeRemoteStream(stream.track.id);
                  }
                });
              }

              // Check if participant already has active streams
              const videoStreams = participant.getVideoStreams?.() || [];
              const audioStreams = participant.getAudioStreams?.() || [];
              
              videoStreams.forEach((vs: any) => {
                if (vs.track) {
                  const stream = new MediaStream([vs.track]);
                  addRemoteStream(stream);
                  if (remoteVideoRef.current && callType === 'video') {
                    remoteVideoRef.current.srcObject = stream;
                  }
                }
              });
              
              audioStreams.forEach((as: any) => {
                if (as.track) {
                  const stream = new MediaStream([as.track]);
                  addRemoteStream(stream);
                }
              });
            } catch (error) {
              console.warn('⚠️ Error handling participant streams:', error);
            }
            
            return updated;
          });
        }
      });

      meeting.on("participant-left", (p: any) => {
        if (isMountedRef.current) {
          setParticipants(prev => prev.filter((x: any) => x.id !== p.id));
        }
      });

      // ✅ Add handler for when meeting ends unexpectedly
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
            console.warn('⚠️ Failed to send call_ended message on meeting-left:', msgError);
          }
        }
        
        if (isMountedRef.current) {
          setCallStatus('ended');
        }
        cleanupResources();
      });
      
      // Add connection timeout (30 seconds)
      const joinTimeout = setTimeout(() => {
        if (isMountedRef.current && currentMeetingRef.current) {
          console.error('❌ Meeting join timeout');
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

      // ✅ Local media setup - VideoSDK handles media internally
      // We still get local stream for preview and local controls
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video' && isVideoEnabled,
          audio: true
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
        console.warn('⚠️ Local media access failed, VideoSDK will handle it:', mediaError);
        // VideoSDK will request permissions itself, so this is not critical
      }

      // ✅ Ensure meeting is still valid before proceeding
      if (!currentMeetingRef.current) {
        throw new Error('Meeting initialization failed');
      }

    } catch (error: any) {
      console.error("❌ Error initializing call:", error);
      setError(`Failed to start call: ${error.message || 'Please check permissions and try again.'}`);
      setCallStatus('ended');
      cleanupResources();
    }
  };

  const handleAcceptCall = async () => {
    // Prevent multiple clicks - disable button if already accepting
    if (isAcceptingCall) {
      console.log('📞 Call already being accepted, ignoring duplicate click');
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
        console.error('❌ Cannot accept call - no roomIdHint provided');
        setError('Cannot accept call - missing room information.');
        setIsAcceptingCall(false); // Reset on error
        return;
      }

      setCallStatus('connecting');

      // ✅ CRITICAL: Always generate a NEW token for the receiver with their own userId
      // NEVER use tokenHint - tokens contain participantId in JWT payload
      // Using caller's token causes 401 Unauthorized because participantId won't match
      if (tokenHint) {
        console.warn('⚠️ tokenHint provided but IGNORED - generating new token for receiver');
        console.warn('⚠️ Reason: Tokens are user-specific (participantId in JWT), must match current user');
      }

      const token = await getVideoSDKToken(roomIdHint, user?.id);
      setRoomId(roomIdHint);

      // ✅ Dynamically import VideoSDK to avoid SSR issues
      const { VideoSDK } = await import('@videosdk.live/js-sdk');
      
      // ✅ Validate token format (should be a JWT with 3 parts)
      if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
        throw new Error('Invalid VideoSDK token format. Token must be a valid JWT.');
      }
      
      // ✅ Configure VideoSDK with token (must be called before initMeeting)
      try {
        VideoSDK.config(token);
      } catch (configError: any) {
        console.error('❌ VideoSDK config error:', configError);
        throw new Error(`Failed to configure VideoSDK: ${configError.message || 'Unknown error'}`);
      }

      // ✅ Initialize VideoSDK meeting for accepted call
      let meeting;
      try {
        meeting = VideoSDK.initMeeting({
          meetingId: roomIdHint,
          name: user?.user_metadata?.full_name || user?.email || 'User',
          micEnabled: true,
          webcamEnabled: callType === 'video' && isVideoEnabled,
        });
      } catch (initError: any) {
        console.error('❌ VideoSDK initMeeting error:', initError);
        throw new Error(`Failed to initialize meeting: ${initError.message || 'Unknown error'}`);
      }

      // Store meeting reference for cleanup
      currentMeetingRef.current = meeting;

      // ✅ Set WebRTC callbacks BEFORE joining (CRITICAL FIX)
      meeting.on("meeting-joined", () => {
        if (isMountedRef.current) {
          setCallStatus('connected');

          // ✅ Get existing participants when joining (for accepted calls)
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
              
              console.log('📞 Checking for existing participants when joining:', {
                allParticipantsCount: allParticipants.length,
                localParticipantId: localParticipantId,
                remoteParticipantsCount: existingParticipants.length,
                participants: existingParticipants.map((p: any) => ({ id: p.id, displayName: p.displayName }))
              });

              if (existingParticipants.length > 0) {
                console.log('📞 Found existing participants when joining:', existingParticipants.length);
                setParticipants(prev => {
                  const updated = [...prev];
                  existingParticipants.forEach((participant: any) => {
                    const exists = updated.find(x => x.id === participant.id);
                    if (!exists) {
                      console.log('📞 Adding existing participant:', participant.id);
                      updated.push(participant);
                      // Set up stream listeners for existing participants
                      if (participant.on) {
                        participant.on("stream-enabled", (stream: any) => {
                          console.log("📹 Stream enabled for existing participant:", participant.id, stream.kind);
                          if (stream.kind === 'video') {
                            const videoStream = new MediaStream([stream.track]);
                            addRemoteStream(videoStream);
                            if (remoteVideoRef.current && callType === 'video') {
                              remoteVideoRef.current.srcObject = videoStream;
                              remoteVideoRef.current.play().catch(err => 
                                console.warn('⚠️ Video playback error:', err)
                              );
                            }
                          } else if (stream.kind === 'audio') {
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
                      const audioStreams = participant.getAudioStreams?.() || [];
                      
                      videoStreams.forEach((vs: any) => {
                        if (vs.track) {
                          const stream = new MediaStream([vs.track]);
                          addRemoteStream(stream);
                          if (remoteVideoRef.current && callType === 'video') {
                            remoteVideoRef.current.srcObject = stream;
                          }
                        }
                      });
                      
                      audioStreams.forEach((as: any) => {
                        if (as.track) {
                          const stream = new MediaStream([as.track]);
                          addRemoteStream(stream);
                        }
                      });
                    }
                  });
                  console.log('📞 Updated participants array:', updated.length);
                  return updated;
                });
              } else {
                console.log('📞 No existing participants found when joining');
              }
            } catch (error) {
              console.warn('⚠️ Error getting existing participants:', error);
            }
          }, 500);

          // ✅ Get local stream from VideoSDK meeting after joining
          try {
            const localParticipant = meeting.localParticipant;
            if (localParticipant) {
              // Listen for local stream enabled event
              if (localParticipant.on) {
                localParticipant.on("stream-enabled", (stream: any) => {
                  if (stream.kind === 'video' && callType === 'video' && stream.track) {
                    const localVideoStream = new MediaStream([stream.track]);
                    updateLocalStream(localVideoStream);
                    console.log('📹 Local video stream enabled from VideoSDK (accepted call)');
                  }
                });

                localParticipant.on("stream-disabled", (stream: any) => {
                  if (stream.kind === 'video') {
                    console.log('📹 Local video stream disabled (accepted call)');
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
                      console.log('📹 Local video stream obtained from VideoSDK mediaStream (accepted call)');
                    }
                  }
                } catch (err) {
                  console.log('📹 Could not get local stream directly (accepted call), will wait for stream-enabled event');
                }
              }, 500);
            }
          } catch (error) {
            console.warn('⚠️ Error setting up local stream listener from VideoSDK (accepted call):', error);
          }
        }
      });

      meeting.on("participant-joined", (participant: any) => {
        console.log("👤 Participant joined:", participant.id);
        if (isMountedRef.current) {
          setParticipants(prev => {
            const exists = prev.find(x => x.id === participant.id);
            if (exists) return prev;
            const updated = [...prev, participant];
            
            // ✅ FIXED: Subscribe to participant's streams using VideoSDK API
            try {
              // Subscribe to participant stream events
              if (participant.on) {
                participant.on("stream-enabled", (stream: any) => {
                  console.log("📹 Stream enabled for participant:", participant.id, stream.kind);
                  
                  if (stream.kind === 'video') {
                    const videoStream = new MediaStream([stream.track]);
                    addRemoteStream(videoStream);
                    if (remoteVideoRef.current && callType === 'video') {
                      remoteVideoRef.current.srcObject = videoStream;
                      remoteVideoRef.current.play().catch(err => 
                        console.warn('⚠️ Video playback error:', err)
                      );
                    }
                  } else if (stream.kind === 'audio') {
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

              // Check if participant already has active streams
              const videoStreams = participant.getVideoStreams?.() || [];
              const audioStreams = participant.getAudioStreams?.() || [];
              
              videoStreams.forEach((vs: any) => {
                if (vs.track) {
                  const stream = new MediaStream([vs.track]);
                  addRemoteStream(stream);
                  if (remoteVideoRef.current && callType === 'video') {
                    remoteVideoRef.current.srcObject = stream;
                  }
                }
              });
              
              audioStreams.forEach((as: any) => {
                if (as.track) {
                  const stream = new MediaStream([as.track]);
                  addRemoteStream(stream);
                }
              });
            } catch (error) {
              console.warn('⚠️ Error handling participant streams:', error);
            }
            
            return updated;
          });
        }
      });

      meeting.on("participant-left", (p: any) => {
        console.log("👤 Participant left:", p.id);
        if (isMountedRef.current) {
          setParticipants(prev => prev.filter((x: any) => x.id !== p.id));
        }
      });

      // ✅ Add handler for when meeting ends unexpectedly (for accepted calls)
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
            // Failed to send call_ended message
          }
        }
        
        if (isMountedRef.current) {
          setCallStatus('ended');
        }
        cleanupResources();
      });

      // Get local stream for accepted call BEFORE joining
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video' && isVideoEnabled,
          audio: true
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
        console.warn('⚠️ Local media access failed, VideoSDK will handle it:', mediaError);
        // VideoSDK will request permissions itself, so this is not critical
      }

      // ✅ Ensure meeting is still valid before proceeding
      if (!currentMeetingRef.current) {
        throw new Error('Meeting initialization failed');
      }
      await meeting.join();
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
            { id: currentUserId, name: recipientName }
          );
        } catch (msgError) {
          console.warn('⚠️ Failed to send call_accepted message:', msgError);
          // Don't fail the call if message sending fails
        }
      }

      onAccept?.();
    } catch (error: any) {
      console.error('❌ Error accepting call:', error);
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
          { id: currentUserId, name: isIncoming ? recipientName : callerName }
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
        const recipientWhoRejected = recipientName; // The recipient who rejected

        await notificationService.sendMissedCallNotification(
          callerId,
          recipientWhoRejected,
          callType
        );
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
        console.warn('⚠️ Failed to send call_ended message:', msgError);
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

    // ✅ FIXED: Use VideoSDK meeting methods for mute/unmute
    if (currentMeetingRef.current) {
      try {
        if (newMutedState) {
          currentMeetingRef.current.muteMic();
        } else {
          currentMeetingRef.current.unmuteMic();
        }
      } catch (error) {
        console.warn('⚠️ VideoSDK mute/unmute failed:', error);
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

  const toggleVideo = () => {
    if (callType === 'video') {
      const newVideoState = !isVideoEnabled;
      setIsVideoEnabled(newVideoState);

      // ✅ FIXED: Use VideoSDK meeting methods for video enable/disable
      if (currentMeetingRef.current) {
        try {
          if (newVideoState) {
            currentMeetingRef.current.enableWebcam();
          } else {
            currentMeetingRef.current.disableWebcam();
          }
        } catch (error) {
          console.warn('⚠️ VideoSDK webcam enable/disable failed:', error);
        }
      }

      // Also update local track for immediate UI feedback
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = newVideoState;
        }
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerEnabled(prev => {
      const next = !prev;
      const audioElement = remoteAudioRef.current;
      if (audioElement) {
        audioElement.muted = !next;
        if (next) {
          const playPromise = audioElement.play();
          if (playPromise) {
            playPromise.catch(() => undefined);
          }
        }
      }
      return next;
    });
  };

  const handleRaiseHand = () => {
    const newHandRaised = !isHandRaised;
    setIsHandRaised(newHandRaised);

    // Send notification to other participant
    if (threadId && currentUserId) {
      supabaseMessagingService.sendMessage(
        threadId,
        {
          content: newHandRaised ? '✋ Hand raised' : '✋ Hand lowered',
          message_type: 'hand_raised',
          metadata: {
            handRaised: newHandRaised,
            raisedBy: currentUserId,
            timestamp: new Date().toISOString()
          }
        },
        { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
      ).catch(err => console.error('Failed to send hand raised notification:', err));
    }
  };

  const handleShareScreen = async () => {
    try {
      setIsScreenSharing(true);
      setShowMenu(false);

      // Get screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false
      });
      // In a full implementation, you would switch the video track in VideoSDK
      // For now, we'll show a notification
      if (threadId && currentUserId) {
        await supabaseMessagingService.sendMessage(
          threadId,
          {
            content: '📺 Screen sharing started',
            message_type: 'screen_share_started',
            metadata: {
              sharedBy: currentUserId,
              timestamp: new Date().toISOString()
            }
          },
          { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
        );
      }

      // Handle screen share stop
      screenStream.getTracks().forEach(track => {
        track.onended = () => {
          setIsScreenSharing(false);
          if (threadId && currentUserId) {
            supabaseMessagingService.sendMessage(
              threadId,
              {
                content: '📺 Screen sharing stopped',
                message_type: 'screen_share_stopped',
                metadata: {
                  stoppedBy: currentUserId,
                  timestamp: new Date().toISOString()
                }
              },
              { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
            ).catch(err => console.error('Failed to notify screen share stop:', err));
          }
        };
      });
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        console.error('❌ Screen share failed:', error);
      }
      setIsScreenSharing(false);
    }
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
      console.error('❌ Failed to send message:', error);
    }
  };

  // Update local video element when localStream changes
  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (videoElement && localStream) {
      try {
        if (videoElement.srcObject !== localStream) {
          videoElement.srcObject = localStream;
          console.log('📹 Local video stream attached to video element');
        }
        // Ensure video plays
        if (videoElement.paused) {
          videoElement.play().catch(err => 
            console.warn('⚠️ Local video playback error:', err)
          );
        }
      } catch (error) {
        console.error('❌ Error setting local video stream:', error);
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

          // Control mute state
          audioElement.muted = !isSpeakerEnabled;

          // Ensure audio is playing
          if (isSpeakerEnabled && audioElement.paused) {
            const playPromise = audioElement.play();
            if (playPromise) {
              playPromise
                .then(() => console.log('🎵 Audio playback started successfully'))
                .catch(err => console.warn('⚠️ Audio playback error:', err));
            }
          }
        } else {
          console.warn('⚠️ No audio tracks available in remote streams');
          audioElement.srcObject = null;
        }
      } catch (error) {
        console.error('❌ Error managing audio element:', error);
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
            console.log('📹 Video stream attached');
          }
          // Ensure video is playing
          if (videoElement.paused) {
            videoElement.play().catch(err => console.warn('⚠️ Video playback error:', err));
          }
        } else {
          videoElement.srcObject = null;
        }
      } catch (error) {
        console.error('❌ Error managing video element:', error);
      }
    } else if (videoElement) {
      videoElement.srcObject = null;
    }
  }, [remoteStreams, isSpeakerEnabled, callType]);


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

  // Close emoji dropdown when clicking outside
  useEffect(() => {
    if (!showEmojiDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.emoji-dropdown-container')) {
        setShowEmojiDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiDropdown]);

  // Monitor connection quality during call
  useEffect(() => {
    if (callStatus !== 'connected') return;

    const checkConnectionQuality = () => {
      // Simple heuristic-based connection quality detection
      // In a real implementation, you would use VideoSDK stats API

      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';

      // Check if streams are connected
      if (remoteStreams.length === 0) {
        quality = 'poor';
      } else if (participants.length > 1) {
        // Multiple participants = harder connection = fair
        quality = 'fair';
      } else {
        // Simulate varying quality based on random factor
        // In production, use actual network stats from VideoSDK
        const random = Math.random();
        if (random > 0.7) {
          quality = 'excellent';
        } else if (random > 0.4) {
          quality = 'good';
        } else if (random > 0.2) {
          quality = 'fair';
        } else {
          quality = 'poor';
        }
      }

      setConnectionQuality(quality);
    };

    // Check connection quality every 3 seconds
    const interval = setInterval(checkConnectionQuality, 3000);

    // Initial check
    checkConnectionQuality();

    return () => clearInterval(interval);
  }, [callStatus, remoteStreams.length, participants.length]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  const handleEmojiReaction = (emoji: string) => {
    // Send emoji reaction
    if (threadId && currentUserId) {
      supabaseMessagingService.sendMessage(
        threadId,
        {
          content: emoji,
          message_type: 'reaction',
          metadata: { emoji: emoji, sentBy: currentUserId }
        },
        { id: currentUserId, name: user?.user_metadata?.full_name || 'User' }
      );
    }

    // Trigger animation
    setLastReactionEmoji(emoji);
    setReactionAnimation(true);
    setTimeout(() => {
      setReactionAnimation(false);
    }, 1000);
  };

  // Don't render if not open, but also check if we're in the middle of a call
  if (!isOpen && callStatus === 'connecting') return null;
  if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[9999] bg-black animate-fadeIn">
      <div className="bg-black w-full h-full overflow-hidden">
       

        {/* Video/Audio Content - Fullscreen */}
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full h-screen overflow-hidden">
          {/* Remote Videos - Show all participants */}
          {remoteStreams.length > 0 && callType === 'video' && (
            <div className="w-full h-full">
              {remoteStreams.map((stream, index) => (
                <video
                  key={stream.id}
                  ref={index === 0 ? remoteVideoRef : undefined}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ display: isVideoEnabled ? 'block' : 'none' }}
                />
              ))}
            </div>
          )}

          {/* Local Video */}
          {localStream && callType === 'video' && localStream.getVideoTracks().length > 0 && (
            <div className="absolute top-2 right-2 md:top-4 md:right-4 w-20 h-28 md:w-28 md:h-36 bg-gray-800 rounded-lg md:rounded-xl overflow-hidden border-2 border-white shadow-2xl ring-2 ring-white/20 hover:scale-105 transition-transform duration-200">
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
            <div className="flex items-center justify-center h-full">
              <div className="w-36 h-36 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-primary-200/50 animate-pulse-glow">
                <span className="text-5xl font-bold text-white">
                  {isIncoming ? callerName.charAt(0).toUpperCase() : recipientName.charAt(0).toUpperCase()}
                </span>
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
                console.warn('⚠️ Error calculating participant count:', error);
                // Fallback to participants.length + 1
                displayCount = participants.length + 1;
              }
            }
            
            return (
              <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium shadow-lg border border-white/20">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  {displayCount} participant{displayCount > 1 ? 's' : ''}
                </span>
              </div>
            );
          })()}

          <audio ref={remoteAudioRef} autoPlay playsInline muted={!isSpeakerEnabled} className="hidden" />

          {/* Call Status Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white">
              <div className="mb-4">
                {callStatus === 'connecting' && (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-14 w-14 border-4 border-white border-t-transparent mb-3"></div>
                    <div className="text-base font-medium">Connecting...</div>
                  </div>
                )}
                {callStatus === 'ringing' && (
                  <div className="animate-pulse">
                    <div className="text-5xl mb-3 animate-bounce">📞</div>
                    <div className="text-xl font-semibold">Ringing...</div>
                    <div className="text-sm opacity-75 mt-1">Waiting for answer</div>
                  </div>
                )}
                {callStatus === 'connected' && (
                  <div className="space-y-2 flex ">
                    <div className="absolute bottom-0 left-2 text-1xl font-bold tracking-wider text-gray-700">{formatDuration(callDuration)}</div>
                  </div>
                )}
                {callStatus === 'ended' && (
                  <div>
                    <div className="text-xl font-semibold mb-1">Call Ended</div>
                    <div className="text-sm opacity-75">Duration: {formatDuration(callDuration)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floating reaction animation */}
          {callStatus === 'connected' && reactionAnimation && lastReactionEmoji && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div
                className="text-5xl animate-ping"
                style={{
                  animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) 1'
                }}
              >
                {lastReactionEmoji}
              </div>
            </div>
          )}

          {/* Accept/Reject Buttons Overlay - Inside video section for incoming calls */}
          {callStatus === 'ringing' && isIncoming && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-6 md:pb-8 px-4 z-30 pointer-events-auto">
              <div className="flex justify-center gap-4 md:gap-6">
                <button
                  onClick={handleAcceptCall}
                  disabled={isAcceptingCall}
                  className={`rounded-full p-4 md:p-5 shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 ${
                    isAcceptingCall
                      ? 'bg-gray-400 cursor-not-allowed opacity-60 text-white'
                      : 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white hover:shadow-xl hover:scale-110 active:scale-95 focus:ring-green-300'
                  }`}
                  title={isAcceptingCall ? 'Connecting...' : 'Answer Call'}
                  aria-label={isAcceptingCall ? 'Connecting...' : 'Answer call'}
                >
                  <PhoneOff className="w-6 h-6 md:w-7 md:h-7 rotate-180" />
                </button>
                <button
                  onClick={handleRejectCall}
                  className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-4 md:p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300"
                  title="Decline Call"
                  aria-label="Decline call"
                >
                  <PhoneOff className="w-6 h-6 md:w-7 md:h-7" />
                </button>
              </div>
            </div>
          )}

          {/* End Call Button Overlay - Inside video section for outgoing calls */}
          {callStatus === 'ringing' && !isIncoming && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-6 md:pb-8 px-4 z-30 pointer-events-auto">
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-4 md:p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300"
                  title="Drop Call"
                  aria-label="Drop call"
                >
                  <PhoneOff className="w-6 h-6 md:w-7 md:h-7" />
                </button>
              </div>
            </div>
          )}

          {/* Emoji Icon Button - Right side bottom */}
          {callStatus === 'connected' && (
            <div className="absolute bottom-20 md:bottom-6 right-2 md:right-6 z-30 emoji-dropdown-container pointer-events-auto">
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiDropdown(!showEmojiDropdown);
                  }}
                  className="rounded-full p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm cursor-pointer"
                  title="Reactions"
                  aria-label="Show reactions"
                  type="button"
                  style={{ pointerEvents: 'auto' }}
                >
                  <Smile className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                
                {/* Emoji Dropdown - Shows above the button */}
                {showEmojiDropdown && (
                  <div className="absolute bottom-full right-0 mb-1 bg-transparent rounded-lg p-2 flex flex-col gap-1 animate-slideIn z-40 pointer-events-auto">
                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEmojiReaction(emoji);
                          setShowEmojiDropdown(false);
                        }}
                        className="text-2xl hover:scale-125 active:scale-150 transition-transform duration-200 hover:drop-shadow-lg rounded-full p-2 hover:bg-white/20 bg-white/10 backdrop-blur-sm cursor-pointer"
                        title={
                          {
                            '👍': 'Thumbs up',
                            '❤️': 'Love',
                            '😂': 'Laughing',
                            '😮': 'Surprised',
                            '😢': 'Sad',
                            '🙏': 'Praying'
                          }[emoji]
                        }
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Controls Overlay - Positioned at bottom center of video */}
          {callStatus === 'connected' && (
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-3 md:pb-6 px-2 md:px-4 z-10">
              <div className="space-y-2 md:space-y-4 w-full max-w-2xl">
                {/* Main controls - Mute, Video, Speaker, End */}
                <div className="flex justify-center items-center gap-2 md:gap-3 flex-wrap">
                  {/* Three-dot menu for connected call */}
                <div className="relative flex justify-center">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="rounded-full p-2.5 md:p-3.5 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm"
                    title="More options"
                  >
                    <MoreVertical className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                  {showMenu && (
                    <div className="absolute bottom-12 bg-white border border-gray-200 rounded-lg shadow-xl z-10 min-w-max overflow-hidden animate-slideIn">
                      <button
                        onClick={handleShareScreen}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 flex items-center space-x-3 transition-colors duration-150 font-medium ${
                          isScreenSharing 
                            ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' 
                            : 'text-gray-700'
                        }`}
                      >
                        <Share2 className="w-4 h-4" />
                        <span>{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMessageInput(true);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 flex items-center space-x-3 transition-colors duration-150 text-gray-700 font-medium border-t border-gray-200"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Send Message</span>
                      </button>
                    </div>
                  )}
                </div>
                  <button
                    onClick={toggleMute}
                    className={`rounded-full p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isMuted 
                        ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus:ring-red-300' 
                        : 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                    aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
                  </button>

                  {callType === 'video' && (
                    <button
                      onClick={toggleVideo}
                      className={`rounded-full p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        isVideoEnabled 
                          ? 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm' 
                          : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus:ring-red-300'
                      }`}
                      title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                      aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                    >
                      {isVideoEnabled ? <Video className="w-5 h-5 md:w-6 md:h-6" /> : <VideoOff className="w-5 h-5 md:w-6 md:h-6" />}
                    </button>
                  )}

                  <button
                    onClick={toggleSpeaker}
                    className={`rounded-full p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isSpeakerEnabled 
                        ? 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm' 
                        : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus:ring-red-300'
                    }`}
                    title={isSpeakerEnabled ? 'Turn off speaker' : 'Turn on speaker'}
                    aria-label={isSpeakerEnabled ? 'Turn off speaker' : 'Turn on speaker'}
                  >
                    {isSpeakerEnabled ? <Volume2 className="w-5 h-5 md:w-6 md:h-6" /> : <VolumeX className="w-5 h-5 md:w-6 md:h-6" />}
                  </button>

                  {/* Raise Hand Button - Highlight when raised */}
                  <button
                    onClick={handleRaiseHand}
                    className={`rounded-full p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isHandRaised 
                        ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white focus:ring-orange-300' 
                        : 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm'
                    }`}
                    title={isHandRaised ? 'Lower hand' : 'Raise hand'}
                    aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
                  >
                    <Hand className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <button
                    onClick={handleEndCall}
                    className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-3 md:p-4 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300"
                    title="End call"
                    aria-label="End call"
                  >
                    <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
                    

                
              </div>
            </div>
          )}

        </div>

        {/* Controls */}
        <div className="p-4 md:p-6">
         

          {callStatus === 'connected' && (
            <div className="space-y-4">

              {showMessageInput && (
                <div className="flex gap-2 animate-slideIn">
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
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white px-5 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => {
                      setShowMessageInput(false);
                      setMessageText('');
                    }}
                    className="bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 px-5 py-2.5 rounded-lg transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
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
