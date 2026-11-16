'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize } from '@/shared/icons';
import NetworkQualityIndicator from './NetworkQualityIndicator';
import type { ConnectionQuality } from '@/features/video/core/models';

export interface CallHeaderProps {
  title: string;
  callDuration: number;
  formatDuration: (seconds: number) => string;
  connectionQuality?: ConnectionQuality;
  endToEndEncrypted?: boolean;
  className?: string;
}

const CallHeader: React.FC<CallHeaderProps> = ({
  title,
  callDuration,
  formatDuration,
  connectionQuality = 'unknown',
  endToEndEncrypted = false,
  className = '',
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* fullscreen may be blocked by the browser */
    }
  }, []);

  const qualityGood =
    connectionQuality === 'excellent' || connectionQuality === 'good' || connectionQuality === 'unknown';

  return (
    <header
      className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 ${className}`}
    >
      <div className="pointer-events-auto min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight text-white sm:text-[15px]">
          {title}
        </h1>
        {endToEndEncrypted ? (
          <p className="truncate text-[10px] text-white/50 sm:text-[11px]">End-to-end encrypted</p>
        ) : null}
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md sm:px-3 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" aria-hidden />
          <span className="font-mono tabular-nums tracking-wide">{formatDuration(callDuration)}</span>
        </div>

        <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur-md sm:inline-flex sm:text-xs">
          <NetworkQualityIndicator quality={connectionQuality} size="sm" embedded tone="onDark" />
          <span className={qualityGood ? 'text-emerald-400' : 'text-amber-300'}>
            {qualityGood ? 'HD Audio' : connectionQuality === 'fair' ? 'Unstable' : 'Poor'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </header>
  );
};

export default CallHeader;
