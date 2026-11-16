'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CallDeviceOption } from '@/features/video/ui/CallSettingsPanel';

function toOption(device: MediaDeviceInfo, fallbackLabel: string): CallDeviceOption {
  return {
    deviceId: device.deviceId,
    label: device.label || fallbackLabel,
  };
}

/**
 * Enumerates audio/video devices for the in-call settings panel.
 * Labels appear after media permission has been granted.
 */
export function useCallMediaDevices(enabled: boolean) {
  const [audioInputs, setAudioInputs] = useState<CallDeviceOption[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<CallDeviceOption[]>([]);
  const [videoInputs, setVideoInputs] = useState<CallDeviceOption[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string>('');
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string>('');
  const [selectedVideoInputId, setSelectedVideoInputId] = useState<string>('');

  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => toOption(d, `Microphone ${i + 1}`));
      const speakers = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d, i) => toOption(d, `Speaker ${i + 1}`));
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => toOption(d, `Camera ${i + 1}`));
      setAudioInputs(mics);
      setAudioOutputs(speakers);
      setVideoInputs(cams);
      setSelectedAudioInputId((prev) => prev || mics[0]?.deviceId || '');
      setSelectedAudioOutputId((prev) => prev || speakers[0]?.deviceId || '');
      setSelectedVideoInputId((prev) => prev || cams[0]?.deviceId || '');
    } catch {
      /* ignore enumeration errors */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => void refresh();
    md.addEventListener('devicechange', onChange);
    return () => md.removeEventListener('devicechange', onChange);
  }, [enabled, refresh]);

  return {
    audioInputs,
    audioOutputs,
    videoInputs,
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId,
    setSelectedAudioInputId,
    setSelectedAudioOutputId,
    setSelectedVideoInputId,
    refresh,
  };
}
