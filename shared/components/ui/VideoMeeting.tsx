import React, { useEffect, useState } from "react";
import {
  MeetingProvider,
  MeetingConsumer,
  useMeeting,
  useParticipant,
} from "@videosdk.live/react-sdk";

// -------------- Fetch token from Supabase Edge --------------
const fetchVideoSDKToken = async (roomId: string, userId: string): Promise<string> => {
  const res = await fetch(
    "https://jsggugavfanjrqdjsxbt.functions.supabase.co/generate-videosdk-token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, userId }),
    }
  );
  if (!res.ok) throw new Error("Failed to get token");
  const data = await res.json();
  return data.token;
};

// -------------- Participant Tile --------------
const ParticipantView = ({ participantId }: { participantId: string }) => {
  const { webcamStream, micStream, webcamOn, micOn, displayName } =
    useParticipant(participantId);

  return (
    <div className="border rounded p-2 bg-gray-100">
      <h4 className="font-semibold text-sm mb-1">{displayName || participantId}</h4>
      {webcamOn && webcamStream ? (
        <video
          ref={(ref) => {
            if (ref) {
              ref.srcObject = new MediaStream([webcamStream.track]);
              ref.play().catch(() => {});
            }
          }}
          autoPlay
          playsInline
          muted
          className="w-full rounded-md"
        />
      ) : (
        <p className="text-xs text-gray-500">Camera off</p>
      )}
      <p className="text-xs mt-1">
        Mic: {micOn ? "On 🎤" : "Off 🔇"}
      </p>
    </div>
  );
};

// -------------- Meeting Controls --------------
const Controls = () => {
  const { leave, toggleMic, toggleWebcam } = useMeeting();

  return (
    <div className="flex gap-4 mt-4 justify-center">
      <button onClick={() => toggleMic()} className="px-4 py-2 bg-yellow-500 text-white rounded">
        Toggle Mic
      </button>
      <button onClick={() => toggleWebcam()} className="px-4 py-2 bg-purple-600 text-white rounded">
        Toggle Webcam
      </button>
      <button onClick={() => leave()} className="px-4 py-2 bg-red-600 text-white rounded">
        Leave
      </button>
    </div>
  );
};

// -------------- Meeting Layout --------------
const MeetingView = () => (
  <MeetingConsumer>
    {(meeting: any) => (
      <div className="p-4">
        <h3 className="text-lg font-bold mb-3">Meeting Room: {meeting.meetingId}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[...meeting.participants.keys()].map((id) => (
            <ParticipantView key={id} participantId={id} />
          ))}
        </div>
        <Controls />
      </div>
    )}
  </MeetingConsumer>
);

// -------------- Main Component --------------
const VideoMeeting: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roomId = "room1";
  const userId = "user123";

  useEffect(() => {
    const getToken = async () => {
      try {
        const fetched = await fetchVideoSDKToken(roomId, userId);
        setToken(fetched);
      } catch (err: any) {
        setError(err.message);
      }
    };
    getToken();
  }, []);

  if (error) return <div>Error: {error}</div>;
  if (!token) return <div>Loading Video Meeting...</div>;

  return (
    <MeetingProvider
      token={token}
      config={{
        meetingId: roomId,
        name: userId,
        micEnabled: true,
        webcamEnabled: true,
        debugMode: true,
      }}
    >
      <MeetingView />
    </MeetingProvider>
  );
};

export default VideoMeeting;
