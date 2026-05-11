"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format, isThisYear, isToday, isYesterday } from "date-fns";
import { Archive, MoreVertical, Pin, PinOff, Search, Trash2 } from "lucide-react";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import { ChatThread, supabaseMessagingService } from "@/features/chat/services/supabaseMessagingService";
import type { ChatParticipant } from "@/shared/types/chat";
import { toast } from "react-hot-toast";

const PAGE_SIZE = 60;
const threadCacheByUserId = new Map<string, ChatThread[]>();

function formatThreadListTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t) || t <= 0) return "";
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  if (isThisYear(d)) return format(d, "MMM d");
  return format(d, "MMM d, yyyy");
}

interface ChatSidebarProps {
  selectedThreadId?: string;
  onOpenThread: (threadId: string) => void;
}

export default function ChatSidebar({
  selectedThreadId,
  onOpenThread,
}: ChatSidebarProps) {
  const { currentUser, threads: contextThreads } = useProductionChat();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);

  useEffect(() => {
    const loadThreads = async () => {
      if (!currentUser) {
        setThreads([]);
        setIsLoading(false);
        return;
      }

      const cached = threadCacheByUserId.get(currentUser.id);
      if (cached) {
        setThreads(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const userThreads = await supabaseMessagingService.getUserThreads(
          { id: currentUser.id, name: currentUser.name || "" },
          { limit: PAGE_SIZE, page: 0 }
        );
        threadCacheByUserId.set(currentUser.id, userThreads);
        setThreads(userThreads);
      } finally {
        setIsLoading(false);
      }
    };
    void loadThreads();
  }, []);

  useEffect(() => {
    if (!menuThreadId) return;
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-chat-menu]") || target?.closest("[data-chat-menu-trigger]")) {
        return;
      }
      setMenuThreadId(null);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [menuThreadId]);

  const mergedThreads = useMemo(() => {
    const map = new Map<string, ChatThread>();
    for (const t of threads) map.set(t.id, t);
    for (const t of contextThreads) map.set(t.id, t);
    return Array.from(map.values()).sort((a, b) => {
      const pinA = a.pinned ? 1 : 0;
      const pinB = b.pinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      if (pinA && pinB) {
        const pinnedAtA = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
        const pinnedAtB = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
        if (pinnedAtA !== pinnedAtB) return pinnedAtB - pinnedAtA;
      }
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [threads, contextThreads]);

  const query = search.trim().toLowerCase();
  const filteredThreads = useMemo(() => {
    return mergedThreads.filter((t) => {
      if (t.archived) return false;
      if (!query) return true;
      const others = t.participants.filter((p: ChatParticipant) => p.id !== currentUser?.id);
      const primary = others[0] ?? t.participants[0];
      const title = (primary?.name || t.name || "").toLowerCase();
      const preview = (t.last_message_preview || "").toLowerCase();
      return title.includes(query) || preview.includes(query);
    });
  }, [mergedThreads, query, currentUser?.id]);

  const updateThreadState = useCallback((updated: ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (currentUser?.id) {
      const cached = threadCacheByUserId.get(currentUser.id) ?? [];
      threadCacheByUserId.set(
        currentUser.id,
        cached.map((t) => (t.id === updated.id ? updated : t))
      );
    }
  }, [currentUser?.id]);

  const handleToggleArchive = useCallback(
    async (thread: ChatThread) => {
      if (!currentUser?.id) return;
      try {
        const updated = await supabaseMessagingService.setThreadArchived(
          thread.id,
          currentUser.id,
          !thread.archived
        );
        if (updated) updateThreadState(updated);
        toast.success(thread.archived ? "Chat restored" : "Chat archived");
      } catch {
        toast.error("Could not update archive");
      } finally {
        setMenuThreadId(null);
      }
    },
    [currentUser?.id, threadCacheByUserId, updateThreadState]
  );

  const handleTogglePin = useCallback(
    async (thread: ChatThread) => {
      if (!currentUser?.id) return;
      try {
        const updated = await supabaseMessagingService.setThreadPinned(
          thread.id,
          currentUser.id,
          !thread.pinned
        );
        if (updated) updateThreadState(updated);
        toast.success(thread.pinned ? "Chat unpinned" : "Chat pinned");
      } catch {
        toast.error("Could not update pin");
      } finally {
        setMenuThreadId(null);
      }
    },
    [currentUser?.id, threadCacheByUserId, updateThreadState]
  );

  const handleClear = useCallback(
    async (thread: ChatThread) => {
      if (!currentUser?.id) return;
      try {
        await supabaseMessagingService.clearThreadMessagesForMe(thread.id, currentUser.id);
        toast.success("Chat cleared");
      } catch {
        toast.error("Failed to clear chat");
      } finally {
        setMenuThreadId(null);
      }
    },
    [currentUser?.id]
  );

  const onMenuAction = useCallback(
    (
      event: React.MouseEvent<HTMLButtonElement>,
      thread: ChatThread,
      action: "toggle-pin" | "toggle-archive" | "clear"
    ) => {
      event.stopPropagation();
      if (action === "toggle-pin") void handleTogglePin(thread);
      if (action === "toggle-archive") void handleToggleArchive(thread);
      if (action === "clear") void handleClear(thread);
    },
    [handleClear, handleToggleArchive, handleTogglePin]
  );

  return (
    <aside
      className={`w-full max-w-sm shrink-0 border-r border-gray-200 bg-[#f7f8fa]  ${
        selectedThreadId ? "hidden sm:block" : "block"
      }`}
    >
      <div className="border-b border-gray-200 bg-white px-4 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Chats</h1>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <div className="h-[calc(100%-7.75rem)] overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-gray-500">Loading chats...</div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No conversations found.</div>
        ) : (
          filteredThreads.map((thread) => {
            const others = thread.participants.filter(
              (participant: ChatParticipant) => participant.id !== currentUser?.id
            );
            const primary = others[0] ?? thread.participants[0];
            const isGroup =
              thread.type === "group" ||
              Boolean(thread.group_id) ||
              others.length > 1 ||
              Boolean((thread as { isGroup?: boolean }).isGroup);
            const displayName = isGroup && thread.name ? thread.name : primary?.name || thread.name || "Chat";
            const avatarUrl = isGroup && thread.banner_url ? thread.banner_url : primary?.avatarUrl;
            const selected = selectedThreadId === thread.id;

            return (
              <div
                key={thread.id}
                onClick={() => onOpenThread(thread.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenThread(thread.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`group cursor-pointer relative flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-white ${
                  selected ? "bg-white" : "bg-transparent"
                }`}
              >
                <div className="h-11 w-11 shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold text-gray-900">
                      {thread.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary-600" /> : null}
                      <span className="truncate">{displayName}</span>
                    </p>
                    <span
                      className={`shrink-0 text-xs ${
                        thread.unread_count > 0 ? "text-primary-600" : "text-gray-400"
                      }`}
                    >
                      {formatThreadListTime(thread.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-gray-500">
                      {thread.last_message_preview || "Tap to open chat"}
                    </p>
                    {thread.unread_count > 0 ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 px-1 text-[11px] font-semibold text-white">
                        {thread.unread_count > 99 ? "99+" : thread.unread_count}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    data-chat-menu-trigger
                    aria-label="Chat actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuThreadId((prev) => (prev === thread.id ? null : thread.id));
                    }}
                    className="rounded-full p-1.5 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuThreadId === thread.id ? (
                    <div
                      data-chat-menu
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-8 z-20 w-52 rounded-xl border border-gray-200 bg-white p-1 shadow-xl"
                    >
                        <button
                        type="button"
                        onClick={(e) => onMenuAction(e, thread, "toggle-archive")}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Archive className="h-4 w-4" />
                        <span>{thread.archived ? "Unarchive chat" : "Archive chat"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onMenuAction(e, thread, "toggle-pin")}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {thread.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        <span>{thread.pinned ? "Unpin chat" : "Pin chat"}</span>
                      </button>
                    
                      <button
                        type="button"
                        onClick={(e) => onMenuAction(e, thread, "clear")}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Clear chat</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
