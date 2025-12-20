'use client';

import { useEffect, useState } from 'react';
import CallInterface from '@/features/video/components/CallInterface';

export default function Home() {
  const [userName, setUserName] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [token, setToken] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  // For testing: Use URL parameter or localStorage to set user ID
  // Default: random ID, or 'user-b' if in localStorage
  const [currentUserId] = useState(() => {
    if (typeof window !== 'undefined') {
      // Check URL parameter first
      const urlParams = new URLSearchParams(window.location.search);
      const userIdParam = urlParams.get('userId');
      if (userIdParam) {
        localStorage.setItem('testUserId', userIdParam);
        return userIdParam;
      }
      // Check localStorage
      const storedUserId = localStorage.getItem('testUserId');
      if (storedUserId) {
        return storedUserId;
      }
    }
    return 'user-' + Math.random().toString(36).substr(2, 9);
  });

  // Poll for notifications
  useEffect(() => {
    if (isInCall) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/messenger/notifications?userId=${currentUserId}`);
        const data = await res.json();
        if (data.notifications && data.notifications.length > 0) {
          setNotifications(data.notifications);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentUserId, isInCall]);

  const handleCreateCall = async () => {
    try {
      // Get token
      const tokenRes = await fetch('/api/messenger/generateToken');
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        alert('Error: ' + tokenData.error);
        return;
      }

      // Create room
      const roomRes = await fetch('/api/messenger/room', { method: 'POST' });
      const roomData = await roomRes.json();

      if (roomData.error) {
        alert('Error: ' + roomData.error);
        return;
      }

      setToken(tokenData.token);
      setRoomId(roomData.roomId);
      setIsInCall(true);

      // Notify User B (for demo, we'll use a fixed user ID)
      // In real app, you'd get this from your user system
      const targetUserId = 'user-b'; // Replace with actual user ID
      await fetch('/api/messenger/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomData.roomId,
          callerId: currentUserId,
          callerName: userName || 'User A',
          targetUserId,
        }),
      });
    } catch (error) {
      console.error('Error creating call:', error);
      alert('Failed to create call. Please check your API keys.');
    }
  };

  const handleJoinCall = async (notificationRoomId: string) => {
    try {
      const tokenRes = await fetch('/api/messenger/generateToken');
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        alert('Error: ' + tokenData.error);
        return;
      }

      setToken(tokenData.token);
      setRoomId(notificationRoomId);
      setIsInCall(true);
      setNotifications([]);
    } catch (error) {
      console.error('Error joining call:', error);
      alert('Failed to join call. Please check your API keys.');
    }
  };

  if (isInCall) {
    return (
      <CallInterface
        roomId={roomId}
        token={token}
        userName={userName || 'User'}
        onLeave={() => {
          setIsInCall(false);
          setRoomId('');
          setToken('');
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-center">Video Call App</h1>
        
        <div>
          <label className="block text-sm font-medium mb-2">Your Name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => {
              const value = e.target.value;
              setUserName(value);
            }}
            placeholder="Enter your name"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleCreateCall}
          disabled={!userName || userName.trim().length === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Start Call
        </button>
        
        {/* Debug info - remove in production */}
        <div className="text-xs text-gray-400 mt-2">
          Debug: userName = "{userName}", length = {userName.length}, disabled = {(!userName || userName.trim().length === 0).toString()}
        </div>

        {notifications.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">Incoming Calls</h2>
            {notifications.map((notif, idx) => (
              <div
                key={idx}
                className="p-4 border rounded-lg mb-2 flex justify-between items-center bg-blue-50"
              >
                <div>
                  <p className="font-medium">{notif.callerName} is calling</p>
                  <p className="text-sm text-gray-500">Room: {notif.roomId}</p>
                </div>
                <button
                  onClick={() => handleJoinCall(notif.roomId)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Answer
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>User ID: {currentUserId}</p>
          <p className="mt-2">To test: Open another browser/tab and use "user-b" as target</p>
        </div>
      </div>
    </div>
  );
}
