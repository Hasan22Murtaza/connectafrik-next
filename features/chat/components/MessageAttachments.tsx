"use client";

import type { ChatAttachment } from "@/features/chat/services/supabaseMessagingService";
import {
  FileText,
  Headphones,
  Mic,
  MapPin,
  Pause,
  Play,
  UserRound,
  X,
} from '@/shared/icons';
import { format } from "date-fns";
import React, { useEffect, useMemo, useRef, useState } from "react";
import MessageStatusIndicator from "@/features/chat/components/MessageStatusIndicator";
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
  profileImageUrl?: string;
  onOpenMedia?: (items: ChatMediaViewerItem[], index: number) => void;
  isUploading?: boolean;
  uploadProgressById?: Record<string, number>;
  onCancelUpload?: () => void;
  messageMetadata?: {
    createdAt: string;
    status: "sending" | "sent" | "delivered" | "read";
  };
}

function CircularUploadProgress({
  percent,
  onCancel,
  size = 48,
}: {
  percent: number;
  onCancel?: () => void;
  size?: number;
}) {
  const stroke = 2.75;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  const pending = clamped < 2;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
      }}
      className="relative flex shrink-0 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_1px_4px_rgba(0,0,0,0.28)]"
      style={{ width: size, height: size }}
      aria-label="Cancel upload"
    >
      <span className={pending ? "absolute inset-0 animate-spin" : "absolute inset-0"}>
        <svg
          className="-rotate-90"
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
            className="opacity-30"
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
            strokeDashoffset={pending ? circumference * 0.72 : offset}
            className="transition-[stroke-dashoffset] duration-150"
          />
        </svg>
      </span>
      <X className="relative h-4 w-4" strokeWidth={2.6} />
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
    <span className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-black/45">
      <CircularUploadProgress percent={percent} onCancel={onCancel} size={52} />
    </span>
  );
}

function saveAttachment(att: ChatAttachment) {
  const a = document.createElement("a");
  a.href = att.url;
  a.download = att.name || "file";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openAttachment(att: ChatAttachment) {
  window.open(att.url, "_blank", "noopener,noreferrer");
}

let activeAudio: HTMLMediaElement | null = null;

function handleAudioPlay(audio: HTMLMediaElement) {
  if (activeAudio && activeAudio !== audio) {
    activeAudio.pause();
  }
  activeAudio = audio;
}

function handleAudioPause(audio: HTMLMediaElement) {
  if (activeAudio === audio) {
    activeAudio = null;
  }
}

function WaveBars({
  progress,
  current,
  duration,
  onSeek,
  onStart,
}: {
  progress: number;
  current: number;
  duration: number;
  onSeek: (progress: number) => void;
  onStart: () => void;
}) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const bars = useMemo(
    () =>
      Array.from(
        { length: 32 },
        (_, i) => 4 + Math.round(Math.abs(Math.sin(i * 2.17 + 0.6) * Math.cos(i * 0.7)) * 14)
      ),
    []
  );
  return (
    <div
      className="relative flex h-8 min-w-0 flex-1 items-center gap-[2px] overflow-hidden "
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className={`pointer-events-none min-w-0 flex-1 rounded-full ${
            (i + 0.5) / bars.length <= clampedProgress
              ? "bg-orange-500"
              : "bg-current opacity-60"
          }`}
          style={{ height: `${h}px` }}
        />
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 z-20 h-2.5 w-2.5 rounded-full border border-white bg-orange-500 shadow-sm"
        style={{
          left: `${clampedProgress * 100}%`,
          transform:
            clampedProgress === 0
              ? "translateY(-50%)"
              : clampedProgress === 1
                ? "translate(-100%, -50%)"
                : "translate(-50%, -50%)",
        }}
      />
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={clampedProgress * 100}
        aria-label="Voice message position"
        aria-valuetext={`${formatMediaDuration(current)} of ${formatMediaDuration(duration)}`}
        onChange={(event) => {
          onSeek(Number(event.currentTarget.value) / 100);
          onStart();
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => {
          event.stopPropagation();
          onStart();
        }}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
            event.stopPropagation();
            onStart();
          }
        }}
        className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed !border-none focus:outline-none"
      />
    </div>
  );
}

