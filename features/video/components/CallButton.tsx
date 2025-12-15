import React, { useState } from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';
import DirectCallModal from '@/features/video/components/DirectCallModal';

interface CallButtonProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  isOnline?: boolean;
  onCallStart?: (userId: string, callType: 'audio' | 'video') => void;
  onCallEnd?: (userId: string) => void;
}

const CallButton: React.FC<CallButtonProps> = ({
  userId,
  userName,
  userAvatar,
  isOnline = true,
  onCallStart,
  onCallEnd
}) => {
  const [activeCall, setActiveCall] = useState<{
    type: 'audio' | 'video';
    isIncoming: boolean;
  } | null>(null);

  const handleStartCall = (callType: 'audio' | 'video') => {
    setActiveCall({ type: callType, isIncoming: false });
    onCallStart?.(userId, callType);
  };

  const handleEndCall = () => {
    setActiveCall(null);
    onCallEnd?.(userId);
  };

  const handleAcceptCall = () => {
    // In a real app, this would accept the incoming call
    console.log('Call accepted');
  };

  const handleRejectCall = () => {
    setActiveCall(null);
    console.log('Call rejected');
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        {/* User Info */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-10 h-10 rounded-full" />
              ) : (
                <span className="text-gray-600 font-semibold">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {/* Online Status Indicator */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>
          
          <div>
            <p className="font-medium text-gray-900">{userName}</p>
            <p className="text-sm text-gray-500">
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Call Buttons */}
        <div className="flex space-x-2">
          {/* Audio Call Button */}
          <button
            onClick={() => handleStartCall('audio')}
            disabled={!isOnline}
            className={`p-2 rounded-full ${
              isOnline 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            } transition-colors`}
            title={`Call ${userName}`}
          >
            <Phone className="w-5 h-5" />
          </button>

          {/* Video Call Button */}
          <button
            onClick={() => handleStartCall('video')}
            disabled={!isOnline}
            className={`p-2 rounded-full ${
              isOnline 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            } transition-colors`}
            title={`Video call ${userName}`}
          >
            <Video className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Direct Call Modal */}
      {activeCall && (
        <DirectCallModal
          isOpen={!!activeCall}
          onClose={handleEndCall}
          callType={activeCall.type}
          callerName="You"
          recipientName={userName}
          isIncoming={activeCall.isIncoming}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onCallEnd={handleEndCall}
        />
      )}
    </>
  );
};

export default CallButton;


