"use client";

import React from "react";
import type { ViewOnceKind } from "@/features/chat/viewOnce";
import { viewOnceBubbleLabel } from "@/features/chat/viewOnce";
import { Loader2 } from "@/shared/icons";

interface ViewOncePlaceholderProps {
  kind: ViewOnceKind;
  opened: boolean;
  isOwnMessage: boolean;
  disabled?: boolean;
  loading?: boolean;
  onOpen?: () => void;
}

const ViewOncePlaceholder: React.FC<ViewOncePlaceholderProps> = ({
  kind,
  opened,
  isOwnMessage,
  disabled = false,
  loading = false,
  onOpen,
}) => {
  const label = viewOnceBubbleLabel(kind, opened, isOwnMessage);
  const canOpen = !opened && !isOwnMessage && !disabled && Boolean(onOpen);

  return (
    <button
      type="button"
      disabled={!canOpen || loading}
      onClick={(e) => {
        e.stopPropagation();
        if (!canOpen) return;
        onOpen?.();
      }}
      className={`mb-1 flex min-w-[168px] max-w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-black/10 transition dark:ring-white/10 ${
        canOpen
          ? "bg-black/[0.08] hover:bg-black/[0.12] dark:bg-white/12 dark:hover:bg-white/18"
          : "bg-black/[0.06] dark:bg-white/10"
      } ${opened ? "opacity-70" : ""}`}
      aria-label={label}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
          opened
            ? "border-content-tertiary/70 text-content-tertiary"
            : "border-current text-content"
        }`}
        aria-hidden
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "1"}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug text-content">{label}</span>
        {!opened ? (
          <span className="mt-0.5 block text-[11px] text-content-tertiary">
            {isOwnMessage ? "Waiting for recipient" : kind === "video" ? "Video" : "Photo"}
          </span>
        ) : null}
      </span>
    </button>
  );
};

export default ViewOncePlaceholder;
