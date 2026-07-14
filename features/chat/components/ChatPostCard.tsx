"use client";

import { apiClient } from "@/lib/api-client";
import { Newspaper, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

type ChatPostPreview = {
  id: string;
  content?: string | null;
  media_urls?: string[] | null;
  media_type?: string | null;
  author?: {
    id?: string;
    username?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

interface ChatPostCardProps {
  postId: string;
  isOwnMessage?: boolean;
}

function firstMediaUrl(post: ChatPostPreview | null): string | null {
  const urls = post?.media_urls;
  if (!Array.isArray(urls) || !urls.length) return null;
  const u = urls[0];
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

function isVideoPost(post: ChatPostPreview | null, mediaUrl: string | null): boolean {
  if (!mediaUrl) return false;
  const mt = (post?.media_type || "").toLowerCase();
  if (mt.includes("video")) return true;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaUrl);
}

const ChatPostCard: React.FC<ChatPostCardProps> = ({
  postId,
  isOwnMessage = false,
}) => {
  const router = useRouter();
  const [post, setPost] = useState<ChatPostPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const data = await apiClient.get<ChatPostPreview>(`/api/posts/${postId}`);
        if (cancelled) return;
        if (!data?.id) {
          setFailed(true);
          return;
        }
        setPost(data);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const mediaUrl = firstMediaUrl(post);
  const video = isVideoPost(post, mediaUrl);
  const authorName =
    post?.author?.full_name?.trim() ||
    post?.author?.username?.trim() ||
    "ConnectAfrik";
  const authorAvatar = post?.author?.avatar_url || null;
  const snippet = (post?.content || "").replace(/\s+/g, " ").trim();

  const openPost = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    router.push(`/post/${postId}`);
  };

  if (loading) {
    return (
      <div
        className={`mb-1.5 w-[min(100%,280px)] overflow-hidden rounded-xl ${
          isOwnMessage ? "chat-bubble-own-file" : "bg-surface-canvas"
        }`}
      >
        <div className="h-[132px] animate-pulse bg-surface-secondary" />
        <div className="space-y-2 p-2.5">
          <div className="h-3 w-24 animate-pulse rounded bg-surface-secondary" />
          <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-surface-secondary" />
        </div>
      </div>
    );
  }

  if (failed || !post) {
    return (
      <button
        type="button"
        onClick={openPost}
        className={`mb-1.5 flex w-[min(100%,280px)] items-center gap-2.5 rounded-xl p-2.5 text-left transition hover:opacity-95 ${
          isOwnMessage ? "chat-bubble-own-file" : "bg-surface-canvas"
        }`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-500/15 text-primary-600">
          <Newspaper className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-content">ConnectAfrik post</span>
          <span className="block text-[11px] text-content-tertiary">Tap to open</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openPost}
      className={`mb-1.5 block w-[min(100%,280px)] overflow-hidden rounded-xl text-left transition hover:opacity-95 ${
        isOwnMessage ? "chat-bubble-own-file" : "bg-surface-canvas ring-1 ring-border-subtle"
      }`}
      aria-label={`Open post by ${authorName}`}
    >
      {mediaUrl ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/10">
          {video ? (
            <>
              <video
                src={mediaUrl}
                muted
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </span>
              </span>
            </>
          ) : (
            <img
              src={mediaUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
          <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            Post
          </span>
        </div>
      ) : (
        <div className="relative flex h-[88px] items-center justify-center bg-gradient-to-br from-primary-500/20 via-amber-500/10 to-emerald-500/20">
          <Newspaper className="h-8 w-8 text-primary-600/70" />
          <span className="absolute left-2 top-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Post
          </span>
        </div>
      )}

      <div className="px-2.5 py-2">
        <div className="mb-1.5 flex items-center gap-2">
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
              {authorName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 truncate text-xs font-semibold text-content">
            {authorName}
          </span>
        </div>
        {snippet ? (
          <p className="line-clamp-3 text-[13px] leading-snug text-content">
            {snippet}
          </p>
        ) : (
          <p className="text-[12px] text-content-tertiary">View this post on ConnectAfrik</p>
        )}
        <p className="mt-1.5 text-[11px] font-medium text-[#027eb5] dark:text-sky-400">
          connectafrik.com
        </p>
      </div>
    </button>
  );
};

export default ChatPostCard;
