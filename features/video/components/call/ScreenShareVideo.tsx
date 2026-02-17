import React, { useEffect, useRef, useState } from 'react';

const ScreenShareVideo = React.memo(function ScreenShareVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(true);
      });
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full">
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400 animate-pulse">Loading screen share...</span>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-contain bg-black transition-opacity duration-500 ease-out ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
});

export default ScreenShareVideo;
