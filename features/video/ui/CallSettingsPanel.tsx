'use client';

import React, { useEffect, useState } from 'react';
import { X } from '@/shared/icons';
import type { SpeakerLevel } from '@/features/video/core/types';

export interface CallDeviceOption {
  deviceId: string;
  label: string;
}

export interface CallSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  speakerLevel: SpeakerLevel;
  onSpeakerLevelChange: (level: SpeakerLevel) => void;
  audioInputs: CallDeviceOption[];
  audioOutputs: CallDeviceOption[];
  videoInputs: CallDeviceOption[];
  selectedAudioInputId?: string;
  selectedAudioOutputId?: string;
  selectedVideoInputId?: string;
  onSelectAudioInput?: (deviceId: string) => void;
  onSelectAudioOutput?: (deviceId: string) => void;
  onSelectVideoInput?: (deviceId: string) => void;
}

const SPEAKER_OPTIONS: { value: SpeakerLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'loud', label: 'Loud' },
];

function DeviceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: CallDeviceOption[];
  onChange?: (deviceId: string) => void;
}) {
  if (!onChange || options.length === 0) {
    return (
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/50">{label}</label>
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/40">
          {options.length === 0 ? 'No devices detected' : 'Unavailable'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/50">{label}</label>
      <select
        value={value || options[0]?.deviceId || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-primary-400/60"
      >
        {options.map((opt) => (
          <option key={opt.deviceId} value={opt.deviceId} className="bg-[#1a1a1a] text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const CallSettingsPanel: React.FC<CallSettingsPanelProps> = ({
  open,
  onClose,
  speakerLevel,
  onSpeakerLevelChange,
  audioInputs,
  audioOutputs,
  videoInputs,
  selectedAudioInputId,
  selectedAudioOutputId,
  selectedVideoInputId,
  onSelectAudioInput,
  onSelectAudioOutput,
  onSelectVideoInput,
}) => {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted && !open) return null;
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside
        className="absolute inset-x-0 bottom-0 z-50 mx-auto flex max-h-[min(72vh,32rem)] w-full max-w-md flex-col rounded-t-2xl border border-white/10 bg-[#121212] shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[340px] sm:max-w-[40vw] sm:rounded-none sm:border-l sm:border-t-0 animate-[slideLeft_280ms_ease-out]"
        aria-label="Call settings"
      >
        <header className="flex shrink-0 items-center justify-between px-4 py-3.5">
          <h2 className="text-sm font-semibold text-white">Call settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">Speaker volume</label>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {SPEAKER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSpeakerLevelChange(opt.value)}
                  className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                    speakerLevel === opt.value
                      ? 'bg-primary-500 text-white'
                      : 'text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <DeviceSelect
            label="Microphone"
            value={selectedAudioInputId}
            options={audioInputs}
            onChange={onSelectAudioInput}
          />
          <DeviceSelect
            label="Speaker"
            value={selectedAudioOutputId}
            options={audioOutputs}
            onChange={onSelectAudioOutput}
          />
          <DeviceSelect
            label="Camera"
            value={selectedVideoInputId}
            options={videoInputs}
            onChange={onSelectVideoInput}
          />
        </div>
      </aside>
    </>
  );
};

export default CallSettingsPanel;
