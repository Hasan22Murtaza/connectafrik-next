"use client";

import type { ChatAttachment } from "@/features/chat/services/supabaseMessagingService";
import {
  FileText,
  Headphones,
  MapPin,
  Pause,
  Play,
  UserRound,
  X,
} from '@/shared/icons';
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMediaViewerItem } from "./ChatMediaViewer";
import {
  fileExtensionLabel,
  formatAttachmentSize,
  formatMediaDuration,
  isAudioAttachment,
  isGifAttachment,
  isPdfAttachment,
  isVoiceNoteAttachment,
} from "./messageMediaUtils";

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
  isOwnMessage: boolean;
  onOpenMedia?: (items: ChatMediaViewerItem[], index: number) => void;
  isUploading?: boolean;
  uploadProgressById?: Record<string, number>;
  onCancelUpload?: () => void;
}

function CircularUploadProgress({
  percent,
  onCancel,
  tone = "default",
}: {
  percent: number;
  onCancel?: () => void;
  tone?: "default" | "light";
}) {
  const size = 40;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  const colorClass = tone === "light" ? "text-white" : "text-content-secondary";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
      }}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}
      aria-label="Cancel upload"
    >
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="opacity-25"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-150"
        />
      </svg>
      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}

function UploadMediaOverlay({
  percent,
  onCancel,
}: {
  percent: number;
  onCancel?: () => void;
}) {
  return (
    <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
      <CircularUploadProgress percent={percent} onCancel={onCancel} tone="light" />
    </span>
  );
}

function WaveBars({ active }: { active?: boolean }) {
  const bars = useMemo(
    () => Array.from({ length: 28 }, (_, i) => 4 + ((i * 7) % 14)),
    []
  );
  return (
    <div className="flex h-8 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[2.5px] rounded-full bg-current opacity-70 ${
            active ? "chat-wave-bar" : ""
          }`}
          style={{
            height: `${h}px`,
            animationDelay: active ? `${(i % 8) * 60}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}

const VoiceNotePlayer: React.FC<{
  att: ChatAttachment;
  isOwnMessage: boolean;
}> = ({ att, isOwnMessage }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = new Audio(att.url);
    audioRef.current = audio;
    const onMeta = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrent(audio.currentTime || 0);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [att.url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <div
      className={`flex w-[min(100%,280px)] min-w-0 items-center gap-2.5 rounded-2xl px-2 py-1.5 ${
        isOwnMessage ? "chat-bubble-own-file" : "bg-surface-secondary/80"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition ${
          isOwnMessage ? "bg-[#128c7e] hover:bg-[#0e7368]" : "bg-primary-600 hover:bg-primary-700"
        }`}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1 text-content-secondary">
        <WaveBars active={playing} />
        <div className="mt-0.5 text-[11px] tabular-nums text-content-tertiary">
          {formatMediaDuration(playing || current > 0 ? current : duration)}
        </div>
      </div>
    </div>
  );
};

const VideoThumb: React.FC<{
  att: ChatAttachment;
  onOpen: () => void;
}> = ({ att, onOpen }) => {
  const [duration, setDuration] = useState<number | null>(null);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="group relative block w-full max-w-[min(100%,280px)] overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <video
        src={att.url}
        muted
        preload="metadata"
        className="max-h-52 w-full max-w-full rounded-xl object-cover bg-black/20 sm:max-h-64"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || null)}
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm">
          <Play className="h-6 w-6 fill-current ml-0.5" />
        </span>
      </span>
      {duration != null ? (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {formatMediaDuration(duration)}
        </span>
      ) : null}
    </button>
  );
};

