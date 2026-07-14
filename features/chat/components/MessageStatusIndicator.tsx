import React from "react";
import { Check, CheckCheck, Clock } from "lucide-react";

interface MessageStatusIndicatorProps {
  status: "sending" | "sent" | "delivered" | "read";
  isOwnMessage: boolean;
}

const MessageStatusIndicator: React.FC<MessageStatusIndicatorProps> = ({
  status,
  isOwnMessage,
}) => {
  if (!isOwnMessage) return null;

  const base = "h-[14px] w-[14px] shrink-0";

  switch (status) {
    case "sending":
      return (
        <Clock
          className={`${base} text-content-tertiary opacity-80`}
          strokeWidth={2}
          aria-label="Sending"
        />
      );
    case "sent":
      return (
        <Check
          className={`${base} text-content-tertiary`}
          strokeWidth={2.5}
          aria-label="Sent"
        />
      );
    case "delivered":
      return (
        <CheckCheck
          className={`${base} text-content-tertiary`}
          strokeWidth={2.25}
          aria-label="Delivered"
        />
      );
    case "read":
      return (
        <CheckCheck
          className={`${base} text-[#53bdeb]`}
          strokeWidth={2.25}
          aria-label="Read"
        />
      );
    default:
      return null;
  }
};

export default MessageStatusIndicator;