const VoiceNotePlayer: React.FC<{
  att: ChatAttachment;
  isOwnMessage: boolean;
  profileImageUrl?: string;
  messageMetadata?: MessageAttachmentsProps["messageMetadata"];
}> = ({ att, isOwnMessage, profileImageUrl, messageMetadata }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(att.durationSeconds ?? 0);
  const [current, setCurrent] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pendingSeekProgress, setPendingSeekProgress] = useState<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
   useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    let progressFrame: number | null = null;
    let lastProgressUpdate = 0;
    // true while we force the browser to calculate the real duration
    let fixingDuration = false;

    const updateProgress = (timestamp: number) => {
      if (timestamp - lastProgressUpdate >= 100) {
        setCurrent(audio.currentTime || 0);
        lastProgressUpdate = timestamp;
      }
      if (!audio.paused && !audio.ended) {
        progressFrame = requestAnimationFrame(updateProgress);
      }
    };
    const stopProgressUpdates = () => {
      if (progressFrame !== null) {
        cancelAnimationFrame(progressFrame);
        progressFrame = null;
      }
    };

    const applyPendingSeek = (nextDuration: number) => {
      if (nextDuration > 0 && pendingSeekRef.current !== null) {
        const nextTime = pendingSeekRef.current * nextDuration;
        pendingSeekRef.current = null;
        setPendingSeekProgress(null);
        audio.currentTime = nextTime;
        setCurrent(nextTime);
      }
    };

    const updateDuration = () => {
      // MediaRecorder files (webm/ogg) report Infinity on first load.
      // Seeking far past the end makes the browser calculate the real duration.
      if (audio.duration === Infinity) {
        if (!fixingDuration) {
          fixingDuration = true;
          audio.currentTime = 1e101;
        }
        const fallback = att.durationSeconds ?? 0;
        if (fallback > 0) setDuration(fallback);
        return;
      }

      // Real duration was just resolved: go back to the start
      if (fixingDuration && Number.isFinite(audio.duration)) {
        fixingDuration = false;
        audio.currentTime = 0;
        setCurrent(0);
      }

      const nextDuration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : att.durationSeconds ?? 0;
      setDuration(nextDuration);
      applyPendingSeek(nextDuration);
    };

    const onTime = () => {
      if (fixingDuration) {
        // ignore the bogus huge currentTime used for the duration fix
        if (Number.isFinite(audio.duration)) updateDuration();
        return;
      }
      setCurrent(audio.currentTime || 0);
      updateDuration();
    };
    const onPlay = () => {
      handleAudioPlay(audio);
      setPlaying(true);
      stopProgressUpdates();
      progressFrame = requestAnimationFrame(updateProgress);
    };
    const onPause = () => {
      handleAudioPause(audio);
      setPlaying(false);
      stopProgressUpdates();
    };
    const onEnd = () => {
      if (fixingDuration) return;
      handleAudioPause(audio);
      pendingSeekRef.current = null;
      setPendingSeekProgress(null);
      setPlaying(false);
      setCurrent(0);
      stopProgressUpdates();
    };
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("progress", updateDuration);
    audio.addEventListener("canplay", updateDuration);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("seeked", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    audio.src = att.url;
    audio.load();
    return () => {
      stopProgressUpdates();
      audio.pause();
      handleAudioPause(audio);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("progress", updateDuration);
      audio.removeEventListener("canplay", updateDuration);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("seeked", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [att.durationSeconds, att.url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play().catch(() => setPlaying(false));
    }
  };

  const seek = (progress: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(progress)) return;
    const clampedProgress = Math.min(1, Math.max(0, progress));
    const audioDuration =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : duration;
    if (audioDuration <= 0) {
      pendingSeekRef.current = clampedProgress;
      setPendingSeekProgress(clampedProgress);
      return;
    }
    pendingSeekRef.current = null;
    setPendingSeekProgress(null);
    const nextTime = clampedProgress * audioDuration;
    audio.currentTime = nextTime;
    setCurrent(nextTime);
  };

  const startPlayback = () => {
    const audio = audioRef.current;
    if (!audio || !audio.paused) return;
    void audio.play().catch(() => setPlaying(false));
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  };

    const progressValue =
    duration > 0
      ? Math.min(1, Math.max(0, current / duration))
      : pendingSeekProgress ?? 0;

  return (
    <div
      className={`w-[250px] max-w-full min-w-0 rounded-2xl  py-0.5 text-[#667085] shadow-[0_1px_2px_rgba(11,20,26,0.08)] dark:text-content-secondary ${
        isOwnMessage
          ? "bg-[#fff3e9] dark:bg-[var(--chat-bubble-own-file)]"
          : "bg-white dark:bg-surface-secondary"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600"
          aria-label={playing ? "Pause voice note" : "Play voice note"}
        >
          {playing ? (
            <Pause className="h-[18px] w-[18px] fill-current" />
          ) : (
            <Play className="ml-0.5 h-[18px] w-[18px] fill-current" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex h-9 min-w-0 flex-col justify-center text-[#9ca3af] dark:text-content-tertiary">
            <WaveBars
              progress={progressValue}
              current={current}
              duration={duration}
              onSeek={seek}
              onStart={startPlayback}
            />
            <div className="flex items-center justify-between gap-2 text-[11px] leading-none">
              <span className="shrink-0 tabular-nums">
                {formatMediaDuration(playing || current > 0 ? current : duration)}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  cyclePlaybackRate();
                }}
                className="shrink-0 rounded px-1 py-0.5 font-medium text-content-secondary transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:bg-white/10"
                aria-label={`Playback speed ${playbackRate}x. Change playback speed`}
                title="Change playback speed"
              >
                {playbackRate}x
              </button>
              {messageMetadata ? (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="tabular-nums">
                    {format(new Date(messageMetadata.createdAt), "h:mm a")}
                  </span>
                  <MessageStatusIndicator
                    status={messageMetadata.status}
                    isOwnMessage={isOwnMessage}
                  />
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10">
              <UserRound className="h-4 w-4" aria-hidden />
            </span>
          )}
          <span
            className={`absolute -bottom-0.5 -left-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 bg-blue-500 text-white ${
              isOwnMessage ? "border-[#fff3e9] dark:border-[#3b2a22]" : "border-white dark:border-surface-secondary"
            }`}
          >
            <Mic className="h-[10px] w-[10px]" aria-hidden />
          </span>
        </span>
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
      className="group relative block w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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

const AudioAttachmentPlayer: React.FC<{ url: string }> = ({ url }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    return () => {
      audio.pause();
      handleAudioPause(audio);
    };
  }, [url]);

  return (
    <audio
      ref={audioRef}
      src={url}
      controls
      preload="metadata"
      className="mt-1 h-8 w-full max-w-full"
      onPlay={(event) => handleAudioPlay(event.currentTarget)}
      onPause={(event) => handleAudioPause(event.currentTarget)}
      onEnded={(event) => handleAudioPause(event.currentTarget)}
    />
  );
};

const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
  isOwnMessage,
  profileImageUrl,
  onOpenMedia,
  isUploading = false,
  uploadProgressById,
  onCancelUpload,
  messageMetadata,
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
  const onlyVisualMedia = attachments.every(
    (a) => a.type === "image" || a.type === "video"
  );

  return (
    <div
      className={
        onlyVisualMedia
          ? "mb-0.5 max-w-full space-y-2"
          : "mb-0.5  max-w-full space-y-2"
      }
    >
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
              {att.url ? (
                <img
                  src={att.url}
                  alt={att.name}
                  className={`h-full w-full object-cover transition duration-300 hover:opacity-90 ${
                    isGifAttachment(att) ? "" : "animate-[chatImgShine_1.2s_ease]"
                  }`}
                  loading="lazy"
                />
              ) : (
                <span className="flex h-full min-h-[88px] items-center justify-center text-xs text-content-tertiary">
                  Photo
                </span>
              )}
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
          if (!att.url) {
            return (
              <div
                key={att.id}
                className="flex h-36 w-52 items-center justify-center rounded-xl bg-black/10 text-xs text-content-tertiary"
              >
                Photo
              </div>
            );
          }
          return (
            <div key={att.id} className="relative min-w-28 inline-block max-w-full overflow-hidden rounded-xl">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isUploading) return;
                  openMediaFor(att);
                }}
                className={`inline-flex max-w-full flex-col overflow-hidden ${
                  gif ? "rounded-lg" : "rounded-xl"
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
              >
                <img
                  src={att.url}
                  alt={att.name}
                  className={`block max-h-56 w-auto max-w-full cursor-pointer object-contain transition-opacity hover:opacity-95 sm:max-h-80 ${
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
          if (!att.url) {
            return (
              <div
                key={att.id}
                className="flex h-36 w-52 items-center justify-center rounded-xl bg-black/10 text-xs text-content-tertiary"
              >
                Video
              </div>
            );
          }
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
          if (!att.url) {
            return (
              <div
                key={att.id}
                className="flex h-14 w-[min(100%,295px)] items-center rounded-2xl bg-black/10 px-3 text-xs text-content-tertiary"
              >
                Voice message
              </div>
            );
          }
          return (
            <div key={att.id} className="relative overflow-hidden rounded-2xl">
              <VoiceNotePlayer
                att={att}
                isOwnMessage={isOwnMessage}
                profileImageUrl={profileImageUrl}
                messageMetadata={messageMetadata}
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

        if (isAudioAttachment(att)) {
          return (
            <div
              key={att.id}
              className={`relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl p-2 ${
                isOwnMessage ? "chat-bubble-own-file" : ""
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-600">
                <Headphones className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-xs font-medium text-content">{att.name}</p>
                {att.url ? (
                  <AudioAttachmentPlayer url={att.url} />
                ) : (
                  <p className="mt-1 text-[11px] text-content-tertiary">Loading audio…</p>
                )}
              </div>
              {isUploading ? (
                <UploadMediaOverlay
                  percent={progressFor(att.id)}
                  onCancel={onCancelUpload}
                />
              ) : null}
            </div>
          );
        }

        if ((att.mimeType || "").includes("vcard") || att.name?.toLowerCase().endsWith(".vcf")) {
          return (
            <div
              key={att.id}
              className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl p-2.5 ${
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
              {isUploading ? (
                <UploadMediaOverlay
                  percent={progressFor(att.id)}
                  onCancel={onCancelUpload}
                />
              ) : null}
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
              className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl p-2.5 transition hover:opacity-90 ${
                isOwnMessage ? "chat-bubble-own-file" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (isUploading) e.preventDefault();
              }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <MapPin className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${isOwnMessage ? "text-[#292524] dark:text-white" : "text-content"}`}>Location</p>
                <p className={`truncate text-[11px] ${isOwnMessage ? "text-[#667781] dark:text-content-tertiary" : "text-content-tertiary"}`}>{att.name}</p>
              </div>
              {isUploading ? (
                <UploadMediaOverlay
                  percent={progressFor(att.id)}
                  onCancel={onCancelUpload}
                />
              ) : null}
            </a>
          );
        }

        const pdf = isPdfAttachment(att);
        const ext = fileExtensionLabel(att.name, att.mimeType);
        const sizeLabel = formatAttachmentSize(att.size);
        const fileMetaLine = [ext, sizeLabel].filter(Boolean).join(" • ");
        const fileIcon = isUploading ? (
          <CircularUploadProgress
            percent={progressFor(att.id)}
            onCancel={onCancelUpload}
            size={44}
          />
        ) : (
          <span
            className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-white ${
              pdf
                ? "bg-[#e53935]"
                : ext === "ZIP"
                  ? "bg-slate-600"
                  : ext === "APK"
                    ? "bg-[#54656f]"
                    : "bg-[#7b68ee]"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span className="mt-0.5 text-[8px] font-bold leading-none tracking-wide">
              {ext}
            </span>
          </span>
        );

        return (
          <div
            key={att.id}
            className={`w-full overflow-hidden rounded-[6px] ${
              isOwnMessage ? "chat-bubble-own-file" : "bg-[#f5f6f6] dark:bg-surface-secondary/80"
            }`}
          >
            <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-2.5">
              {fileIcon}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[14px] font-medium leading-snug ${isOwnMessage ? "text-[#292524] dark:text-white" : "text-content"}`}>
                  {att.name}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-[#667781] dark:text-content-tertiary">
                  {fileMetaLine}
                </p>
              </div>
            </div>
            {isUploading ? (
              <div className="border-t border-black/[0.08] py-1.5 text-center text-[13px] text-[#667781] dark:border-white/10 dark:text-content-tertiary">
                Uploading...
              </div>
            ) : (
              <div className="grid grid-cols-2 border-t border-black/[0.08] dark:border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAttachment(att);
                  }}
                  className={`py-1.5 text-center text-[13.5px] font-medium transition hover:bg-black/[0.04] ${isOwnMessage ? "text-[#c45a18] dark:text-orange-300" : "text-[#027eb5]"}`}
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    saveAttachment(att);
                  }}
                  className={`border-l border-black/[0.08] py-1.5 text-center text-[13.5px] font-medium transition hover:bg-black/[0.04] dark:border-white/10 dark:text-sky-400 ${isOwnMessage ? "text-[#c45a18] dark:text-orange-300" : "text-[#027eb5]"}`}
                >
                  Save as...
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MessageAttachments;
