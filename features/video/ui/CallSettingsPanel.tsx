'use client';

import React, { useEffect, useState } from 'react';
import { Settings, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SpeakerLevel } from '@/features/video/core/types';

type InputDeviceKind = 'audioinput' | 'videoinput';
type CallDevice = Pick<MediaDeviceInfo, 'deviceId' | 'label'>;

interface CallSettingsPanelProps {
  onClose: () => void;
  onSelectInput: (kind: InputDeviceKind, deviceId: string) => void | Promise<void>;
  speakerLevel: SpeakerLevel;
  onToggleSpeaker: () => void;
}

const CallSettingsPanel: React.FC<CallSettingsPanelProps> = ({
  onClose,
  onSelectInput,
  speakerLevel,
  onToggleSpeaker,
}) => {
  const [microphones, setMicrophones] = useState<CallDevice[]>([]);
  const [cameras, setCameras] = useState<CallDevice[]>([]);
  const [speakers, setSpeakers] = useState<CallDevice[]>([]);
  const [microphoneId, setMicrophoneId] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [speakerId, setSpeakerId] = useState('');

  useEffect(() => {
    let active = true;
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        const toDevice = ({ deviceId, label }: MediaDeviceInfo) => ({
          deviceId,
          label: label || 'Unnamed device',
        });
        setMicrophones(devices.filter((device) => device.kind === 'audioinput').map(toDevice));
        setCameras(devices.filter((device) => device.kind === 'videoinput').map(toDevice));
        setSpeakers(devices.filter((device) => device.kind === 'audiooutput').map(toDevice));
      } catch (error) {
        console.error('Could not enumerate call devices:', error);
        toast.error('Could not load your call devices.');
      }
    };
    void loadDevices();
    return () => {
      active = false;
    };
  }, []);

  const selectInput = async (kind: InputDeviceKind, deviceId: string) => {
    try {
      await onSelectInput(kind, deviceId);
      if (kind === 'audioinput') setMicrophoneId(deviceId);
      else setCameraId(deviceId);
    } catch (error) {
      console.error(`Could not switch ${kind}:`, error);
      toast.error('Could not switch to that device.');
    }
  };

  const selectSpeaker = async (deviceId: string) => {
    const audioElements = Array.from(document.querySelectorAll('audio'));
    const settable = audioElements.filter((audio) => typeof audio.setSinkId === 'function');
    if (deviceId && settable.length === 0) {
      toast.error('Speaker selection is not supported in this browser.');
      return;
    }
    try {
      await Promise.all(settable.map((audio) => audio.setSinkId(deviceId)));
      setSpeakerId(deviceId);
    } catch (error) {
      console.error('Could not switch call speaker:', error);
      toast.error('Could not switch to that speaker.');
    }
  };

  const deviceSelect = (
    label: string,
    value: string,
    devices: CallDevice[],
    onChange: (deviceId: string) => void,
  ) => (
    <label className="call-setting-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">System default</option>
        {devices.map((device, index) => (
          <option key={device.deviceId || `${label}-${index}`} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <aside id="call-settings-panel" className="call-settings-panel" aria-label="Call settings">
      <header className="call-people-header">
        <div className="call-settings-heading">
          <Settings size={17} />
          <h2>Call settings</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close call settings">
          <X size={19} />
        </button>
      </header>
      <div className="call-settings-content">
        {deviceSelect('Microphone', microphoneId, microphones, (id) => void selectInput('audioinput', id))}
        {deviceSelect('Speaker', speakerId, speakers, (id) => void selectSpeaker(id))}
        {deviceSelect('Camera', cameraId, cameras, (id) => void selectInput('videoinput', id))}
        <div className="call-settings-note call-settings-volume">
          <div>
            <strong>Speaker volume</strong>
            <span>Current level: {speakerLevel}</span>
          </div>
          <button type="button" onClick={onToggleSpeaker}>Change</button>
        </div>
        <div className="call-settings-note">
          <strong>Noise cancellation</strong>
          <span>Managed by your device and browser</span>
        </div>
        <div className="call-settings-note">
          <strong>Connection quality</strong>
          <span>Automatically adjusted to your network</span>
        </div>
      </div>
    </aside>
  );
};

export default CallSettingsPanel;
