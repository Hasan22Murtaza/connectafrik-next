import React, { useEffect, useRef } from 'react';

const ParticipantVideo = React.memo(function ParticipantVideo({ stream, contain }: { stream: MediaStream; contain?: boolean }) {
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
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
      style={{ willChange: 'transform', backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
    />
  );
});

export default ParticipantVideo;
