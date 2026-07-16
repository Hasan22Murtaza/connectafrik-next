"use client";

import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import React from "react";
import type { FormatCommand } from "./markdown";

export interface ChatFormattingToolbarProps {
  onCommand: (cmd: FormatCommand) => void;
  active?: Partial<Record<FormatCommand, boolean>>;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

type ToolItem = {
  id: FormatCommand;
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  shortcut?: string;
};

const FORMAT_TOOLS: ToolItem[] = [
  { id: "bold", label: "Bold", Icon: Bold, shortcut: "Ctrl+B" },
  { id: "italic", label: "Italic", Icon: Italic, shortcut: "Ctrl+I" },
  { id: "strike", label: "Strikethrough", Icon: Strikethrough },
  { id: "code", label: "Inline code", Icon: Code, shortcut: "Ctrl+E" },
  { id: "ol", label: "Numbered list", Icon: ListOrdered },
  { id: "ul", label: "Bullet list", Icon: List },
  { id: "quote", label: "Quote", Icon: Quote },
];

const ChatFormattingToolbar: React.FC<ChatFormattingToolbarProps> = ({
  onCommand,
  active = {},
  compact = false,
  disabled = false,
  className = "",
}) => {
  const btnBase =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:pointer-events-none disabled:opacity-40";
  const btnActive = "bg-[#00a884]/15 text-[#00a884]";

  return (
    <div
      className={`chat-rt-toolbar flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl border border-border/70 bg-surface px-1 py-1 shadow-[0_4px_16px_rgba(11,20,26,0.1)] scrollbar-thin [-webkit-overflow-scrolling:touch] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] ${className}`}
      role="toolbar"
      aria-label="Formatting"
    >
      {FORMAT_TOOLS.map((item) => {
        const Icon = item.Icon;
        const isActive = Boolean(active[item.id]);
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            aria-label={item.label}
            aria-pressed={isActive}
            className={`${btnBase} ${isActive ? btnActive : ""} ${compact ? "h-7 w-7" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => onCommand(item.id)}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
};

export default ChatFormattingToolbar;
