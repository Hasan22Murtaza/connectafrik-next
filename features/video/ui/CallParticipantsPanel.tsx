'use client';

import React from 'react';
import { Activity, Copy, Mic, MicOff, UserPlus, X } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

export interface CallPanelParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  isHost?: boolean;
}

interface CallParticipantsPanelProps {
  participants: CallPanelParticipant[];
  onClose: () => void;
  onInvite: () => void;
}

const CallParticipantsPanel: React.FC<CallParticipantsPanelProps> = ({
  participants,
  onClose,
  onInvite,
}) => {
  const copyInviteLink = async () => {
    if (!navigator.clipboard?.writeText) {
      toast.error('Clipboard access is unavailable in this browser.');
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Call link copied.');
    } catch (error) {
      console.error('Could not copy call link:', error);
      toast.error('Could not copy the call link.');
    }
  };

  return (
    <aside id="call-people-panel" className="call-people-panel" aria-label="Call participants">
      <header className="call-people-header">
        <div>
          <h2>People</h2>
          <span>{participants.length} in this call</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close participants">
          <X size={19} />
        </button>
      </header>

      <div className="call-people-list">
        {participants.map((participant) => (
          <div className="call-person-row" key={participant.id}>
            <div className="call-person-avatar">
              {participant.avatarUrl ? (
                <Image src={participant.avatarUrl} alt="" width={40} height={40} unoptimized />
              ) : (
                <span>{participant.name.trim().charAt(0).toUpperCase() || '?'}</span>
              )}
              {participant.isSpeaking ? <i aria-label="Speaking" /> : null}
            </div>
            <div className="call-person-copy">
              <strong>{participant.name}{participant.isLocal ? ' (You)' : ''}</strong>
              <span>
                {participant.isHost ? 'Call host' : participant.isSpeaking ? 'Speaking now' : 'Participant'}
              </span>
            </div>
            {participant.isMuted ? (
              <MicOff className="call-person-mic muted" size={17} aria-label="Muted" />
            ) : participant.isSpeaking ? (
              <Activity className="call-person-mic speaking" size={17} aria-label="Speaking" />
            ) : (
              <Mic className="call-person-mic" size={17} aria-label="Microphone on" />
            )}
          </div>
        ))}
      </div>

      <footer className="call-people-actions">
        <button type="button" onClick={onInvite}>
          <UserPlus size={17} />
          Add people
        </button>
        <button type="button" onClick={() => void copyInviteLink()}>
          <Copy size={17} />
          Copy invite link
        </button>
      </footer>
    </aside>
  );
};

export default CallParticipantsPanel;
