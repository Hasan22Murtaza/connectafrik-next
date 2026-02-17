import {
  MessageSquare,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  UserPlus,
  Video,
  VideoOff,
  Volume1,
  Volume2,
} from 'lucide-react';
import React from 'react';
import type { SpeakerLevel } from './types';

interface CallControlsProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  remoteScreenShareStream: MediaStream | null;
  screenShareParticipantName: string;
  speakerLevel: SpeakerLevel;
  callType: 'audio' | 'video';
  showMessageInput: boolean;
  showAddPeople: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleSpeaker: () => void;
  onToggleMessageInput: () => void;
  onToggleAddPeople: () => void;
  onEndCall: () => void;
}

const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  remoteScreenShareStream,
  screenShareParticipantName,
  speakerLevel,
  callType,
  showMessageInput,
  showAddPeople,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleSpeaker,
  onToggleMessageInput,
  onToggleAddPeople,
  onEndCall,
}) => {
  const screenShareDisabled = !!remoteScreenShareStream && !isScreenSharing;

  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-2 sm:pb-3 md:pb-6 mb-20 sm:mb-0 px-2 sm:px-3 md:px-4 z-30">
      <div className="space-y-2 sm:space-y-3 md:space-y-4 w-full max-w-2xl">
        <div className="flex justify-center items-center gap-1.5 sm:gap-2 md:gap-3 flex-wrap bg-black/40 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 shadow-2xl border border-white/10 transition-all duration-300">
          {/* Mute */}
          <button
            onClick={onToggleMute}
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

          {/* Video toggle */}
          {callType === 'video' && (
            <button
              onClick={onToggleVideo}
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

          {/* Speaker */}
          <button
            onClick={onToggleSpeaker}
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

          {/* Screen share */}
          <button
            onClick={onToggleScreenShare}
            disabled={screenShareDisabled}
            className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md focus:outline-none ${
              screenShareDisabled
                ? 'bg-gray-400/60 text-gray-500 cursor-not-allowed opacity-50'
                : isScreenSharing
                  ? 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white hover:shadow-lg hover:scale-110 active:scale-95'
                  : 'bg-white/90 hover:bg-white text-gray-700 backdrop-blur-sm hover:shadow-lg hover:scale-110 active:scale-95'
            }`}
            title={screenShareDisabled ? `${screenShareParticipantName} is already presenting` : isScreenSharing ? 'Stop sharing' : 'Share screen'}
            aria-label={screenShareDisabled ? 'Screen share unavailable - someone is presenting' : isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
          </button>

          {/* Message */}
          <button
            onClick={onToggleMessageInput}
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

          {/* Add people */}
          <button
            onClick={onToggleAddPeople}
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

          {/* End call */}
          <button
            onClick={onEndCall}
            className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-2.5 sm:p-3 md:p-4 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
            title="End call"
            aria-label="End call"
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallControls;
