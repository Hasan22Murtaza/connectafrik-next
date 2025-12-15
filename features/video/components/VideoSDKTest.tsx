import React, { useState } from 'react'
import VideoSDKSimple from '@/features/video/components/VideoSDKSimple'

const VideoSDKTest: React.FC = () => {
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [isAudioCallOpen, setIsAudioCallOpen] = useState(false)
  const [meetingId, setMeetingId] = useState('')
  const [participantName, setParticipantName] = useState('Test User')

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">VideoSDK Test</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Participant Name
          </label>
          <input
            type="text"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meeting ID (optional - leave empty to create new)
          </label>
          <input
            type="text"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter meeting ID or leave empty"
          />
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => setIsVideoCallOpen(true)}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Start Video Call
          </button>
          
          <button
            onClick={() => setIsAudioCallOpen(true)}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            Start Audio Call
          </button>
        </div>

        <div className="text-sm text-gray-600">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Make sure you have your VideoSDK API key and secret key in .env.local file</li>
            <li>Open this page in two different browser tabs</li>
            <li>Click the same call button in both tabs</li>
            <li>Allow camera/microphone permissions when prompted</li>
            <li>You should see and hear each other!</li>
          </ol>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Note:</strong> VideoSDK provides excellent reliability and easy setup for video calls.
          </p>
        </div>
      </div>

      {/* Video Call Modal */}
      <VideoSDKSimple
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        callType="video"
        meetingId={meetingId || undefined}
        onCallEnd={() => setIsVideoCallOpen(false)}
      />

      {/* Audio Call Modal */}
      <VideoSDKSimple
        isOpen={isAudioCallOpen}
        onClose={() => setIsAudioCallOpen(false)}
        callType="audio"
        meetingId={meetingId || undefined}
        onCallEnd={() => setIsAudioCallOpen(false)}
      />
    </div>
  )
}

export default VideoSDKTest
