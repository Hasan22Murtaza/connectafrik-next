import React, { useState, useEffect } from 'react';
import { X, Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';

interface DirectCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'audio' | 'video';
  callerName: string;
  recipientName: string;
  isIncoming?: boolean; // true if receiving a call, false if making a call
  onAccept?: () => void;
  onReject?: () => void;
  onCallEnd?: () => void;
}

const DirectCallModal: React.FC<DirectCallModalProps> = ({
  isOpen,
  onClose,
  callType,
  callerName,
  recipientName,
  isIncoming = false,
  onAccept,
  onReject,
  onCallEnd
}) => {
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [callDuration, setCallDuration] = useState(0);

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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCallStatus('connecting');
      setCallDuration(0);
      setIsMuted(false);
      setIsVideoEnabled(callType === 'video');
    }
  }, [isOpen, callType]);

  // Auto-connect for outgoing calls, show ringing for incoming
  useEffect(() => {
    if (isOpen) {
      if (isIncoming) {
        setCallStatus('ringing');
      } else {
        setCallStatus('connecting');
        // Simulate connection delay
        setTimeout(() => {
          setCallStatus('connected');
        }, 2000);
      }
    } else {
      // Don't set to 'ended' immediately when closing - let the component unmount cleanly
      setCallDuration(0);
    }
  }, [isOpen, isIncoming]);

  const handleAccept = () => {
    setCallStatus('connected');
    onAccept?.();
  };

  const handleReject = () => {
    setCallStatus('ended');
    onReject?.();
    onClose();
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    onCallEnd?.();
    onClose();
  };

  const handleToggleAudio = () => {
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {callType === 'video' ? 'Video Call' : 'Audio Call'} - {isIncoming ? 'Incoming' : 'Outgoing'}
          </h2>
          <button
            onClick={handleEndCall}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Call Status */}
        <div className="text-center mb-4">
          {callStatus === 'connecting' && (
            <div className="text-blue-600">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p>Connecting to {recipientName}...</p>
            </div>
          )}
          
          {callStatus === 'ringing' && (
            <div className="text-green-600">
              <div className="animate-pulse text-4xl mb-2">📞</div>
              <p className="text-lg font-semibold">Incoming {callType} call from {callerName}</p>
            </div>
          )}
          
          {callStatus === 'connected' && (
            <div className="text-green-600">
              <p className="text-lg font-semibold">Connected to {recipientName}</p>
              <p className="text-sm text-gray-600">Duration: {formatDuration(callDuration)}</p>
            </div>
          )}
        </div>

        {/* Video Container - Only show when connected */}
        {callStatus === 'connected' && (
          <div className="flex-1 flex gap-4 mb-4">
            {/* Remote Video */}
            <div className="flex-1 bg-gray-900 rounded-lg relative overflow-hidden">
              {callType === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900">
                  <div className="text-white text-center">
                    <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4 mx-auto">
                      <span className="text-4xl">👤</span>
                    </div>
                    <p className="text-lg font-medium">{recipientName}</p>
                    <p className="text-sm text-gray-300">Video call active</p>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-900 to-blue-900">
                  <div className="text-white text-center">
                    <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4 mx-auto">
                      <span className="text-4xl">🎤</span>
                    </div>
                    <p className="text-lg font-medium">{recipientName}</p>
                    <p className="text-sm text-gray-300">Audio call active</p>
                  </div>
                </div>
              )}
            </div>

            {/* Local Video */}
            {callType === 'video' && (
              <div className="w-80 h-60 bg-gray-800 rounded-lg relative overflow-hidden">
                {isVideoEnabled ? (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                    <div className="text-white text-center">
                      <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-2 mx-auto">
                        <span className="text-2xl">📷</span>
                      </div>
                      <p className="text-sm">Your Camera</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-600">
                    <div className="text-white text-center">
                      <div className="w-16 h-16 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center mb-2 mx-auto">
                        <span className="text-2xl">📷❌</span>
                      </div>
                      <p className="text-sm">Camera Off</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Call Controls */}
        <div className="flex justify-center space-x-4">
          {/* Incoming Call Controls */}
          {callStatus === 'ringing' && isIncoming && (
            <>
              <button
                onClick={handleReject}
                className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
              <button
                onClick={handleAccept}
                className="p-4 rounded-full bg-green-500 text-white hover:bg-green-600"
              >
                <Phone className="w-8 h-8" />
              </button>
            </>
          )}

          {/* Connected Call Controls */}
          {callStatus === 'connected' && (
            <>
              {/* Audio Toggle */}
              <button
                onClick={handleToggleAudio}
                className={`p-3 rounded-full ${
                  isMuted 
                    ? 'bg-red-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              {/* Video Toggle (only for video calls) */}
              {callType === 'video' && (
                <button
                  onClick={handleToggleVideo}
                  className={`p-3 rounded-full ${
                    !isVideoEnabled 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {!isVideoEnabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>
              )}

              {/* End Call */}
              <button
                onClick={handleEndCall}
                className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Outgoing Call - Cancel */}
          {callStatus === 'connecting' && !isIncoming && (
            <button
              onClick={handleEndCall}
              className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Call Info */}
        <div className="mt-4 text-center text-sm text-gray-600">
          {callStatus === 'connecting' && `Calling ${recipientName}...`}
          {callStatus === 'ringing' && `Incoming call from ${callerName}`}
          {callStatus === 'connected' && `Connected to ${recipientName}`}
          {callStatus === 'ended' && 'Call ended'}
        </div>

      </div>
    </div>
  );
};

export default DirectCallModal;
