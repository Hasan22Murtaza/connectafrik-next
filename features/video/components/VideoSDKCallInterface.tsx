"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, VolumeX, MoreVertical, Share2, Hand, MessageSquare, Smile } from 'lucide-react';
import { ringtoneService } from '@/features/video/services/ringtoneService';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';
import { videoSDKWebRTCManager } from '@/lib/videosdk-webrtc';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/shared/services/notificationService';

export interface VideoSDKCallInterfaceProps {
  callType: 'audio' | 'video';
  callerName: string;
  recipientName: string;
  isIncoming?: boolean;
  onCallEnd?: () => void;
  threadId?: string;
  currentUserId?: string;
  roomIdHint?: string;
  tokenHint?: string;
}

const VideoSDKCallInterface: React.FC<VideoSDKCallInterfaceProps> = ({
  callType,
  callerName,
  recipientName,
  isIncoming = false,
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
    console.log('📞 VideoSDKCallInterface cleanup - stopping all media and ringtones');

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.stop();
      } catch (error) {
        console.warn('⚠️ Error stopping ringtone:', error);
      }
      ringtoneRef.current = null;
    }
    ringtoneService.stopRingtone();

    if (currentMeetingRef.current) {
      try {
        console.log('📞 Leaving VideoSDK meeting...');
        currentMeetingRef.current.leave();
      } catch (error) {
        console.warn('⚠️ Error leaving meeting:', error);
      }
      currentMeetingRef.current = null;
    }

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

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    try {
      videoSDKWebRTCManager.leaveMeeting();
      videoSDKWebRTCManager.setLocalStream(null);
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
    // For incoming calls, DON'T initialize - wait for user to accept
    if (isIncoming) {
      if (roomIdHint) {
        console.log('📞 Incoming call for room:', roomIdHint);
        setRoomId(roomIdHint);
        if (callStatus === 'connecting') {
          setCallStatus('ringing');
        }
      }
      return;
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
      if (!isMountedRef.current) {
        cleanupResources();
      }
    };
  }, [isIncoming, roomIdHint, callStatus, cleanupResources]);

  // Listen for call_accepted messages (for caller's side)
  // Keep this listener active throughout the call lifecycle for outgoing calls
  useEffect(() => {
    if (isIncoming || !threadId || !currentUserId) {
      return;
    }

    console.log('📞 Setting up call_accepted listener for caller (status:', callStatusRef.current, ')');

    let hasAccepted = false;

    const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
      // Log all call-related messages for debugging
      if (message.message_type === 'call_accepted' || message.message_type === 'call_rejected' || message.message_type === 'call_request') {
        console.log('📞 [SENDER] Received call message:', {
          type: message.message_type,
          threadId: message.thread_id,
          expectedThreadId: threadId,
          senderId: message.sender_id,
          currentUserId: currentUserId,
          metadata: message.metadata,
          currentStatus: callStatusRef.current,
          hasAccepted: hasAccepted
        });
      }

      // Only process if we're still waiting for acceptance
      if (callStatusRef.current === 'ended') {
        return;
      }

      // If already connected, don't process again
      if (callStatusRef.current === 'connected' && hasAccepted) {
        return;
      }

      // Check if message belongs to this thread
      if (message.thread_id !== threadId) {
        return;
      }

      if (!hasAccepted && message.message_type === 'call_accepted' && message.metadata?.acceptedBy) {
        // Make sure the acceptedBy is not the current user (should be the receiver)
        if (message.metadata.acceptedBy === currentUserId) {
          console.log('📞 Ignoring call_accepted message from self');
          return; // Ignore if we sent this message ourselves
        }

        // Make sure the sender is not the current user (should be from receiver)
        if (message.sender_id === currentUserId) {
          console.log('📞 Ignoring call_accepted message sent by self');
          return;
        }

        console.log('📞 ✅ [SENDER] Call accepted by receiver - stopping ringtone and transitioning to connected');
        hasAccepted = true;

        // Stop ringtone immediately
        if (ringtoneRef.current) {
          console.log('📞 [SENDER] Stopping ringtone...');
          ringtoneRef.current.stop();
          ringtoneRef.current = null;
        }
        ringtoneService.stopRingtone();

        // Clear timeout immediately
        if (callTimeoutRef.current) {
          console.log('📞 [SENDER] Clearing call timeout...');
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }

        // Update status to connected
        if (isMountedRef.current) {
          console.log('📞 [SENDER] Setting call status to connected');
          setCallStatus('connected');
        }
      }
    });

    return () => {
      console.log('📞 Cleaning up call_accepted listener');
      unsubscribe();
    };
  }, [isIncoming, threadId, currentUserId]);

  // Listen for call_rejected messages
  useEffect(() => {
    if (!threadId || !currentUserId) {
      return;
    }

    console.log('📞 Setting up call_rejected listener (status:', callStatusRef.current, ')');

    let hasRejected = false;

    const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
      if (message.thread_id !== threadId) {
        return;
      }

      if (callStatusRef.current === 'ended') {
        return;
      }

      const isRejectionMessage = message.message_type === 'call_rejected';
      const isFromOtherUser = message.sender_id && message.sender_id !== currentUserId;
      const hasRejectionMetadata = message.metadata?.rejectedBy;

      if (!hasRejected && isRejectionMessage && hasRejectionMetadata && isFromOtherUser) {
        console.log('📞 Call rejected by other participant - closing call');
        hasRejected = true;

        if (ringtoneRef.current) {
          ringtoneRef.current.stop();
          ringtoneRef.current = null;
        }
        ringtoneService.stopRingtone();

        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }

        if (isMountedRef.current) {
          setCallStatus('ended');
          cleanupResources();
          setTimeout(() => {
            if (isMountedRef.current && onCallEnd) {
              onCallEnd();
            }
          }, 1000);
        }
      }
    });

    return () => {
      console.log('📞 Cleaning up call_rejected listener');
      unsubscribe();
    };
  }, [threadId, currentUserId, cleanupResources, onCallEnd]);

  // Listen for call_ended messages
  useEffect(() => {
    if (!threadId || !currentUserId) {
      return;
    }

    let hasEnded = false;

    const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
      if (message.thread_id !== threadId) {
        return;
      }

      if (callStatusRef.current === 'ended') {
        return;
      }

      const isEndMessage = message.message_type === 'call_ended';
      const isFromOtherUser = message.sender_id && message.sender_id !== currentUserId;
      const hasEndMetadata = message.metadata?.endedBy;

      if (!hasEnded && isEndMessage && hasEndMetadata && isFromOtherUser) {
        hasEnded = true;

        if (ringtoneRef.current) {
          ringtoneRef.current.stop();
          ringtoneRef.current = null;
        }
        ringtoneService.stopRingtone();

        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }

        if (isMountedRef.current) {
          setCallStatus('ended');
          cleanupResources();
          setTimeout(() => {
            if (isMountedRef.current && onCallEnd) {
              onCallEnd();
            }
          }, 1000);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [threadId, currentUserId, cleanupResources, onCallEnd]);

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

  const getVideoSDKToken = async (meetingId?: string, userId?: string): Promise<string> => {
    console.log('📞 Requesting VideoSDK token from API route');

    const roomId = meetingId || roomIdHint;
    if (!roomId) {
      throw new Error('Room ID is required. Please create a room first.');
    }
    const userIdValue = userId || user?.id || '';

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
      
      const token = await getVideoSDKToken(meetingId, user?.id);
      setRoomId(meetingId);
      
      const { VideoSDK } = await import('@videosdk.live/js-sdk');
      
      if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
        throw new Error('Invalid VideoSDK token format. Token must be a valid JWT.');
      }
      
      try {
        VideoSDK.config(token);
      } catch (configError: any) {
        console.error('❌ VideoSDK config error:', configError);
        throw new Error(`Failed to configure VideoSDK: ${configError.message || 'Unknown error'}`);
      }

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

      currentMeetingRef.current = meeting;

      meeting.on("meeting-joined", () => {
        if (isMountedRef.current) {
          // For outgoing calls, set status to ringing and start ringtone
          // For incoming calls, status will be set when user accepts
          if (!isIncoming) {
            setCallStatus('ringing');
            ringtoneService.playRingtone().then(r => {
              if (isMountedRef.current && callStatusRef.current === 'ringing') {
                ringtoneRef.current = r;
              }
            }).catch(err => {
              console.warn('⚠️ Failed to play ringtone:', err);
            });
          } else {
            // For incoming calls, don't set status here - wait for user to accept
            console.log('📞 Incoming call - meeting joined, waiting for user to accept');
          }

          try {
            const localParticipant = meeting.localParticipant;
            if (localParticipant) {
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

              setTimeout(() => {
                try {
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
          if (isIncoming) {
            // For incoming calls, participant joining means we're connected
            console.log('📞 [RECEIVER] Participant joined - call connected');
            setCallStatus('connected');
            if (ringtoneRef.current) {
              ringtoneRef.current.stop();
              ringtoneRef.current = null;
            }
            ringtoneService.stopRingtone();
          } else {
            // For outgoing calls, participant joining means receiver joined the meeting
            // This is a strong signal that receiver accepted, but we should still wait for call_accepted message
            // However, if call_accepted doesn't arrive quickly, we can use this as a fallback
            console.log('📞 [SENDER] Participant joined - receiver is in meeting, waiting for call_accepted message');
            
            // Set a short timeout - if call_accepted doesn't arrive in 2 seconds, assume connection is established
            setTimeout(() => {
              if (callStatusRef.current === 'ringing' && isMountedRef.current) {
                console.log('📞 [SENDER] Call_accepted message not received, but participant joined - assuming call accepted');
                if (ringtoneRef.current) {
                  ringtoneRef.current.stop();
                  ringtoneRef.current = null;
                }
                ringtoneService.stopRingtone();
                if (callTimeoutRef.current) {
                  clearTimeout(callTimeoutRef.current);
                  callTimeoutRef.current = null;
                }
                setCallStatus('connected');
              }
            }, 2000);
          }

          setParticipants(prev => {
            const exists = prev.find(x => x.id === participant.id);
            if (exists) return prev;
            const updated = [...prev, participant];
            
            try {
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

      meeting.on("meeting-left", async () => {
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

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video' && isVideoEnabled,
          audio: true
        });

        updateLocalStream(stream);

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = true;

        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        if (callType === 'video' && isVideoEnabled) {
          meeting.enableWebcam();
        }
        meeting.unmuteMic();
      } catch (mediaError: any) {
        console.warn('⚠️ Local media access failed, VideoSDK will handle it:', mediaError);
      }

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
    if (isAcceptingCall) {
      console.log('📞 Call already being accepted, ignoring duplicate click');
      return;
    }

    setIsAcceptingCall(true);

    try {
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      ringtoneService.stopRingtone();

      if (!roomIdHint) {
        console.error('❌ Cannot accept call - no roomIdHint provided');
        setError('Cannot accept call - missing room information.');
        setIsAcceptingCall(false);
        return;
      }

      setCallStatus('connecting');

      const token = await getVideoSDKToken(roomIdHint, user?.id);
      setRoomId(roomIdHint);

      const { VideoSDK } = await import('@videosdk.live/js-sdk');
      
      if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
        throw new Error('Invalid VideoSDK token format. Token must be a valid JWT.');
      }
      
      try {
        VideoSDK.config(token);
      } catch (configError: any) {
        console.error('❌ VideoSDK config error:', configError);
        throw new Error(`Failed to configure VideoSDK: ${configError.message || 'Unknown error'}`);
      }

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

      currentMeetingRef.current = meeting;

      meeting.on("meeting-joined", () => {
        if (isMountedRef.current) {
          setCallStatus('connected');

          setTimeout(() => {
            try {
              const localParticipantId = meeting.localParticipant?.id;
              const allParticipants = meeting.participants 
                ? Object.values(meeting.participants) 
                : [];
              
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

          try {
            const localParticipant = meeting.localParticipant;
            if (localParticipant) {
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
            
            try {
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

      meeting.on("meeting-left", async () => {
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
        }
        cleanupResources();
      });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video' && isVideoEnabled,
          audio: true
        });

        updateLocalStream(stream);

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = true;

        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        if (callType === 'video' && isVideoEnabled) {
          meeting.enableWebcam();
        }
        meeting.unmuteMic();
      } catch (mediaError: any) {
        console.warn('⚠️ Local media access failed, VideoSDK will handle it:', mediaError);
      }

      if (!currentMeetingRef.current) {
        throw new Error('Meeting initialization failed');
      }
      await meeting.join();
      
      // Send call_accepted message AFTER joining meeting
      if (threadId && currentUserId) {
        try {
          console.log('📞 [RECEIVER] Sending call_accepted message to sender...', { threadId, currentUserId, recipientName });
          const result = await supabaseMessagingService.sendMessage(
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
          console.log('📞 [RECEIVER] Call_accepted message sent successfully:', result);
        } catch (msgError) {
          console.error('❌ [RECEIVER] Failed to send call_accepted message:', msgError);
        }
      } else {
        console.warn('⚠️ [RECEIVER] Cannot send call_accepted - missing threadId or currentUserId', { threadId, currentUserId });
      }
    } catch (error: any) {
      console.error('❌ Error accepting call:', error);
      setError(`Failed to accept call: ${error.message || 'Please check your camera and microphone permissions.'}`);
      setCallStatus('ended');
      setIsAcceptingCall(false);
      cleanupResources();
    }
  };

  const handleRejectCall = async () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current = null;
    }
    ringtoneService.stopRingtone();
    
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
      }

      try {
        const { data: participants, error: participantsError } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('thread_id', threadId)
          .neq('user_id', currentUserId)

        if (participantsError || !participants || participants.length === 0) {
          return;
        }

        if (!isIncoming) {
          return;
        }

        const callerId = participants[0].user_id;
        const recipientWhoRejected = recipientName;

        await notificationService.sendMissedCallNotification(
          callerId,
          recipientWhoRejected,
          callType
        );
      } catch (notificationError) {
      }
    }
    
    setCallStatus('ended');
    setTimeout(() => {
      if (onCallEnd) onCallEnd();
    }, 1000);
  };

  const handleEndCall = async () => {
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
      }
    }
    
    cleanupResources();
    if (onCallEnd) onCallEnd();
    setTimeout(() => {
      if (onCallEnd) onCallEnd();
    }, 1000);
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

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

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false
      });
      
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

  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (videoElement && localStream) {
      try {
        if (videoElement.srcObject !== localStream) {
          videoElement.srcObject = localStream;
          console.log('📹 Local video stream attached to video element');
        }
        if (videoElement.paused) {
          videoElement.play().catch(err => 
            console.warn('⚠️ Local video playback error:', err)
          );
        }
      } catch (error) {
        console.error('❌ Error setting local video stream:', error);
      }
    } else if (videoElement && !localStream) {
      videoElement.srcObject = null;
    }
  }, [localStream]);

  useEffect(() => {
    const audioElement = remoteAudioRef.current;
    if (audioElement && remoteStreams.length > 0) {
      try {
        const combinedStream = new MediaStream();
        const addedTrackIds = new Set<string>();

        remoteStreams.forEach((stream, index) => {
          const audioTracks = stream.getAudioTracks();
          const videoTracks = stream.getVideoTracks();

          audioTracks.forEach(track => {
            if (!addedTrackIds.has(track.id)) {
              combinedStream.addTrack(track);
              addedTrackIds.add(track.id);

              if (!track.enabled) {
                track.enabled = true;
              }
            }
          });
        });

        const audioTrackCount = combinedStream.getAudioTracks().length;

        if (audioTrackCount > 0) {
          if (audioElement.srcObject !== combinedStream) {
            audioElement.srcObject = combinedStream;
          }

          audioElement.muted = !isSpeakerEnabled;

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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  useEffect(() => {
    if (isIncoming && callStatus === 'connecting') {
      const timer = setTimeout(() => {
        setCallStatus('ringing');
        ringtoneService.playRingtone().then(ringtone => {
          ringtoneRef.current = ringtone;
        });

        callTimeoutRef.current = setTimeout(() => {
          handleRejectCall();
        }, 45000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isIncoming, callStatus]);

  useEffect(() => {
    // Only set timeout for outgoing calls that are ringing
    if (!isIncoming && callStatus === 'ringing') {
      // Clear any existing timeout first
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      
      // Set new timeout
      callTimeoutRef.current = setTimeout(() => {
        console.log('📞 Call timeout - ending call');
        if (callStatusRef.current === 'ringing') {
          handleEndCall();
        }
      }, 45000);
    }

    // Always clear timeout when call is connected or ended
    if (callStatus === 'connected' || callStatus === 'ended') {
      if (callTimeoutRef.current) {
        console.log('📞 Clearing call timeout - call is', callStatus);
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

  useEffect(() => {
    if (callStatus === 'connected') {
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      ringtoneService.stopRingtone();
      setIsAcceptingCall(false);
    }

    if (callStatus === 'ended') {
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      ringtoneService.stopRingtone();
      setIsAcceptingCall(false);
    }
  }, [callStatus]);

  useEffect(() => {
    if (callStatus === 'ended') {
      const closeTimer = setTimeout(() => {
        if (onCallEnd) onCallEnd();
      }, 2000);

      return () => clearTimeout(closeTimer);
    }
  }, [callStatus, onCallEnd]);

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

  useEffect(() => {
    if (callStatus !== 'connected') return;

    const checkConnectionQuality = () => {
      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';

      if (remoteStreams.length === 0) {
        quality = 'poor';
      } else if (participants.length > 1) {
        quality = 'fair';
      } else {
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

    const interval = setInterval(checkConnectionQuality, 3000);
    checkConnectionQuality();

    return () => clearInterval(interval);
  }, [callStatus, remoteStreams.length, participants.length]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEmojiReaction = (emoji: string) => {
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

    setLastReactionEmoji(emoji);
    setReactionAnimation(true);
    setTimeout(() => {
      setReactionAnimation(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full h-full overflow-hidden">
      {/* Error Message */}
      {error && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-red-50 border-l-4 border-red-500 p-4 animate-slideIn">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Video/Audio Content */}
      <div className="relative w-full h-full overflow-hidden">
        {/* Remote Videos */}
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
          <div className="absolute top-4 right-4 w-32 h-40 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-2xl ring-2 ring-white/20 hover:scale-105 transition-transform duration-200">
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
            <div className="w-36 h-36 bg-gradient-to-br from-orange-500 to-orange-700 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-orange-200/50 animate-pulse">
              <span className="text-5xl font-bold text-white">
                {isIncoming ? callerName.charAt(0).toUpperCase() : recipientName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Participants Count */}
        {callStatus === 'connected' && (() => {
          let displayCount = participants.length + 1;
          
          if (currentMeetingRef.current) {
            try {
              const meeting = currentMeetingRef.current;
              const localParticipantId = meeting.localParticipant?.id;
              const allParticipants = meeting.participants 
                ? Object.values(meeting.participants) 
                : [];
              
              const remoteParticipants = allParticipants.filter(
                (p: any) => p.id !== localParticipantId
              );
              displayCount = remoteParticipants.length + 1;
            } catch (error) {
              console.warn('⚠️ Error calculating participant count:', error);
              displayCount = participants.length + 1;
            }
          }
          
          return (
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg border border-white/20">
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
                <div className="absolute bottom-4 left-4 text-xl font-bold tracking-wider text-white">{formatDuration(callDuration)}</div>
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

        {/* Accept/Reject Buttons - Incoming calls */}
        {callStatus === 'ringing' && isIncoming && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-8 px-4 z-30 pointer-events-auto">
            <div className="flex justify-center gap-6">
              <button
                onClick={handleAcceptCall}
                disabled={isAcceptingCall}
                className={`rounded-full p-5 shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 ${
                  isAcceptingCall
                    ? 'bg-gray-400 cursor-not-allowed opacity-60 text-white'
                    : 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white hover:shadow-xl hover:scale-110 active:scale-95 focus:ring-green-300'
                }`}
                title={isAcceptingCall ? 'Connecting...' : 'Answer Call'}
              >
                <PhoneOff className="w-7 h-7 rotate-180" />
              </button>
              <button
                onClick={handleRejectCall}
                className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300"
                title="Decline Call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            </div>
          </div>
        )}

        {/* End Call Button - Outgoing calls */}
        {callStatus === 'ringing' && !isIncoming && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-8 px-4 z-30 pointer-events-auto">
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleEndCall}
                className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300"
                title="Drop Call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            </div>
          </div>
        )}

        {/* Emoji Icon Button */}
        {callStatus === 'connected' && (
          <div className="absolute bottom-24 right-6 z-30 emoji-dropdown-container pointer-events-auto">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiDropdown(!showEmojiDropdown);
                }}
                className="rounded-full p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm cursor-pointer"
                title="Reactions"
                type="button"
              >
                <Smile className="w-6 h-6" />
              </button>
              
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

        {/* Controls Overlay - Connected call */}
        {callStatus === 'connected' && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-6 px-4 z-10">
            <div className="space-y-4 w-full max-w-2xl">
              <div className="flex justify-center items-center gap-3 flex-wrap">
                {/* Three-dot menu */}
                <div className="relative flex justify-center">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="rounded-full p-3.5 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm"
                    title="More options"
                  >
                    <MoreVertical className="w-6 h-6" />
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
                  className={`rounded-full p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isMuted 
                      ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus:ring-red-300' 
                      : 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {callType === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`rounded-full p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isVideoEnabled 
                        ? 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm' 
                        : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus:ring-red-300'
                    }`}
                    title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </button>
                )}

                <button
                  onClick={toggleSpeaker}
                  className={`rounded-full p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isSpeakerEnabled 
                      ? 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm' 
                      : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus:ring-red-300'
                  }`}
                  title={isSpeakerEnabled ? 'Turn off speaker' : 'Turn on speaker'}
                >
                  {isSpeakerEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>

                <button
                  onClick={handleRaiseHand}
                  className={`rounded-full p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isHandRaised 
                      ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white focus:ring-orange-300' 
                      : 'bg-white/90 hover:bg-white text-gray-700 focus:ring-gray-400 backdrop-blur-sm'
                  }`}
                  title={isHandRaised ? 'Lower hand' : 'Raise hand'}
                >
                  <Hand className="w-6 h-6" />
                </button>

                <button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-300"
                  title="End call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>

              {/* Message Input */}
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
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white px-5 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
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
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoSDKCallInterface;
