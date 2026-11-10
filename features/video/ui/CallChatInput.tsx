import React from 'react';
import { Send } from '@/shared/icons';

interface CallChatInputProps {
  messageText: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onClose?: () => void;
  disabled?: boolean;
}

const CallChatInput: React.FC<CallChatInputProps> = ({
  messageText,
  onMessageChange,
  onSend,
  disabled = false,
}) => {
  const canSend = !disabled && messageText.trim().length > 0;

  return (
    <div className="call-chat-input">
      <label className="sr-only" htmlFor="call-chat-input">
        Type a message
      </label>
      <textarea
        id="call-chat-input"
        rows={1}
        value={messageText}
        disabled={disabled}
        onChange={(e) => onMessageChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        placeholder="Type a message"
        className="call-chat-input-field"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className="call-chat-send"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
};

export default CallChatInput;
