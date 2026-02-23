import { PhoneOff } from 'lucide-react';
import React from 'react';

interface IncomingCallControlsProps {
  isAcceptingCall: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallControls: React.FC<IncomingCallControlsProps> = ({
  isAcceptingCall,
  onAccept,
  onReject,
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-4 sm:pb-6 md:pb-8 mb-20 sm:mb-0 px-4 z-30 pointer-events-auto">
      <div className="flex justify-center gap-3 sm:gap-4 md:gap-6">
        <button
          onClick={onAccept}
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
          onClick={onReject}
          className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-3 sm:p-4 md:p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
          title="Decline Call"
          aria-label="Decline call"
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
        </button>
      </div>
    </div>
  );
};

export default IncomingCallControls;
