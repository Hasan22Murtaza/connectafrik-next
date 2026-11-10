'use client';

import React, { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import toast from 'react-hot-toast';

const CallFullscreenButton: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const toggleFullscreen = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const surface = event.currentTarget.closest('.call-experience');
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (surface?.requestFullscreen) {
        await surface.requestFullscreen();
      } else {
        toast.error('Full-screen mode is not supported in this browser.');
      }
    } catch (error) {
      console.error('Could not change call full-screen mode:', error);
      toast.error('Could not change full-screen mode.');
    }
  };

  return (
    <button
      type="button"
      className="call-fullscreen-button"
      onClick={(event) => void toggleFullscreen(event)}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      title={isFullscreen ? 'Exit full screen' : 'Full screen'}
    >
      {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
    </button>
  );
};

export default CallFullscreenButton;
