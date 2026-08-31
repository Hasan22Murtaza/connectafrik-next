import React from "react";
import { Check, CheckCheck, Clock } from '@/shared/icons';

interface MessageStatusIndicatorProps {
  status: "sending" | "sent" | "delivered" | "read";
  isOwnMessage: boolean;
  light?: boolean;
}

const MessageStatusIndicator: React.FC<MessageStatusIndicatorProps> = ({
  status,
  isOwnMessage,
  light = false,
}) => {
  if (!isOwnMessage) return null;

  const base = "h-[14px] w-[14px] shrink-0";
  const muted = light ? "text-white/90" : "text-content-tertiary";

  switch (status) {
    case "sending":
      return (
        <Clock
          className={`${base} ${muted} opacity-80`}
          strokeWidth={2}
          aria-label="Sending"
        />
      );
    case "sent":
      return (
        <Check
          className={`${base} ${muted}`}
          strokeWidth={2.5}
          aria-label="Sent"
        />
      );
    case "delivered":
      return (
        <CheckCheck
          className={`${base} ${muted}`}
          strokeWidth={2.25}
          aria-label="Delivered"
        />
      );
    case "read":
      return (
        <CheckCheck
          className={`${base} ${light ? "text-[#53bdeb]" : "text-[#53bdeb]"}`}
          strokeWidth={2.25}
          aria-label="Read"
        />
      );
    default:
      return null;
  }
};

export default MessageStatusIndicator;
