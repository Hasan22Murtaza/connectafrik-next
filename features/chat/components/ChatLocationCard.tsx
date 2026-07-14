"use client";

import {
  getPostLocationMapsUrl,
  getPostLocationStaticMapUrl,
  parsePostLocation,
  type PostLocationData,
} from "@/features/social/utils/postLocation";
import { ExternalLink, MapPin } from "lucide-react";
import React from "react";

/** True when message content is a post-style location JSON payload. */
export function tryParseChatLocationContent(
  content: string | undefined | null
): PostLocationData | null {
  const raw = (content || "").trim();
  if (!raw.startsWith("{")) return null;
  const parsed = parsePostLocation(raw);
  if (!parsed?.display_name) return null;
  return parsed;
}

interface ChatLocationCardProps {
  location: PostLocationData;
  isOwnMessage?: boolean;
}

const ChatLocationCard: React.FC<ChatLocationCardProps> = ({
  location,
  isOwnMessage = false,
}) => {
  const mapsUrl = getPostLocationMapsUrl(location);
  const staticMap = getPostLocationStaticMapUrl(location, 560, 220);
  const subtitle = location.map_title?.trim() || null;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mb-1 block w-[min(100%,280px)] overflow-hidden rounded-xl transition hover:opacity-95 ${
        isOwnMessage ? "chat-bubble-own-file" : "bg-surface-canvas"
      }`}
    >
      {staticMap ? (
        <div className="relative aspect-[560/220] w-full overflow-hidden bg-surface-secondary">
          <img
            src={staticMap}
            alt={location.display_name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <span className="absolute bottom-2 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-[#00a884] text-white shadow-md">
            <MapPin className="h-5 w-5" />
          </span>
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center bg-gradient-to-br from-emerald-500/20 to-sky-500/20">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] text-white shadow-md">
            <MapPin className="h-6 w-6" />
          </span>
        </div>
      )}
      <div className="flex items-start gap-2 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-content">
            {location.display_name}
          </p>
          {subtitle ? (
            <p className="truncate text-[11px] text-content-tertiary">{subtitle}</p>
          ) : (
            <p className="text-[11px] text-content-tertiary">Tap to open in Maps</p>
          )}
        </div>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-content-tertiary" />
      </div>
    </a>
  );
};

export default ChatLocationCard;
