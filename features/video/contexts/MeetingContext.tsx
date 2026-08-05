'use client';

import React, { createContext, useContext } from 'react';
import type { CallMediaProviderAdapter } from '../core/interfaces/CallMediaProvider';
import type { CallMediaProviderName } from '@/lib/call-media/types';

export interface MeetingContextValue {
  adapter: CallMediaProviderAdapter | null;
  providerName: CallMediaProviderName | null;
  isReady: boolean;
}

const MeetingContext = createContext<MeetingContextValue>({
  adapter: null,
  providerName: null,
  isReady: false,
});

export function MeetingProvider({
  value,
  children,
}: {
  value: MeetingContextValue;
  children: React.ReactNode;
}) {
  return (
    <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>
  );
}

export function useMeetingAdapter(): CallMediaProviderAdapter {
  const { adapter, isReady } = useContext(MeetingContext);
  if (!isReady || !adapter) {
    throw new Error('useMeetingAdapter must be used within an active meeting provider');
  }
  return adapter;
}

export function useMeetingContext(): MeetingContextValue {
  return useContext(MeetingContext);
}

export function useOptionalMeetingAdapter(): CallMediaProviderAdapter | null {
  return useContext(MeetingContext).adapter;
}
