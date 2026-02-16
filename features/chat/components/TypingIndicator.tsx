"use client";

import React from "react";

interface TypingIndicatorProps {
  /** Whether someone is typing (true = show indicator) */
  isTyping: boolean;
}

/**
 * WhatsApp-style typing indicator — three animated dots + "typing..."
 */
const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping }) => {
  if (!isTyping) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 pb-1 pt-0.5 animate-fadeIn">
      {/* Animated dots bubble */}
      <div className="flex items-center gap-[3px] rounded-2xl bg-gray-100 px-3 py-1.5">
        <span className="typing-dot typing-dot-1" />
        <span className="typing-dot typing-dot-2" />
        <span className="typing-dot typing-dot-3" />
      </div>

      {/* Scoped keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .typing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #9ca3af;
          animation: typingBounce 1.4s infinite ease-in-out;
        }
        .typing-dot-1 { animation-delay: 0s; }
        .typing-dot-2 { animation-delay: 0.2s; }
        .typing-dot-3 { animation-delay: 0.4s; }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}} />
    </div>
  );
};

export default TypingIndicator;
