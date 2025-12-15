import React, { useState } from 'react';
import CallButton from '@/features/video/components/CallButton';

const FacebookStyleTest: React.FC = () => {
  const [callHistory, setCallHistory] = useState<Array<{
    id: string;
    userId: string;
    userName: string;
    callType: 'audio' | 'video';
    timestamp: Date;
    duration?: number;
  }>>([]);

  // Mock users data
  const mockUsers = [
    { id: '1', name: 'John Doe', isOnline: true, avatar: undefined },
    { id: '2', name: 'Jane Smith', isOnline: true, avatar: undefined },
    { id: '3', name: 'Mike Johnson', isOnline: false, avatar: undefined },
    { id: '4', name: 'Sarah Wilson', isOnline: true, avatar: undefined },
    { id: '5', name: 'David Brown', isOnline: true, avatar: undefined },
  ];

  const handleCallStart = (userId: string, callType: 'audio' | 'video') => {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      console.log(`Starting ${callType} call with ${user.name}`);
      // In a real app, this would initiate the call via WebSocket/API
    }
  };

  const handleCallEnd = (userId: string) => {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      console.log(`Ended call with ${user.name}`);
      // In a real app, this would end the call and update call history
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Facebook-Style Direct Calling
        </h1>
        <p className="text-gray-600">
          Click the call buttons to start direct user-to-user calls - no meeting IDs needed!
        </p>
      </div>

      {/* Online Users Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Online Friends ({mockUsers.filter(u => u.isOnline).length})
        </h2>
        <div className="space-y-4">
          {mockUsers
            .filter(user => user.isOnline)
            .map(user => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <CallButton
                  userId={user.id}
                  userName={user.name}
                  userAvatar={user.avatar}
                  isOnline={user.isOnline}
                  onCallStart={handleCallStart}
                  onCallEnd={handleCallEnd}
                />
              </div>
            ))}
        </div>
      </div>

      {/* Offline Users Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Offline Friends ({mockUsers.filter(u => !u.isOnline).length})
        </h2>
        <div className="space-y-4">
          {mockUsers
            .filter(user => !user.isOnline)
            .map(user => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm opacity-60">
                <CallButton
                  userId={user.id}
                  userName={user.name}
                  userAvatar={user.avatar}
                  isOnline={user.isOnline}
                  onCallStart={handleCallStart}
                  onCallEnd={handleCallEnd}
                />
              </div>
            ))}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          How Facebook-Style Calling Works
        </h3>
        <div className="space-y-3 text-blue-800">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <p><strong>Direct Connection:</strong> When you click "Call", it creates a direct connection between you and the other user - no meeting rooms or IDs needed.</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <p><strong>Real-time Invitation:</strong> The other user gets a notification/ringtone and can accept or reject the call instantly.</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <p><strong>Secure & Private:</strong> The call is encrypted and only between the two users - no one else can join.</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
            <p><strong>Call History:</strong> All calls are logged in your call history for easy access later.</p>
          </div>
        </div>
      </div>

      {/* Technical Implementation Note */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-800 mb-2">Technical Implementation:</h4>
        <p className="text-yellow-700 text-sm">
          In production, this would use WebSocket connections for real-time call invitations, 
          VideoSDK for the actual video/audio streaming, and your backend to manage call states 
          and user presence. The key difference from meeting-based systems is the <strong>direct user-to-user connection</strong>.
        </p>
      </div>
    </div>
  );
};

export default FacebookStyleTest;


