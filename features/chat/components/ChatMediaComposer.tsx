"use client";

import {
  FileText,
  Plus,
  Send,
  Smile,
  X,
} from "@/shared/icons";
import {
  fileUploadService,
  type FileUploadResult,
} from "@/shared/services/fileUploadService";
import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

const ComposerEmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});

interface ChatMediaComposerProps {
  files: FileUploadResult[];
  caption: string;
  onCaptionChange: (value: string) => void;
  onTyping?: () => void;
  onClose: () => void;
  onRemove: (index: number) => void;
  onAddFiles: (files: FileUploadResult[]) => void;
  onSend: () => void;
  viewOnceAvailable?: boolean;
  viewOnceEnabled?: boolean;
  onViewOnceChange?: (enabled: boolean) => void;
  sending?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

function ToolButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
        active
          ? "bg-white text-[#111b21] shadow-sm dark:bg-surface dark:text-content"
          : "text-[#54656f] hover:bg-white/80 hover:text-[#111b21] dark:text-content-secondary dark:hover:bg-white/10 dark:hover:text-content"
      }`}
    >
      {children}
    </button>
  );
}

const ChatMediaComposer: React.FC<ChatMediaComposerProps> = ({
  files,
  caption,
  onCaptionChange,
  onTyping,
  onClose,
  onRemove,
  onAddFiles,
  onSend,
  viewOnceAvailable = false,
  viewOnceEnabled = false,
  onViewOnceChange,
  sending = false,
  disabled = false,
  compact = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const prevLenRef = useRef(files.length);

  const current = files[Math.min(activeIndex, Math.max(0, files.length - 1))];
  const previewSrc = current?.previewUrl || current?.url;

  useEffect(() => {
    if (files.length > prevLenRef.current) {
      setActiveIndex(files.length - 1);
    } else if (activeIndex >= files.length) {
      setActiveIndex(Math.max(0, files.length - 1));
    }
    prevLenRef.current = files.length;
  }, [files.length, activeIndex]);

  useEffect(() => {
    captionRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (emojiOpen) {
          setEmojiOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emojiOpen, onClose]);

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    const results = await fileUploadService.fromFiles(picked);
    if (results.length) onAddFiles(results);
  };

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled || sending) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) {
        const filesFromList = Array.from(e.clipboardData?.files ?? []).filter(
          (f) => f.type.startsWith("image/")
        );
        imageFiles.push(...filesFromList);
      }
      if (imageFiles.length === 0) return;
      e.preventDefault();
      try {
        const results = await fileUploadService.fromFiles(imageFiles);
        if (results.length) onAddFiles(results);
      } catch {
        toast.error("Could not add pasted images");
      }
    },
    [disabled, sending, onAddFiles]
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      onCaptionChange(`${caption}${emoji}`);
      onTyping?.();
      requestAnimationFrame(() => captionRef.current?.focus());
    },
    [caption, onCaptionChange, onTyping]
  );

  if (!current) return null;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#e9edef] animate-[chatFadeIn_180ms_ease-out] dark:bg-[#0b141a]"
      role="dialog"
      aria-modal="true"
      aria-label="Preview selected media"
    >
      <div className="flex shrink-0 items-center gap-0.5 px-1.5 py-1.5 sm:px-2">
        <ToolButton label="Close" onClick={onClose}>
          <X className="h-5 w-5" strokeWidth={1.75} />
        </ToolButton>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-2 sm:px-8">
        {current.type === "image" && previewSrc ? (
          <img
            src={previewSrc}
            alt={current.name}
            className="max-h-full max-w-full object-contain shadow-[0_8px_32px_rgba(11,20,26,0.18)]"
          />
        ) : current.type === "video" && previewSrc ? (
          <video
            src={previewSrc}
            controls
            className="max-h-full max-w-full bg-black shadow-[0_8px_32px_rgba(11,20,26,0.18)]"
          />
        ) : (
          <div className="flex max-w-[min(100%,280px)] flex-col items-center gap-3 rounded-2xl bg-white px-8 py-10 shadow-[0_8px_32px_rgba(11,20,26,0.12)] dark:bg-surface">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600">
              <FileText className="h-7 w-7" />
            </span>
            <p className="w-full truncate text-center text-sm font-medium text-[#111b21] dark:text-content">
              {current.name}
            </p>
            <p className="text-xs text-[#667781] dark:text-content-secondary">
              {(current.size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}
      </div>

      <div className="relative shrink-0 px-3 pb-2 pt-1 sm:px-6">
        {emojiOpen ? (
          <div className="absolute bottom-full left-3 z-[80] mb-2 overflow-hidden rounded-xl border border-[#e9edef] bg-white shadow-[0_8px_28px_rgba(11,20,26,0.18)] dark:border-border dark:bg-surface sm:left-6">
            <ComposerEmojiPicker
              onEmojiClick={(emojiData) => {
                insertEmoji(emojiData.emoji);
              }}
              width={Math.min(
                320,
                typeof window !== "undefined" ? window.innerWidth - 24 : 320
              )}
              height={compact ? 280 : 340}
              searchPlaceHolder="Search emoji"
              previewConfig={{ showPreview: false }}
            />
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <textarea
              ref={captionRef}
              value={caption}
              onChange={(e) => {
                onCaptionChange(e.target.value);
                onTyping?.();
              }}
              onPaste={(e) => void handlePaste(e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!disabled && !sending) onSend();
                }
              }}
              placeholder="Type a message"
              rows={1}
              disabled={disabled || sending}
              className="max-h-24 min-h-[44px] w-full resize-none rounded-[22px] border-0 bg-white py-3 pl-4 pr-11 text-[15px] text-[#111b21] shadow-[0_1px_2px_rgba(11,20,26,0.06)] placeholder:text-[#8696a0] focus:outline-none focus:ring-0 dark:bg-surface dark:text-content dark:placeholder:text-content-tertiary"
            />
            <button
              type="button"
              onClick={() => setEmojiOpen((open) => !open)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#54656f] hover:bg-[#f0f2f5] dark:text-content-secondary dark:hover:bg-surface-hover"
              aria-label="Emoji"
              aria-expanded={emojiOpen}
            >
              <Smile className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>

          {viewOnceAvailable ? (
            <button
              type="button"
              onClick={() => onViewOnceChange?.(!viewOnceEnabled)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                viewOnceEnabled
                  ? "bg-[#F97316] text-white shadow-sm"
                  : "bg-white text-[#54656f] shadow-[0_1px_2px_rgba(11,20,26,0.06)] hover:bg-[#f0f2f5] dark:bg-surface dark:text-content-secondary"
              }`}
              aria-pressed={viewOnceEnabled}
              aria-label={viewOnceEnabled ? "View once on" : "View once off"}
              title={viewOnceEnabled ? "View once on" : "View once"}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[12px] font-bold ${
                  viewOnceEnabled ? "border-white" : "border-current"
                }`}
              >
                1
              </span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative flex shrink-0 items-end gap-2 px-3 pb-3 pt-1 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto scrollbar-thin">
          {files.map((file, index) => {
            const src = file.previewUrl || file.url;
            const selected = index === activeIndex;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#d1d7db] ring-2 transition dark:bg-surface-secondary ${
                  selected
                    ? "ring-[#F97316]"
                    : "ring-transparent hover:ring-[#8696a0]/50"
                }`}
                aria-label={`Select ${file.name}`}
                aria-current={selected}
              >
                {file.type === "image" && src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : file.type === "video" && src ? (
                  <video src={src} className="h-full w-full object-cover" muted />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[#54656f]">
                    <FileText className="h-5 w-5" />
                  </span>
                )}
                {files.length > 1 ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove(index);
                      }
                    }}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-white"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => addInputRef.current?.click()}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#8696a0]/50 bg-transparent text-[#54656f] transition hover:bg-white/60 dark:text-content-secondary dark:hover:bg-white/10"
            aria-label="Add more"
            title="Add more"
          >
            <Plus className="h-6 w-6" strokeWidth={1.75} />
          </button>
          <input
            ref={addInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => void handleAddFiles(e)}
          />
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={disabled || sending}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-white shadow-lg transition hover:bg-[#ea580c] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-14"
          aria-label="Send"
        >
          {sending ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <Send className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatMediaComposer;
