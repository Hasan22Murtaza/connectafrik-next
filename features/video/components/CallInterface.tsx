'use client';

import { useEffect, useRef, useState } from 'react';

interface CallInterfaceProps {
  roomId: string;
  token: string;
  userName: string;
  onLeave: () => void;
}

export default function CallInterface({
  roomId,
  token,
  userName,
  onLeave,
}: CallInterfaceProps) {
  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<Map<string, any>>(new Map());
  const [micEnabled, setMicEnabled] = useState(true);
  const [webcamEnabled, setWebcamEnabled] = useState(true);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const localParticipantRef = useRef<HTMLDivElement>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const streamsRef = useRef<Map<string, { video?: MediaStream; audio?: MediaStream }>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Helper to extract MediaStream from VideoSDK stream object
  const getMediaStream = (stream: any): MediaStream | null => {
    try {
      // If it's already a MediaStream
      if (stream instanceof MediaStream) {
        return stream;
      }
      // If it has mediaStream property
      if (stream?.mediaStream instanceof MediaStream) {
        return stream.mediaStream;
      }
      // If it has getMediaStream method
      if (stream?.getMediaStream && typeof stream.getMediaStream === 'function') {
        return stream.getMediaStream();
      }
      // If it has getTracks method (MediaStream-like)
      if (stream?.getTracks && typeof stream.getTracks === 'function') {
        return stream as MediaStream;
      }
      // If it has track property
      if (stream?.track) {
        return new MediaStream([stream.track]);
      }
      // If it has tracks array
      if (Array.isArray(stream?.tracks)) {
        return new MediaStream(stream.tracks);
      }
      console.warn('Unable to extract MediaStream from:', stream);
      return null;
    } catch (error) {
      console.error('Error extracting MediaStream:', error, stream);
      return null;
    }
  };

  // Helper function to display remote participant video
  const displayVideo = (participantId: string, stream: MediaStream) => {
    if (!videoContainerRef.current) {
      console.warn('Video container ref not available');
      return;
    }

    if (!stream || !(stream instanceof MediaStream)) {
      console.error('Invalid stream provided to displayVideo:', stream);
      return;
    }

    // Remove existing video if any
    const existing = document.getElementById(`video-${participantId}`);
    if (existing) existing.remove();

    // Create video element
    const videoElement = document.createElement('video');
    videoElement.id = `video-${participantId}`;
    videoElement.srcObject = stream;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.className = 'w-full h-full object-cover rounded-lg';
    
    // Add error handling
    videoElement.onerror = (e) => {
      console.error('Video element error:', e);
    };
    
    videoElement.onloadedmetadata = () => {
      console.log(`Video metadata loaded for ${participantId}`);
      videoElement.play().catch(err => console.error('Video play error:', err));
    };

    // Create container
    const container = document.createElement('div');
    container.className = 'relative w-full h-full bg-gray-900 rounded-lg overflow-hidden';
    container.id = `container-${participantId}`;
    container.appendChild(videoElement);

    // Add participant name
    const nameLabel = document.createElement('div');
    nameLabel.className = 'absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm';
    nameLabel.textContent = participants.get(participantId)?.displayName || 'Participant';
    container.appendChild(nameLabel);

    videoContainerRef.current.appendChild(container);
    console.log(`Video displayed for participant: ${participantId}`, stream);
  };

  const removeVideo = (participantId: string) => {
    const container = document.getElementById(`container-${participantId}`);
    if (container) container.remove();
  };

  // Enhanced audio playback with proper management
  const playAudio = (participantId: string, stream: MediaStream) => {
    if (!stream || !(stream instanceof MediaStream)) {
      console.error('Invalid audio stream provided:', stream);
      return;
    }

    // Remove existing audio element if any
    const existingAudio = audioElementsRef.current.get(participantId);
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.srcObject = null;
      existingAudio.remove();
      audioElementsRef.current.delete(participantId);
    }

    // Create new audio element
    const audioElement = document.createElement('audio');
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    audioElement.id = `audio-${participantId}`;
    audioElement.volume = 1.0;
    
    // Ensure audio plays even if autoplay is blocked
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn('Audio autoplay blocked:', error);
        // Try to play on user interaction
        const playOnClick = () => {
          audioElement.play().catch(console.error);
          document.removeEventListener('click', playOnClick);
        };
        document.addEventListener('click', playOnClick, { once: true });
      });
    }

    // Store reference for cleanup
    audioElementsRef.current.set(participantId, audioElement);
    document.body.appendChild(audioElement);
    
    console.log(`Audio stream enabled for participant: ${participantId}`, stream);
  };

  const removeAudio = (participantId: string) => {
    const audioElement = audioElementsRef.current.get(participantId);
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
      audioElement.remove();
      audioElementsRef.current.delete(participantId);
      console.log(`Audio stream removed for participant: ${participantId}`);
    }
  };

  useEffect(() => {
    // Ensure we're in the browser
    if (typeof window === 'undefined') return;

    // Dynamically import VideoSDK to avoid SSR issues
    let meetingInstance: any = null;
    
    const initVideoSDK = async () => {
      try {
        const { VideoSDK } = await import('@videosdk.live/js-sdk');
        
        // Configure VideoSDK with token
        VideoSDK.config(token);

        // Initialize meeting with audio and video enabled
        meetingInstance = VideoSDK.initMeeting({
          meetingId: roomId,
          name: userName,
          micEnabled: true,  // Enable microphone by default
          webcamEnabled: true, // Enable webcam by default
          maxResolution: 'hd',
        });

        // Event: Meeting joined
        meetingInstance.on('meeting-joined', () => {
          console.log('Meeting joined successfully');
          setMeeting(meetingInstance);
          
          // Small delay to ensure participant is ready
          setTimeout(() => {
            // Ensure local audio and video are enabled
            const localParticipant = meetingInstance.localParticipant;
            if (localParticipant) {
              console.log('Local participant state:', {
                micEnabled: localParticipant.micEnabled,
                webcamEnabled: localParticipant.webcamEnabled,
                streams: localParticipant.streams
              });
              
              // Enable mic if not already enabled
              if (!localParticipant.micEnabled) {
                try {
                  meetingInstance.unmuteMic();
                  console.log('Mic unmuted');
                } catch (error) {
                  console.error('Error unmuting mic:', error);
                }
              }
              
              // Enable webcam if not already enabled
              if (!localParticipant.webcamEnabled) {
                try {
                  meetingInstance.enableWebcam();
                  console.log('Webcam enabled');
                } catch (error) {
                  console.error('Error enabling webcam:', error);
                }
              }
            }
          }, 500);
        });

        // Event: Participant joined
        meetingInstance.on('participant-joined', (participant: any) => {
          // Skip local participant - only track remote participants
          if (participant.id === meetingInstance.localParticipant?.id) {
            console.log('Skipping local participant in remote participants list');
            return;
          }

          console.log('Participant joined:', participant.id, participant.displayName);
          
          // Check if participant already exists to avoid duplicates
          setParticipants((prev) => {
            if (prev.has(participant.id)) {
              console.log(`Participant ${participant.id} already exists, skipping duplicate`);
              return prev;
            }
            const newMap = new Map(prev);
            newMap.set(participant.id, participant);
            return newMap;
          });

          // Initialize stream tracking for this participant (only if not already tracked)
          if (!streamsRef.current.has(participant.id)) {
            streamsRef.current.set(participant.id, {});

            // Function to handle stream subscription - only subscribe once
            const subscribeToStreams = () => {
              try {
                // Explicitly subscribe to video and audio - use participant's subscribe method
                if (participant.subscribe && typeof participant.subscribe === 'function') {
                  // Subscribe to both video and audio in one call if possible
                  participant.subscribe('video');
                  participant.subscribe('audio');
                  console.log(`Subscribed to streams for ${participant.id}`);
                }
              } catch (error) {
                console.warn('Error subscribing to streams:', error);
              }
            };

            // Subscribe immediately
            subscribeToStreams();

            // Subscribe to participant's media streams - set up event handlers only once
            const streamEnabledHandler = (stream: any) => {
              console.log(`Stream enabled for ${participant.id}:`, stream.kind, stream);
              const mediaStream = getMediaStream(stream);
              
              if (!mediaStream) {
                console.error(`Failed to extract MediaStream for ${participant.id}, kind: ${stream.kind}`);
                return;
              }
              
              // Update stream tracking
              const streams = streamsRef.current.get(participant.id) || {};
              if (stream.kind === 'video') {
                // Only display if we don't already have this stream
                if (!streams.video || streams.video.id !== mediaStream.id) {
                  streams.video = mediaStream;
                  displayVideo(participant.id, mediaStream);
                }
              } else if (stream.kind === 'audio') {
                // Only play if we don't already have this stream
                if (!streams.audio || streams.audio.id !== mediaStream.id) {
                  streams.audio = mediaStream;
                  playAudio(participant.id, mediaStream);
                }
              }
              streamsRef.current.set(participant.id, streams);
            };

            const streamDisabledHandler = (stream: any) => {
              console.log(`Stream disabled for ${participant.id}:`, stream.kind);
              if (stream.kind === 'video') {
                removeVideo(participant.id);
                const streams = streamsRef.current.get(participant.id) || {};
                delete streams.video;
                streamsRef.current.set(participant.id, streams);
              } else if (stream.kind === 'audio') {
                removeAudio(participant.id);
                const streams = streamsRef.current.get(participant.id) || {};
                delete streams.audio;
                streamsRef.current.set(participant.id, streams);
              }
            };

            // Set up event handlers
            participant.on('stream-enabled', streamEnabledHandler);
            participant.on('stream-disabled', streamDisabledHandler);

            // Check if participant already has active streams
            if (participant.streams && Array.isArray(participant.streams)) {
              console.log(`Checking existing streams for ${participant.id}:`, participant.streams);
              participant.streams.forEach((stream: any) => {
                const mediaStream = getMediaStream(stream);
                if (mediaStream) {
                  if (stream.kind === 'video') {
                    displayVideo(participant.id, mediaStream);
                  } else if (stream.kind === 'audio') {
                    playAudio(participant.id, mediaStream);
                  }
                }
              });
            }

            // Also check for videoStream and audioStream properties
            if (participant.videoStream) {
              const mediaStream = getMediaStream(participant.videoStream);
              if (mediaStream) {
                displayVideo(participant.id, mediaStream);
              }
            }
            if (participant.audioStream) {
              const mediaStream = getMediaStream(participant.audioStream);
              if (mediaStream) {
                playAudio(participant.id, mediaStream);
              }
            }
          }
        });

        // Event: Participant left
        meetingInstance.on('participant-left', (participant: any) => {
          // Skip local participant
          if (participant.id === meetingInstance.localParticipant?.id) {
            return;
          }
          
          console.log('Participant left:', participant.id);
          removeVideo(participant.id);
          removeAudio(participant.id);
          streamsRef.current.delete(participant.id);
          setParticipants((prev) => {
            const newMap = new Map(prev);
            newMap.delete(participant.id);
            return newMap;
          });
        });

        // Join the meeting
        meetingInstance.join();
      } catch (error) {
        console.error('Error initializing VideoSDK:', error);
        alert('Failed to initialize call. Please check your connection and try again.');
      }
    };

    initVideoSDK();

    // Cleanup
    return () => {
      // Clean up all audio elements
      audioElementsRef.current.forEach((audio, participantId) => {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      });
      audioElementsRef.current.clear();
      streamsRef.current.clear();

      if (meetingInstance) {
        meetingInstance.leave();
      }
    };
  }, [roomId, token, userName]);

  // Display local video - Enhanced with better stream handling
  useEffect(() => {
    if (meeting && localParticipantRef.current) {
      const localParticipant = meeting.localParticipant;
      
      if (localParticipant) {
        // Handle local video stream
        const handleStreamEnabled = (stream: any) => {
          console.log('Local stream enabled:', stream.kind, stream);
          if (stream.kind === 'video' && localParticipantRef.current) {
            const mediaStream = getMediaStream(stream);
            if (mediaStream) {
              // Clear existing content
              localParticipantRef.current.innerHTML = '';
              
              // Create video element
              const videoElement = document.createElement('video');
              videoElement.srcObject = mediaStream;
              videoElement.autoplay = true;
              videoElement.playsInline = true;
              videoElement.muted = true; // Mute local video to avoid echo
              videoElement.className = 'w-full h-full object-cover rounded-lg';
              
              // Add error handling
              videoElement.onerror = (e) => {
                console.error('Local video element error:', e);
              };
              
              videoElement.onloadedmetadata = () => {
                console.log('Local video metadata loaded');
                videoElement.play().catch(err => console.error('Local video play error:', err));
              };
              
              // Store reference
              localVideoRef.current = videoElement;
              
              // Add name label
              const nameLabel = document.createElement('div');
              nameLabel.className = 'absolute bottom-1 left-1 bg-black bg-opacity-50 text-white px-2 py-0.5 rounded text-xs z-10';
              nameLabel.textContent = `${userName} (You)`;
              
              localParticipantRef.current.appendChild(videoElement);
              localParticipantRef.current.appendChild(nameLabel);
              
              console.log('Local video displayed');
            } else {
              console.error('Failed to get MediaStream from local stream');
            }
          }
        };

        localParticipant.on('stream-enabled', handleStreamEnabled);

        // Check if local participant already has video stream
        if (localParticipant.streams && Array.isArray(localParticipant.streams)) {
          console.log('Checking local participant streams:', localParticipant.streams);
          localParticipant.streams.forEach((stream: any) => {
            if (stream.kind === 'video') {
              handleStreamEnabled(stream);
            }
          });
        }

        // Also try to get stream directly from localParticipant properties
        if (localParticipant.videoStream) {
          const mediaStream = getMediaStream(localParticipant.videoStream);
          if (mediaStream && localParticipantRef.current) {
            localParticipantRef.current.innerHTML = '';
            const videoElement = document.createElement('video');
            videoElement.srcObject = mediaStream;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;
            videoElement.className = 'w-full h-full object-cover rounded-lg';
            
            videoElement.onloadedmetadata = () => {
              videoElement.play().catch(err => console.error('Local video play error:', err));
            };
            
            localVideoRef.current = videoElement;
            
            const nameLabel = document.createElement('div');
            nameLabel.className = 'absolute bottom-1 left-1 bg-black bg-opacity-50 text-white px-2 py-0.5 rounded text-xs z-10';
            nameLabel.textContent = `${userName} (You)`;
            
            localParticipantRef.current.appendChild(videoElement);
            localParticipantRef.current.appendChild(nameLabel);
            console.log('Local video displayed from videoStream property');
          }
        }

        // Update mic and webcam state based on actual state
        setMicEnabled(localParticipant.micEnabled ?? true);
        setWebcamEnabled(localParticipant.webcamEnabled ?? true);
      }
    }
  }, [meeting, userName]);

  const toggleMic = () => {
    if (meeting) {
      if (micEnabled) {
        meeting.muteMic();
      } else {
        meeting.unmuteMic();
      }
      setMicEnabled(!micEnabled);
    }
  };

  const toggleWebcam = () => {
    if (meeting) {
      if (webcamEnabled) {
        meeting.disableWebcam();
      } else {
        meeting.enableWebcam();
      }
      setWebcamEnabled(!webcamEnabled);
    }
  };

  const handleLeave = () => {
    // Clean up all audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    audioElementsRef.current.clear();
    streamsRef.current.clear();

    if (meeting) {
      meeting.leave();
    }
    onLeave();
  };

  // Filter out local participant to ensure we only show remote participants
  const remoteParticipants = Array.from(participants.values()).filter(
    (participant) => meeting?.localParticipant?.id !== participant.id
  );

  return (
    <div className="flex flex-col h-screen bg-gray-900 relative">
      {/* Main Video Container - Facebook style: large remote video, small local video in corner */}
      <div className="flex-1 relative overflow-hidden">
        {/* Remote Participant Video - Takes full screen */}
        <div 
          ref={videoContainerRef}
          className="w-full h-full flex items-center justify-center"
        >
          {remoteParticipants.length === 0 && (
            <div className="text-white text-center">
              <div className="text-4xl mb-4">📞</div>
              <div className="text-xl">Waiting for participant to join...</div>
            </div>
          )}
        </div>

        {/* Local Video - Small preview in bottom right corner (Facebook style) */}
        <div 
          ref={localParticipantRef}
          className="absolute bottom-20 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-white"
        >
          <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white px-2 py-0.5 rounded text-xs z-10">
            {userName} (You)
          </div>
        </div>
      </div>

      {/* Controls - Fixed at bottom */}
      <div className="bg-gray-800 bg-opacity-90 p-4 flex justify-center gap-4 z-20">
        <button
          onClick={toggleMic}
          className={`px-6 py-3 rounded-full font-medium transition-all transform hover:scale-105 ${
            micEnabled 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
          title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micEnabled ? '🎤 Mic On' : '🔇 Mic Off'}
        </button>
        <button
          onClick={toggleWebcam}
          className={`px-6 py-3 rounded-full font-medium transition-all transform hover:scale-105 ${
            webcamEnabled 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
          title={webcamEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {webcamEnabled ? '📹 Camera On' : '📷 Camera Off'}
        </button>
        <button
          onClick={handleLeave}
          className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 font-medium transition-all transform hover:scale-105"
          title="End call"
        >
          📞 Leave Call
        </button>
      </div>
    </div>
  );
}

