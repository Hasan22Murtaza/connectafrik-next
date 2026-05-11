import type React from "react";

/** Shared by `ChatWindow` header overflow and `MessageBubble` context menu. */
export type ChatHeaderOptionsMenuItem = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "danger";
  trailing?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
};

export type ChatHeaderOptionsMenuSection = {
  id: string;
  items: ChatHeaderOptionsMenuItem[];
};
