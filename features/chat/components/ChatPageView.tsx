"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format, isThisYear, isToday, isYesterday } from "date-fns";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import {
  ChatThread,
  supabaseMessagingService,
} from "@/features/chat/services/supabaseMessagingService";
import type { ChatParticipant } from "@/shared/types/chat";
import ChatWindow from "@/features/chat/components/ChatWindow";

const PAGE_SIZE = 60;

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

interface ChatPageViewProps {
  selectedThreadId?: string;
}

export default function ChatPageView({ selectedThreadId }: ChatPageViewProps) {
  const router = useRouter();
  const { currentUser, openThread, threads: contextThreads } = useProductionChat();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadThreads = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const userThreads = await supabaseMessagingService.getUserThreads(
          { id: currentUser.id, name: currentUser.name || "" },
          { limit: PAGE_SIZE, page: 0 }
        );
        setThreads(userThreads);
      } finally {
        setIsLoading(false);
      }
    };
    void loadThreads();
  }, [currentUser]);

  const mergedThreads = useMemo(() => {
    const map = new Map<string, ChatThread>();
    for (const t of threads) map.set(t.id, t);
    for (const t of contextThreads) map.set(t.id, t);
    return Array.from(map.values()).sort((a, b) => {
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

  useEffect(() => {
    if (selectedThreadId) {
      openThread(selectedThreadId);
      return;
    }
    if (filteredThreads.length > 0) {
      const nextId = filteredThreads[0].id;
      openThread(nextId);
      router.replace(`/chat/${nextId}`);
    }
  }, [selectedThreadId, filteredThreads, openThread, router]);

  const openOnPage = useCallback(
    (threadId: string) => {
      openThread(threadId);
      router.push(`/chat/${threadId}`);
    },
    [openThread, router]
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] w-full max-w-7xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <aside className="w-full max-w-sm shrink-0 border-r border-gray-200 bg-[#f7f8fa]">
        <div className="border-b border-gray-200 bg-white px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Chats</h1>
          <p className="text-sm text-gray-500">Open a conversation like WhatsApp</p>
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
                Boolean((thread as any).isGroup);
              const displayName = isGroup && thread.name ? thread.name : primary?.name || thread.name || "Chat";
              const avatarUrl = isGroup && thread.banner_url ? thread.banner_url : primary?.avatarUrl;
              const selected = selectedThreadId === thread.id;

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => openOnPage(thread.id)}
                  className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-white ${
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
                      <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatThreadListTime(thread.last_message_at)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-500">
                      {thread.last_message_preview || "Tap to open chat"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="hidden min-w-0 flex-1 bg-[#efeae2] sm:block">
        {selectedThreadId ? (
          <ChatWindow threadId={selectedThreadId} variant="page" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Select a chat to start messaging.
          </div>
        )}
      </main>
    </div>
  );
}
