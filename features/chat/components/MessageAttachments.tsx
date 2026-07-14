"use client";

import type { ChatAttachment } from "@/features/chat/services/supabaseMessagingService";
import {
  FileText,
  Headphones,
  MapPin,
  Pause,
  Play,
  UserRound,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMediaViewerItem } from "./ChatMediaViewer";
import {
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
}) => {
  if (!attachments.length) return null;

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
              {images.length > 4 && i === 3 ? (
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
            <button
              key={att.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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
          );
        }

        if (att.type === "video") {
          return (
            <VideoThumb key={att.id} att={att} onOpen={() => openMediaFor(att)} />
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
                isOwnMessage ? "chat-bubble-own-file" : "bg-surface-canvas"
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
                isOwnMessage ? "chat-bubble-own-file" : "bg-surface-canvas"
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
                isOwnMessage ? "chat-bubble-own-file" : "bg-surface-canvas"
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
                : "bg-surface-canvas hover:bg-surface-hover"
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${
                pdf ? "bg-red-500" : "bg-violet-500"
              }`}
            >
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-content">{att.name}</p>
              <p className="text-[11px] text-content-tertiary">
                {pdf ? "PDF · " : ""}
                {formatAttachmentSize(att.size)}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
};

export default MessageAttachments;
