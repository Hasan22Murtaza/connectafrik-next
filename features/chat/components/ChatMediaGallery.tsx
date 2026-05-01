"use client";

import { apiClient } from "@/lib/api-client";
import {
  ChevronLeft,
  FileText,
  Headphones,
  Image as ImageIcon,
  Link2,
  Loader2,
  Video,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

export type SharedMediaTab = "media" | "docs" | "links";

export interface SharedMediaItem {
  id: string;
  message_id: string;
  sender_id: string;
  sender?: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  } | null;
  kind: string;
  created_at: string;
  section: string;
  url: string;
  thumbnail_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  content_preview?: string | null;
}

interface SharedMediaSection {
  label: string;
  items: SharedMediaItem[];
}

interface SharedMediaResponse {
  tab: string;
  sections: SharedMediaSection[];
  items: SharedMediaItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const FIXED_SECTION_ORDER = ["RECENT", "LAST_WEEK", "LAST_MONTH"] as const;

function rankSectionLabel(label: string): number {
  const i = FIXED_SECTION_ORDER.indexOf(label as (typeof FIXED_SECTION_ORDER)[number]);
  return i === -1 ? 99 : i;
}

function mergeSectionLists(
  prev: SharedMediaSection[],
  more: SharedMediaSection[]
): SharedMediaSection[] {
  const byLabel = new Map<string, SharedMediaItem[]>();
  for (const s of prev) {
    byLabel.set(s.label, [...s.items]);
  }
  for (const s of more) {
    const cur = byLabel.get(s.label) ?? [];
    const seen = new Set(cur.map((i) => i.id));
    for (const it of s.items) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        cur.push(it);
      }
    }
    byLabel.set(s.label, cur);
  }
  for (const [, arr] of byLabel) {
    arr.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  const labels = [...byLabel.keys()];
  labels.sort((a, b) => {
    const ra = rankSectionLabel(a);
    const rb = rankSectionLabel(b);
    if (ra !== rb) return ra - rb;
    const maxT = (lb: string) =>
      Math.max(
        0,
        ...(byLabel.get(lb) ?? []).map((i) => new Date(i.created_at).getTime())
      );
    return maxT(b) - maxT(a);
  });
  return labels.map((label) => ({ label, items: byLabel.get(label) ?? [] }));
}

