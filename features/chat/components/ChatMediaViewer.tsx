"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

export interface ChatMediaViewerItem {
  id: string;
  url: string;
  name: string;
  type: "image" | "video";
  mimeType?: string;
}

interface ChatMediaViewerProps {
  items: ChatMediaViewerItem[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const ChatMediaViewer: React.FC<ChatMediaViewerProps> = ({
  items,
  initialIndex = 0,
  open,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (open) {
      setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1)));
      setScale(1);
    }
  }, [open, initialIndex, items.length]);

  const current = items[index];

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : items.length - 1));
    setScale(1);
  }, [items.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < items.length - 1 ? i + 1 : 0));
    setScale(1);
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  if (!open || !current) return null;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = current.url;
    a.download = current.name || "media";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: current.name,
          url: current.url,
        });
      } else {
        await navigator.clipboard.writeText(current.url);
      }
    } catch {
      /* user cancelled or share unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[11000] flex flex-col bg-black/95 animate-[chatFadeIn_180ms_ease-out] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <div className="flex shrink-0 items-center justify-between gap-1 px-2 py-2 text-white sm:gap-2 sm:px-5 sm:py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 sm:h-10 sm:w-10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 truncate px-1 text-center text-xs font-medium sm:text-sm">
          <span className="hidden truncate sm:inline">{current.name}</span>
          <span className="sm:hidden">
            {items.length > 1 ? `${index + 1} / ${items.length}` : "Media"}
          </span>
          {items.length > 1 ? (
            <span className="ml-2 hidden text-white/60 sm:inline">
              {index + 1}/{items.length}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {current.type === "image" ? (
            <>
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(1, s - 0.5))}
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 sm:flex sm:h-10 sm:w-10"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(4, s + 0.5))}
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 sm:flex sm:h-10 sm:w-10"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 sm:h-10 sm:w-10"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 sm:h-10 sm:w-10"
            aria-label="Download"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-1 sm:px-2">
        {items.length > 1 ? (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:left-4 sm:h-11 sm:w-11"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
          </button>
        ) : null}

        {current.type === "video" ? (
          <video
            key={current.id}
            src={current.url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl animate-[chatMediaIn_220ms_ease-out]"
          />
        ) : (
          <img
            key={current.id}
            src={current.url}
            alt={current.name}
            className="max-h-full max-w-full select-none object-contain transition-transform duration-200 ease-out animate-[chatMediaIn_220ms_ease-out] touch-pan-y"
            style={{ transform: `scale(${scale})` }}
            draggable={false}
          />
        )}

        {items.length > 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:right-4 sm:h-11 sm:w-11"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default ChatMediaViewer;
