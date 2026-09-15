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
    <div className="flex items-end gap-2">
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
        className="max-h-24 min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-surface-secondary px-3.5 py-2.5 text-sm text-content outline-none transition placeholder:text-content-tertiary focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white shadow-sm transition hover:bg-primary-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-content-tertiary disabled:shadow-none"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
};

export default CallChatInput;
