"use client";

import React from "react";

interface TypingIndicatorProps {
  /** Whether someone is typing (true = show indicator) */
  isTyping: boolean;
}

/**
 * WhatsApp-inspired typing indicator — three animated dots in a bubble
 */
const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping }) => {
  if (!isTyping) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-3 pb-1.5 pt-0.5 animate-[chatFadeIn_200ms_ease-out]"
      aria-live="polite"
      aria-label="Typing"
    >
      <div className="flex items-center gap-[4px] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ring-1 ring-black/[0.04] dark:bg-surface">
        <span className="chat-typing-dot chat-typing-dot-1" />
        <span className="chat-typing-dot chat-typing-dot-2" />
        <span className="chat-typing-dot chat-typing-dot-3" />
      </div>
    </div>
  );
};

export default TypingIndicator;
