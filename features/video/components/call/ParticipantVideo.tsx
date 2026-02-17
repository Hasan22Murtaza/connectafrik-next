import React, { useEffect, useRef } from 'react';

const ParticipantVideo = React.memo(function ParticipantVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
});

export default ParticipantVideo;
