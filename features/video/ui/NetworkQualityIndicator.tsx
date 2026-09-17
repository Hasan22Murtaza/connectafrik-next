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
  /** Bar colors for a light/white surface instead of the dark tile chip. */
  tone?: 'onDark' | 'onLight';
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

function inkColor(quality: ConnectionQuality, tone: 'onDark' | 'onLight', filled: boolean): string {
  if (!filled) {
    return tone === 'onLight' ? 'rgb(15 23 42 / 0.18)' : 'rgb(255 255 255 / 0.28)';
  }
  switch (quality) {
    case 'fair':
      return '#f59e0b';
    case 'poor':
      return '#ef4444';
    case 'unknown':
      return tone === 'onLight' ? 'rgb(15 23 42 / 0.18)' : 'rgb(255 255 255 / 0.28)';
    default:
      return tone === 'onLight' ? '#16a34a' : '#ffffff';
  }
}

/**
 * Cellular-style 4-bar network quality glyph.
 */
const NetworkQualityIndicator = React.memo(function NetworkQualityIndicator({
  quality = 'unknown',
  size = 'sm',
  showLabel = false,
  embedded = false,
  tone = 'onDark',
  className = '',
}: NetworkQualityIndicatorProps) {
  const filled = filledBars(quality);
  const label = connectionQualityLabel(quality);
  const iconSize = size === 'md' ? 22 : 16;
  const barWidth = size === 'md' ? 3.4 : 2.6;
  const gap = size === 'md' ? 2.1 : 1.6;
  const radii = size === 'md' ? 1.2 : 0.9;
  const heights = size === 'md' ? [8, 11.5, 15, 18.5] : [6, 8.5, 11, 13.5];
  const vbH = size === 'md' ? 20 : 15;
  const vbW = barWidth * BAR_COUNT + gap * (BAR_COUNT - 1);

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      title={label}
      aria-label={label}
    >
      <span
        className={embedded ? 'inline-flex' : 'inline-flex rounded-md bg-black/55 px-1 py-0.5 backdrop-blur-sm'}
        aria-hidden
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox={`0 0 ${vbW} ${vbH}`}
          className="block overflow-visible"
        >
          {heights.map((h, i) => (
            <rect
              key={i}
              x={i * (barWidth + gap)}
              y={vbH - h}
              width={barWidth}
              height={h}
              rx={radii}
              fill={inkColor(quality, tone, i < filled)}
            />
          ))}
        </svg>
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
