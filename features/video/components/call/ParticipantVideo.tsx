import React, { useEffect, useRef } from 'react';

interface ParticipantVideoProps {
  stream: MediaStream;
  contain?: boolean;
  muted?: boolean;
  mirrored?: boolean;
}

const ParticipantVideo = React.memo(function ParticipantVideo({
  stream,
  contain,
  muted,
  mirrored,
}: ParticipantVideoProps) {
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
      muted={muted}
      className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
      style={{
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        transform: mirrored ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
      }}
    />
  );
});

export default ParticipantVideo;
