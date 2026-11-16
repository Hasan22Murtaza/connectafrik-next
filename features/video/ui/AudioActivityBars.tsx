'use client';

import React from 'react';

interface AudioActivityBarsProps {
  active?: boolean;
  className?: string;
  /** Slightly larger bars for sidebar rows. */
  size?: 'sm' | 'md';
}

/** Compact 3-bar audio activity glyph used on tiles and people list. */
const AudioActivityBars = React.memo(function AudioActivityBars({
  active = false,
  className = '',
  size = 'sm',
}: AudioActivityBarsProps) {
  const h = size === 'md' ? 'h-3.5' : 'h-3';
  const gap = size === 'md' ? 'gap-[2.5px]' : 'gap-[2px]';
  const bar = size === 'md' ? 'w-[2.5px]' : 'w-[2px]';

  return (
    <span
      className={`inline-flex items-end ${h} ${gap} ${className}`}
      aria-hidden
      data-active={active ? 'true' : 'false'}
    >
      <span
        className={`${bar} rounded-full bg-current origin-bottom ${
          active ? 'call-audio-bar call-audio-bar-1 opacity-100' : 'h-[35%] opacity-50'
        }`}
      />
      <span
        className={`${bar} rounded-full bg-current origin-bottom ${
          active ? 'call-audio-bar call-audio-bar-2 opacity-100' : 'h-[60%] opacity-50'
        }`}
      />
      <span
        className={`${bar} rounded-full bg-current origin-bottom ${
          active ? 'call-audio-bar call-audio-bar-3 opacity-100' : 'h-[45%] opacity-50'
        }`}
      />
    </span>
  );
});

export default AudioActivityBars;
