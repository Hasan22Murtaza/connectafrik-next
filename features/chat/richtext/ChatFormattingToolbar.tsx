"use client";

import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Smile,
  Strikethrough,
  Underline,
  Undo2,
  AtSign,
  Type,
} from "lucide-react";
import React from "react";
import type { FormatCommand } from "./markdown";

export interface ChatFormattingToolbarProps {
  onCommand: (cmd: FormatCommand) => void;
  onEmoji?: () => void;
  active?: Partial<Record<FormatCommand | "emoji", boolean>>;
  compact?: boolean;
  disabled?: boolean;
  showColor?: boolean;
  showHighlight?: boolean;
  className?: string;
}

type ToolItem = {
  id: FormatCommand | "emoji";
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  shortcut?: string;
};

const PRIMARY_TOOLS: ToolItem[] = [
  { id: "bold", label: "Bold", Icon: Bold, shortcut: "Ctrl+B" },
  { id: "italic", label: "Italic", Icon: Italic, shortcut: "Ctrl+I" },
  { id: "underline", label: "Underline", Icon: Underline, shortcut: "Ctrl+U" },
  { id: "strike", label: "Strikethrough", Icon: Strikethrough },
  { id: "code", label: "Inline code", Icon: Code, shortcut: "Ctrl+E" },
  { id: "link", label: "Link", Icon: Link2, shortcut: "Ctrl+K" },
  { id: "ul", label: "Bullet list", Icon: List },
  { id: "ol", label: "Numbered list", Icon: ListOrdered },
  { id: "quote", label: "Quote", Icon: Quote },
  { id: "mention", label: "Mention", Icon: AtSign },
  { id: "emoji", label: "Emoji", Icon: Smile },
];

const HISTORY_TOOLS: ToolItem[] = [
  { id: "undo", label: "Undo", Icon: Undo2, shortcut: "Ctrl+Z" },
  { id: "redo", label: "Redo", Icon: Redo2, shortcut: "Ctrl+Y" },
];

const ChatFormattingToolbar: React.FC<ChatFormattingToolbarProps> = ({
  onCommand,
  onEmoji,
  active = {},
  compact = false,
  disabled = false,
  showColor = false,
  showHighlight = true,
  className = "",
}) => {
  const btnBase =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:pointer-events-none disabled:opacity-40";
  const btnActive = "bg-[#00a884]/15 text-[#00a884]";

  const renderBtn = (item: ToolItem) => {
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
          // Keep selection in the editor
          e.preventDefault();
        }}
        onClick={() => {
          if (item.id === "emoji") {
            onEmoji?.();
            return;
          }
          onCommand(item.id);
        }}
      >
        <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
      </button>
    );
  };

  return (
    <div
      className={`chat-rt-toolbar flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl border border-border/70 bg-surface px-1 py-1 shadow-[0_4px_16px_rgba(11,20,26,0.1)] scrollbar-thin [-webkit-overflow-scrolling:touch] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] ${className}`}
      role="toolbar"
      aria-label="Formatting"
    >
      <div className="flex items-center gap-0.5">{PRIMARY_TOOLS.map(renderBtn)}</div>

      {showHighlight || showColor ? (
        <>
          <span className="mx-0.5 h-5 w-px shrink-0 bg-border-subtle" aria-hidden />
          {showHighlight ? (
            <button
              type="button"
              disabled={disabled}
              title="Highlight"
              aria-label="Highlight"
              className={`${btnBase} ${active.highlight ? btnActive : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onCommand("highlight")}
            >
              <Highlighter className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
          {showColor ? (
            <button
              type="button"
              disabled={disabled}
              title="Text color"
              aria-label="Text color"
              className={`${btnBase} ${active.color ? btnActive : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onCommand("color")}
            >
              <Type className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </>
      ) : null}

      <span className="mx-0.5 h-5 w-px shrink-0 bg-border-subtle" aria-hidden />
      <div className="flex items-center gap-0.5">{HISTORY_TOOLS.map(renderBtn)}</div>
    </div>
  );
};

export default ChatFormattingToolbar;