function formatBytes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaTile({
  item,
  tab,
}: {
  item: SharedMediaItem;
  tab: SharedMediaTab;
}) {
  const openItem = () => {
    if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
  };

  if (tab === "links" || item.kind === "link") {
    return (
      <button
        type="button"
        onClick={openItem}
        className="flex aspect-square flex-col items-center justify-center rounded-lg bg-gray-100 p-2 text-left hover:bg-gray-200"
      >
        <Link2 className="mb-1 h-8 w-8 shrink-0 text-primary-600" />
        <span className="w-full break-all line-clamp-3 text-[10px] text-gray-600">
          {item.url}
        </span>
      </button>
    );
  }

  if (item.kind === "audio") {
    return (
      <button
        type="button"
        onClick={openItem}
        className="flex aspect-square items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600"
        aria-label="Open audio"
      >
        <Headphones className="h-10 w-10 text-white" />
      </button>
    );
  }

  if (item.kind === "image") {
    return (
        <button
          type="button"
          onClick={openItem}
          className="aspect-square overflow-hidden rounded-lg bg-gray-100 hover:opacity-95"
          aria-label="Open image"
        >
          <img
          src={item.thumbnail_url || item.url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>
    );
  }

  if (item.kind === "video") {
    return (
      <button
        type="button"
        onClick={openItem}
        className="flex aspect-square flex-col items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-800"
        aria-label="Open video"
      >
        <Video className="mb-1 h-10 w-10 opacity-90" />
        <span className="line-clamp-2 px-1 text-center text-[10px] opacity-80">
          Video
        </span>
      </button>
    );
  }

  const sizeHint = formatBytes(item.file_size);
  return (
    <button
      type="button"
      onClick={openItem}
      className="flex aspect-square flex-col items-center justify-center rounded-lg bg-gray-100 p-2 hover:bg-gray-200"
      aria-label={item.file_name || "Document"}
    >
      <FileText className="mb-1 h-8 w-8 shrink-0 text-gray-600" />
      <span className="line-clamp-2 text-center text-[10px] text-gray-700">
        {item.file_name || "Document"}
      </span>
      {sizeHint ? (
        <span className="mt-0.5 text-[9px] text-gray-500">{sizeHint}</span>
      ) : null}
    </button>
  );
}

const PAGE_SIZE = 60;

interface ChatMediaGalleryProps {
  threadId: string;
  open: boolean;
  onClose: () => void;
  /** Direct / one-to-one thread shows "Media"; group shows "Group media". */
  isGroupChat: boolean;
}

export default function ChatMediaGallery({
  threadId,
  open,
  onClose,
  isGroupChat,
}: ChatMediaGalleryProps) {
  const [tab, setTab] = useState<SharedMediaTab>("media");
  const [sections, setSections] = useState<SharedMediaSection[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTab("media");
      setSections([]);
      setPage(0);
      setHasMore(false);
      setError(null);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [open]);

  const loadInitial = useCallback(async () => {
    if (!threadId || !open) return;
    setLoading(true);
    setError(null);
    setPage(0);
    try {
      const data = await apiClient.get<SharedMediaResponse>(
        `/api/chat/threads/${threadId}/media`,
        { tab, page: 0, limit: PAGE_SIZE }
      );
      setSections(data.sections ?? []);
      setHasMore(Boolean(data.hasMore));
      setPage(0);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to load";
      setError(msg);
      setSections([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [threadId, open, tab]);

  useEffect(() => {
    if (!open || !threadId) return;
    void loadInitial();
  }, [open, threadId, tab, loadInitial]);

  const loadMore = async () => {
    if (!threadId || !open || !hasMore || loadingMore || loading) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await apiClient.get<SharedMediaResponse>(
        `/api/chat/threads/${threadId}/media`,
        { tab, page: nextPage, limit: PAGE_SIZE }
      );
      setHasMore(Boolean(data.hasMore));
      setPage(nextPage);
      setSections((prev) => mergeSectionLists(prev, data.sections ?? []));
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to load more";
      setError(msg);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!open) return null;

  const galleryTitle = isGroupChat ? "Group media" : "Media";

  const emptyCopy =
    tab === "media"
      ? "No photos, videos or audio in this chat yet."
      : tab === "docs"
        ? "No documents in this chat yet."
        : "No links in this chat yet.";

  const tabBtn = (key: SharedMediaTab, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setTab(key)}
      className={`relative flex-1 pb-2 text-center text-xs font-semibold transition ${
        tab === key
          ? "text-primary-600"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
      {tab === key ? (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary-600" />
      ) : null}
    </button>
  );

  return (
    <div
      className="absolute inset-0 z-[70] flex flex-col overflow-hidden rounded-2xl bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={galleryTitle}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-800 px-2 py-2 text-white">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ImageIcon className="h-5 w-5 shrink-0 opacity-90" />
          <span className="truncate text-sm font-semibold">{galleryTitle}</span>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-gray-200 bg-white px-2 pt-2">
        <div className="flex w-full gap-1">
          {tabBtn("media", "Media")}
          {tabBtn("docs", "Docs")}
          {tabBtn("links", "Links")}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {error ? (
          <div className="py-4 text-center text-xs text-red-600">{error}</div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : sections.length === 0 && !error ? (
          <div className="py-16 text-center text-xs text-gray-500">{emptyCopy}</div>
        ) : (
          sections.map((section) => (
            <div key={section.label} className="mb-4">
              <h3 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                {section.label}
              </h3>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {section.items.map((item) => (
                  <MediaTile key={item.id} item={item} tab={tab} />
                ))}
              </div>
            </div>
          ))
        )}

        {hasMore && !loading && sections.length > 0 ? (
          <div className="flex justify-center pb-2 pt-1">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </span>
              ) : (
                "Load more"
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
