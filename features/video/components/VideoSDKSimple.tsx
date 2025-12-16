import React, { useState, useEffect } from 'react';
import { X, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

interface VideoSDKSimpleProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'audio' | 'video';
  meetingId?: string;
  onCallEnd?: () => void;
}

const VideoSDKSimple: React.FC<VideoSDKSimpleProps> = ({
  isOpen,
  onClose,
  callType,
  meetingId,
  onCallEnd
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [currentMeetingId, setCurrentMeetingId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_VIDEOSDK_API_KEY;
  const secretKey = process.env.NEXT_PUBLIC_VIDEOSDK_SECRET_KEY;

  useEffect(() => {
    if (isOpen) {
      // Generate a simple meeting ID for testing
      const newMeetingId = meetingId || `meeting-${Date.now()}`;
      setCurrentMeetingId(newMeetingId);
      setIsConnected(true);
      setError(null);
    } else {
      setIsConnected(false);
      setCurrentMeetingId('');
    }
  }, [isOpen, meetingId]);

  const handleToggleAudio = () => {
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  const handleEndCall = () => {
    setIsConnected(false);
    onCallEnd?.();
    onClose();
  };

  if (!isOpen) return null;

  if (!apiKey || !secretKey) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">VideoSDK Setup Required</h2>
          <p className="text-gray-600 mb-4">
            To use video calling, you need to configure your VideoSDK API key.
          </p>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-medium text-blue-800 mb-2">Quick Setup:</p>
              <ol className="space-y-1 text-blue-700">
                <li>1. Get your API key from <a href="https://videosdk.live/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">VideoSDK.live</a></li>
                <li>2. Create a <code className="bg-blue-100 px-1 rounded">.env.local</code> file in your project root</li>
                <li>3. Add: <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_VIDEOSDK_API_KEY=your_api_key_here</code></li>
                <li>4. Add: <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_VIDEOSDK_SECRET_KEY=your_secret_key_here</code></li>
                <li>5. Restart your development server</li>
              </ol>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {callType === 'video' ? 'Video Call' : 'Audio Call'} - VideoSDK
          </h2>
          <button
            onClick={handleEndCall}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Meeting ID Display */}
        {currentMeetingId && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Meeting ID:</strong> {currentMeetingId}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Share this ID with others to join the call
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="px-4 py-3 rounded mb-4 bg-red-100 border border-red-400 text-red-700">
            {error}
          </div>
        )}

        {/* Video Container */}
        <div className="flex-1 flex gap-4 mb-4">
          {/* Remote Video */}
          <div className="flex-1 bg-gray-900 rounded-lg relative">
            <div className="w-full h-full rounded-lg flex items-center justify-center">
              <div className="text-white text-center">
                <div className="text-4xl mb-4">📹</div>
                <p className="text-lg">Waiting for participant...</p>
                <p className="text-sm text-gray-400 mt-2">
                  Share the Meeting ID above to invite others
                </p>
              </div>
            </div>
          </div>

          {/* Local Video */}
          {callType === 'video' && (
            <div className="w-80 h-60 bg-gray-800 rounded-lg relative">
              <div className="w-full h-full rounded-lg flex items-center justify-center">
                {isVideoEnabled ? (
                  <div className="text-white text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-sm">Your Camera</p>
                  </div>
                ) : (
                  <div className="text-white text-center">
                    <div className="text-4xl mb-2">📷❌</div>
                    <p className="text-sm">Camera Off</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Call Controls */}
        <div className="flex justify-center space-x-4">
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
        </div>

        {/* Call Status */}
        <div className="mt-4 text-center text-sm text-gray-600">
          {isConnected && `Connected to meeting ${currentMeetingId}`}
          {!isConnected && 'Disconnected'}
        </div>

        {/* VideoSDK Integration Notice */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This is a simplified VideoSDK interface for testing. 
            The actual video/audio functionality requires proper VideoSDK React SDK integration.
            Your credentials are configured: API Key {apiKey ? '✅' : '❌'}, Secret Key {secretKey ? '✅' : '❌'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoSDKSimple;


