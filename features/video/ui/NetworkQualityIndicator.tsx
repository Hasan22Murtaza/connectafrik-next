'use client';

import React from 'react';
import type { ConnectionQuality } from '@/features/video/core/models';
import { connectionQualityLabel } from '@/features/video/core/utils/connectionQuality';

export interface NetworkQualityIndicatorProps {
  quality?: ConnectionQuality;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  /** Skip the extra dark pill — use inside an already-tinted chip. */
  embedded?: boolean;
  className?: string;
}

const BAR_COUNT = 4;

function filledBars(quality: ConnectionQuality): number {
  switch (quality) {
    case 'excellent':
      return 4;
    case 'good':
      return 3;
    case 'fair':
      return 2;
    case 'poor':
      return 1;
    default:
      return 0;
  }
}

function barColor(quality: ConnectionQuality): string {
  switch (quality) {
    case 'fair':
      return 'bg-amber-400';
    case 'poor':
      return 'bg-red-400';
    case 'unknown':
      return 'bg-white/30';
    default:
      return 'bg-white';
  }
}

/**
 * Microsoft Teams-style 4-bar network quality glyph.
 */
const NetworkQualityIndicator = React.memo(function NetworkQualityIndicator({
  quality = 'unknown',
  size = 'sm',
  showLabel = false,
  embedded = false,
  className = '',
}: NetworkQualityIndicatorProps) {
  const filled = filledBars(quality);
  const color = barColor(quality);
  const label = connectionQualityLabel(quality);
  const heights = size === 'md' ? [4, 7, 10, 13] : [3, 5, 7, 9];
  const width = size === 'md' ? 'w-[3px]' : 'w-[2.5px]';

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      title={label}
      aria-label={label}
    >
      <span
        className={`inline-flex items-end gap-px ${
          embedded ? '' : 'rounded-sm bg-black/55 px-1 py-0.5 backdrop-blur-sm'
        }`}
        aria-hidden
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            className={`block rounded-[1px] ${width} ${i < filled ? color : 'bg-white/25'}`}
            style={{ height: heights[i] }}
          />
        ))}
      </span>
      {showLabel && quality !== 'excellent' && quality !== 'unknown' ? (
        <span
          className={`text-[10px] font-medium leading-none ${
            quality === 'poor' ? 'text-red-300' : quality === 'fair' ? 'text-amber-300' : 'text-white/80'
          }`}
        >
          {quality === 'poor' ? 'Poor' : quality === 'fair' ? 'Unstable' : 'Good'}
        </span>
      ) : null}
    </div>
  );
});

export default NetworkQualityIndicator;