const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
  isOwnMessage,
  onOpenMedia,
  isUploading = false,
  uploadProgressById,
  onCancelUpload,
}) => {
  if (!attachments.length) return null;

  const progressFor = (id: string) => uploadProgressById?.[id] ?? 0;

  const mediaItems: ChatMediaViewerItem[] = attachments
    .filter((a) => a.type === "image" || a.type === "video")
    .map((a) => ({
      id: a.id,
      url: a.url,
      name: a.name,
      type: a.type === "video" ? "video" : "image",
      mimeType: a.mimeType,
    }));

  const openMediaFor = (att: ChatAttachment) => {
    const idx = mediaItems.findIndex((m) => m.id === att.id);
    onOpenMedia?.(mediaItems, idx >= 0 ? idx : 0);
  };

  const images = attachments.filter((a) => a.type === "image");
  const multiImage = images.length > 1;

  return (
    <div className="mb-1 w-full max-w-[min(100%,280px)] space-y-2 sm:max-w-[min(100%,320px)]">
      {multiImage ? (
        <div
          className={`grid gap-0.5 overflow-hidden rounded-xl ${
            images.length === 2 ? "grid-cols-2" : images.length === 3 ? "grid-cols-2" : "grid-cols-2"
          }`}
        >
          {images.slice(0, 4).map((att, i) => (
            <button
              key={att.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isUploading) return;
                openMediaFor(att);
              }}
              className={`relative overflow-hidden bg-black/10 ${
                images.length === 3 && i === 0
                  ? "row-span-2 min-h-[120px] sm:min-h-[160px]"
                  : "min-h-[88px] sm:min-h-[100px]"
              }`}
            >
              <img
                src={att.url}
                alt={att.name}
                className={`h-full w-full object-cover transition duration-300 hover:opacity-90 ${
                  isGifAttachment(att) ? "" : "animate-[chatImgShine_1.2s_ease]"
                }`}
                loading="lazy"
              />
              {isUploading ? (
                <UploadMediaOverlay
                  percent={progressFor(att.id)}
                  onCancel={onCancelUpload}
                />
              ) : images.length > 4 && i === 3 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xl font-semibold text-white">
                  +{images.length - 4}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {attachments.map((att) => {
        if (att.type === "image" && multiImage) return null;

        if (att.type === "image") {
          const gif = isGifAttachment(att);
          return (
            <div key={att.id} className="relative max-w-full overflow-hidden rounded-xl">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isUploading) return;
                  openMediaFor(att);
                }}
                className={`block max-w-full overflow-hidden ${
                  gif ? "rounded-lg" : "rounded-xl"
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
              >
                <img
                  src={att.url}
                  alt={att.name}
                  className={`max-h-56 w-auto max-w-full cursor-pointer object-contain transition-opacity hover:opacity-95 sm:max-h-80 ${
                    gif ? "rounded-lg" : "rounded-xl"
                  }`}
                  loading="lazy"
                />
                {gif ? (
                  <span className="mt-0.5 inline-block rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    GIF
                  </span>
                ) : null}
              </button>
              {isUploading ? (
                <UploadMediaOverlay
                  percent={progressFor(att.id)}
                  onCancel={onCancelUpload}
                />
              ) : null}
            </div>
          );
        }

        if (att.type === "video") {
          return (
            <div key={att.id} className="relative max-w-full overflow-hidden rounded-xl">
              <VideoThumb
                att={att}
                onOpen={() => {
                  if (isUploading) return;
                  openMediaFor(att);
                }}
              />
              {isUploading ? (
                <UploadMediaOverlay
                  percent={progressFor(att.id)}
                  onCancel={onCancelUpload}
                />
              ) : null}
            </div>
          );
        }

        if (isVoiceNoteAttachment(att)) {
          return <VoiceNotePlayer key={att.id} att={att} isOwnMessage={isOwnMessage} />;
        }

        if (isAudioAttachment(att)) {
          return (
            <div
              key={att.id}
              className={`flex w-full min-w-0 items-center gap-2 rounded-xl p-2 ${
                isOwnMessage ? "chat-bubble-own-file" : ""
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-600">
                <Headphones className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-xs font-medium text-content">{att.name}</p>
                <audio
                  src={att.url}
                  controls
                  preload="metadata"
                  className="mt-1 h-8 w-full max-w-full"
                />
              </div>
            </div>
          );
        }

        if ((att.mimeType || "").includes("vcard") || att.name?.toLowerCase().endsWith(".vcf")) {
          return (
            <div
              key={att.id}
              className={`flex items-center gap-2.5 rounded-xl p-2.5 ${
                isOwnMessage ? "chat-bubble-own-file" : ""
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/15 text-sky-600">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-content truncate">{att.name.replace(/\.vcf$/i, "")}</p>
                <p className="text-[11px] text-content-tertiary">Contact card</p>
              </div>
            </div>
          );
        }

        if (
          (att.name || "").toLowerCase().includes("location") ||
          (att.mimeType || "").includes("geo")
        ) {
          return (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2.5 rounded-xl p-2.5 transition hover:opacity-90 ${
                isOwnMessage ? "chat-bubble-own-file" : ""
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <MapPin className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-content">Location</p>
                <p className="truncate text-[11px] text-content-tertiary">{att.name}</p>
              </div>
            </a>
          );
        }

        const pdf = isPdfAttachment(att);
        const ext = fileExtensionLabel(att.name, att.mimeType);
        const fileIcon = (
          <span
            className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-white ${
              pdf ? "bg-red-500" : ext === "ZIP" ? "bg-slate-600" : "bg-violet-500"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span className="mt-0.5 text-[8px] font-bold leading-none tracking-wide">
              {ext}
            </span>
          </span>
        );
        const fileMeta = (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-content">{att.name}</p>
            <p className="text-[11px] text-content-tertiary">
              {formatAttachmentSize(att.size)}
            </p>
          </div>
        );

        if (isUploading) {
          return (
            <div
              key={att.id}
              className={`overflow-hidden rounded-xl ${
                isOwnMessage ? "chat-bubble-own-file" : "bg-surface-secondary/80"
              }`}
            >
              <div className="flex items-center gap-2.5 p-2.5">
                {fileIcon}
                {fileMeta}
                <CircularUploadProgress
                  percent={progressFor(att.id)}
                  onCancel={onCancelUpload}
                />
              </div>
              <div className="border-t border-black/10 px-2.5 py-1.5 text-center text-[12px] text-content-tertiary dark:border-white/10">
                Uploading...
              </div>
            </div>
          );
        }

        return (
          <a
            key={att.id}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-2.5 rounded-xl p-2.5 transition-colors ${
              isOwnMessage
                ? "chat-bubble-own-file hover:opacity-95"
                : " hover:bg-surface-hover"
            }`}
          >
            {fileIcon}
            {fileMeta}
          </a>
        );
      })}
    </div>
  );
};

export default MessageAttachments;
