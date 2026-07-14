"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isThisYear, isToday, isYesterday } from "date-fns";
import { Archive, ArrowLeft, Ban, ChevronDown, ChevronRight, Loader2, MoreVertical, Pin, PinOff, Search, SquarePen, Store, Trash2, UserPlus, Users, X } from "lucide-react";
import { isDirectBlockableThread } from "@/features/chat/utils/threadHelpers";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import { ChatThread, supabaseMessagingService } from "@/features/chat/services/supabaseMessagingService";
import { CHAT_THREAD_MARKED_READ_EVENT } from "@/features/chat/threadReadEvents";
import type { ChatParticipant } from "@/shared/types/chat";
import { toast } from "react-hot-toast";

const PAGE_SIZE = 10;

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

function isGroupThread(thread: ChatThread, currentUserId?: string): boolean {
  const others = thread.participants.filter((p) => p.id !== currentUserId);
  return (
    thread.type === "group" ||
    Boolean(thread.group_id) ||
    others.length > 1 ||
    Boolean((thread as { isGroup?: boolean }).isGroup)
  );
}

/** Pinned-first, then most-recent activity. Mirrors the main thread list ordering. */
function sortThreadsByPinnedRecency(a: ChatThread, b: ChatThread): number {
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
}

interface ChatSidebarProps {
  selectedThreadId?: string;
  /** Pass the row’s thread when opening from the list so the app shell does not refetch the full thread list (WhatsApp-style). */
  onOpenThread: (threadId: string, seedThread?: ChatThread) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function ChatSidebar({
  selectedThreadId,
  onOpenThread,
  searchInputRef,
}: ChatSidebarProps) {
  const router = useRouter();
  const { currentUser, threads: contextThreads, activeCallsByThread } = useProductionChat();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastLoadedPage, setLastLoadedPage] = useState(-1);
  const [search, setSearch] = useState("");
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [blockedExpanded, setBlockedExpanded] = useState(false);
  const [view, setView] = useState<"chats" | "marketplace">("chats");
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [mpThreads, setMpThreads] = useState<ChatThread[]>([]);
  const [mpLoading, setMpLoading] = useState(true);
  const [filterThreads, setFilterThreads] = useState<ChatThread[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);

  const loadGeneral = useCallback(async () => {
    if (!currentUser?.id) {
      setThreads([]);
      setIsLoading(false);
      setHasMore(false);
      setLastLoadedPage(-1);
      return;
    }
    setIsLoading(true);
    setLastLoadedPage(-1);
    try {
      const { threads: rows, hasMore: more } = await supabaseMessagingService.getUserThreads(
        { id: currentUser.id, name: currentUser.name || "" },
        { limit: PAGE_SIZE, page: 0, category: "general" }
      );
      setThreads(rows);
      setHasMore(more);
      setLastLoadedPage(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.name]);

  const loadMarketplace = useCallback(async () => {
    if (!currentUser?.id) {
      setMpThreads([]);
      setMpLoading(false);
      return;
    }
    setMpLoading(true);
    try {
      const { threads: rows } = await supabaseMessagingService.getUserThreads(
        { id: currentUser.id, name: currentUser.name || "" },
        { limit: 50, page: 0, category: "marketplace" }
      );
      setMpThreads(rows);
    } finally {
      setMpLoading(false);
    }
  }, [currentUser?.id, currentUser?.name]);

  useEffect(() => {
    void loadGeneral();
  }, [loadGeneral]);

  useEffect(() => {
    void loadMarketplace();
  }, [loadMarketplace]);

  useEffect(() => {
    if (filter === "all") {
      setFilterThreads([]);
      return;
    }
    if (!currentUser?.id) {
      setFilterThreads([]);
      return;
    }
    let cancelled = false;
    setFilterLoading(true);
    const participant = { id: currentUser.id, name: currentUser.name || "" };
    const request =
      filter === "groups"
        ? supabaseMessagingService.getGroupThreads(participant, { limit: 50, page: 0 })
        : supabaseMessagingService.getUnreadThreads(participant, {
            limit: 50,
            page: 0,
            category: "general",
          });
    request
      .then(({ threads: rows }) => {
        if (!cancelled) setFilterThreads(rows);
      })
      .catch(() => {
        if (!cancelled) setFilterThreads([]);
      })
      .finally(() => {
        if (!cancelled) setFilterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, currentUser?.id, currentUser?.name]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const handler = (event: Event) => {
      const tid = (event as CustomEvent<{ threadId?: string }>).detail?.threadId;
      if (!tid) return;
      const known = threads.some((t) => t.id === tid) || mpThreads.some((t) => t.id === tid);
      if (known) return;
      // A thread we haven't listed was opened — let the API place it in the
      // right list (general vs marketplace) by reloading both.
      void loadGeneral();
      void loadMarketplace();
    };
    window.addEventListener("openChatThread", handler as EventListener);
    return () => window.removeEventListener("openChatThread", handler as EventListener);
  }, [currentUser?.id, threads, mpThreads, loadGeneral, loadMarketplace]);

  const loadMoreThreads = useCallback(async () => {
    if (!currentUser?.id || isLoadingMore || !hasMore || lastLoadedPage < 0) return;
    const nextPage = lastLoadedPage + 1;
    setIsLoadingMore(true);
    try {
      const { threads: more, hasMore: moreLeft } = await supabaseMessagingService.getUserThreads(
        { id: currentUser.id, name: currentUser.name || "" },
        { limit: PAGE_SIZE, page: nextPage, category: "general" }
      );
      setHasMore(moreLeft);
      setLastLoadedPage(nextPage);
      setThreads((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        const deduped = more.filter((t) => !seen.has(t.id));
        return [...prev, ...deduped];
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentUser?.id, currentUser?.name, hasMore, isLoadingMore, lastLoadedPage]);

  const handleThreadsScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        void loadMoreThreads();
      }
    },
    [loadMoreThreads]
  );

  useEffect(() => {
    const onMarkedRead = (event: Event) => {
      const tid = (event as CustomEvent<{ threadId?: string }>).detail?.threadId;
      if (!tid) return;
      setThreads((prev) =>
        prev.map((t) => (t.id === tid ? { ...t, unread_count: 0 } : t))
      );
    };
    window.addEventListener(CHAT_THREAD_MARKED_READ_EVENT, onMarkedRead as EventListener);
    return () =>
      window.removeEventListener(CHAT_THREAD_MARKED_READ_EVENT, onMarkedRead as EventListener);
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

  useEffect(() => {
    if (!headerMenuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-header-menu]") || target?.closest("[data-header-menu-trigger]")) {
        return;
      }
      setHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [headerMenuOpen]);

  const mergedThreads = useMemo(() => {
    // Membership comes from the API (general category). The realtime context
    // pool only overlays live fields (unread, last message) for listed threads.
    const ctxById = new Map(contextThreads.map((t) => [t.id, t]));
    return threads
      .map((t) => ctxById.get(t.id) ?? t)
      .sort((a, b) => {
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

  const marketplaceThreads = useMemo(() => {
    // Membership from the API (marketplace category); overlay live fields by id.
    const ctxById = new Map(contextThreads.map((t) => [t.id, t]));
    return mpThreads
      .map((t) => ctxById.get(t.id) ?? t)
      .filter((t) => !t.archived && !t.is_block)
      .sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [mpThreads, contextThreads]);

  const marketplaceUnread = useMemo(
    () =>
      marketplaceThreads.reduce(
        (sum, t) => sum + (typeof t.unread_count === "number" ? t.unread_count : 0),
        0
      ),
    [marketplaceThreads]
  );

  const query = search.trim().toLowerCase();

  const matchesSearch = useCallback(
    (t: ChatThread) => {
      if (!query) return true;
      const others = t.participants.filter((p: ChatParticipant) => p.id !== currentUser?.id);
      const primary = others[0] ?? t.participants[0];
      const title = (primary?.name || t.name || "").toLowerCase();
      const preview = (t.last_message_preview || "").toLowerCase();
      return title.includes(query) || preview.includes(query);
    },
    [query, currentUser?.id]
  );

  const activeThreads = useMemo(
    () => mergedThreads.filter((t) => !t.archived && !t.is_block),
    [mergedThreads]
  );

  const blockedThreads = useMemo(
    () => mergedThreads.filter((t) => !t.archived && t.is_block === true),
    [mergedThreads]
  );

  const filteredActive = useMemo(
    () => activeThreads.filter(matchesSearch),
    [activeThreads, matchesSearch]
  );

  const filteredBlocked = useMemo(
    () => blockedThreads.filter(matchesSearch),
    [blockedThreads, matchesSearch]
  );

  // Server-fetched filter list (groups/unread), overlaid with realtime context
  // fields, kept to active conversations and matched against the search query.
  const filteredFilterThreads = useMemo(() => {
    if (filter === "all") return [];
    const ctxById = new Map(contextThreads.map((t) => [t.id, t]));
    return filterThreads
      .map((t) => ctxById.get(t.id) ?? t)
      .filter((t) => !t.archived && !t.is_block)
      .filter((t) => (filter === "unread" ? (t.unread_count ?? 0) > 0 : true))
      .filter(matchesSearch)
      .sort(sortThreadsByPinnedRecency);
  }, [filter, filterThreads, contextThreads, matchesSearch]);

  const visibleActive = filter === "all" ? filteredActive : filteredFilterThreads;

  const showBlockedSection = filter === "all" && blockedThreads.length > 0;

  const filteredMarketplace = useMemo(
    () =>
      marketplaceThreads.filter((t) => {
        if (!query) return true;
        const others = t.participants.filter((p: ChatParticipant) => p.id !== currentUser?.id);
        const title = (t.product_title || others[0]?.name || t.name || "").toLowerCase();
        const preview = (t.last_message_preview || "").toLowerCase();
        return title.includes(query) || preview.includes(query);
      }),
    [marketplaceThreads, query, currentUser?.id]
  );

  const updateThreadState = useCallback((updated: ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

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
    [currentUser?.id, updateThreadState]
  );

  const handleToggleBlock = useCallback(
    async (thread: ChatThread) => {
      if (!currentUser?.id) return;
      const nextBlocked = !thread.is_block;
      if (nextBlocked) {
        const name =
          thread.participants.find((p) => p.id !== currentUser.id)?.name ||
          thread.name ||
          "this contact";
        const confirmed = window.confirm(
          `Block ${name}? They will not be able to call or message you in this chat.`
        );
        if (!confirmed) {
          setMenuThreadId(null);
          return;
        }
      }
      try {
        const updated = await supabaseMessagingService.setThreadBlocked(
          thread.id,
          currentUser.id,
          nextBlocked
        );
        if (updated) updateThreadState(updated);
        toast.success(nextBlocked ? "Contact blocked" : "Contact unblocked");
      } catch {
        toast.error("Could not update block");
      } finally {
        setMenuThreadId(null);
      }
    },
    [currentUser?.id, updateThreadState]
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
    [currentUser?.id, updateThreadState]
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
      action: "toggle-pin" | "toggle-archive" | "toggle-block" | "clear"
    ) => {
      event.stopPropagation();
      if (action === "toggle-pin") void handleTogglePin(thread);
      if (action === "toggle-archive") void handleToggleArchive(thread);
      if (action === "toggle-block") void handleToggleBlock(thread);
      if (action === "clear") void handleClear(thread);
    },
    [handleClear, handleToggleArchive, handleToggleBlock, handleTogglePin]
  );

  const filterChips: { key: "all" | "unread" | "groups"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "groups", label: "Groups" },
  ];

  return (
    <aside
      className={`flex h-full w-full flex-col border-r border-border bg-surface-canvas sm:w-[360px] sm:shrink-0 lg:w-[400px] ${
        selectedThreadId ? "hidden sm:flex" : "flex"
      }`}
    >
      <header className="shrink-0 border-b border-border bg-surface">
        <div className="flex items-center justify-between gap-2 px-4 pt-1 sm:pt-1">
          {view === "marketplace" ? (
            <button
              type="button"
              onClick={() => {
                setView("chats");
                setSearch("");
              }}
              className="-ml-1 flex items-center gap-2 text-xl font-semibold text-content"
            >
              <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
              Marketplace
            </button>
          ) : (
            <h1 className="text-xl font-semibold text-content">Chats</h1>
          )}
          {view === "chats" ? (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => router.push("/friends")}
                aria-label="New chat"
                title="New chat"
                className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content"
              >
                <SquarePen className="h-5 w-5" aria-hidden />
              </button>
              <div className="relative">
                <button
                  type="button"
                  data-header-menu-trigger
                  onClick={() => setHeaderMenuOpen((o) => !o)}
                  aria-label="Menu"
                  aria-expanded={headerMenuOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content"
                >
                  <MoreVertical className="h-5 w-5" aria-hidden />
                </button>
                {headerMenuOpen ? (
                  <div
                    data-header-menu
                    className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-border bg-surface p-1 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        router.push("/groups/create");
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-content hover:bg-surface-hover"
                    >
                      <Users className="h-4 w-4 text-content-secondary" aria-hidden />
                      <span>New group</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        router.push("/friends");
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-content hover:bg-surface-hover"
                    >
                      <UserPlus className="h-4 w-4 text-content-secondary" aria-hidden />
                      <span>New contact</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setView("marketplace");
                        setSearch("");
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-content hover:bg-surface-hover"
                    >
                      <Store className="h-4 w-4 text-content-secondary" aria-hidden />
                      <span>Marketplace messages</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-4 py-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === "marketplace" ? "Search marketplace" : "Search or start a new chat"}
              className="w-full rounded-full border border-transparent bg-surface-canvas py-2.5 pl-10 pr-9 text-sm text-content placeholder:text-content-secondary outline-none transition focus-visible:border-orange-300 focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-orange-100"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-content-tertiary transition hover:bg-surface-hover hover:text-content"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {view === "chats" ? (
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterChips.map((chip) => {
              const active = filter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-[#25D366]/20 text-content dark:bg-[#25D366]/25"
                      : "border border-border text-content-secondary hover:bg-surface-hover"
                  }`}
                >
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {view === "chats" ? (
        <button
          type="button"
          onClick={() => {
            setView("marketplace");
            setSearch("");
          }}
          className="relative flex w-full shrink-0 items-center gap-3 px-3 py-3 text-left transition hover:bg-surface-hover"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <Store className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-content">Marketplace messages</p>
            <p className="truncate text-sm text-content-secondary">Buying &amp; selling conversations</p>
          </div>
          {marketplaceUnread > 0 ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[11px] font-semibold text-white">
              {marketplaceUnread > 99 ? "99+" : marketplaceUnread}
            </span>
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-content-tertiary" aria-hidden />
          )}
          <span className="pointer-events-none absolute bottom-0 left-[4.5rem] right-0 h-px bg-border-subtle" />
        </button>
      ) : null}

      {view === "marketplace" ? (
        <div className="flex-1 overflow-y-auto">
          {mpLoading && marketplaceThreads.length === 0 ? (
            <div className="p-4 text-sm text-content-secondary">Loading marketplace…</div>
          ) : marketplaceThreads.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Store className="mx-auto mb-3 h-10 w-10 text-content-tertiary" aria-hidden />
              <p className="text-sm font-semibold text-content">No marketplace messages</p>
              <p className="mt-1 text-sm text-content-secondary">
                Conversations about listings appear here.
              </p>
            </div>
          ) : filteredMarketplace.length === 0 ? (
            <div className="p-4 text-sm text-content-secondary">No conversations found.</div>
          ) : (
            filteredMarketplace.map((thread) => {
              const others = thread.participants.filter(
                (participant: ChatParticipant) => participant.id !== currentUser?.id
              );
              const primary = others[0] ?? thread.participants[0];
              const displayName =
                thread.product_title || primary?.name || thread.name || "Marketplace chat";
              const avatarUrl = thread.product_image || primary?.avatarUrl;
              const selected = selectedThreadId === thread.id;
              const activeCall = activeCallsByThread[thread.id];

              return (
                <div
                  key={thread.id}
                  onClick={() => onOpenThread(thread.id, thread)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenThread(thread.id, thread);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`group relative flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition hover:bg-surface-hover ${
                    selected ? "bg-surface-hover" : "bg-transparent"
                  }`}
                >
                  <div className="h-12 w-12 shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 font-semibold text-primary-700">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[15px] font-medium text-content">{displayName}</p>
                      <span
                        className={`shrink-0 text-xs tabular-nums ${
                          thread.unread_count > 0 ? "text-[#25D366]" : "text-content-tertiary"
                        }`}
                      >
                        {formatThreadListTime(thread.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-sm ${
                          activeCall ? "font-medium text-green-600" : "text-content-secondary"
                        }`}
                      >
                        {activeCall
                          ? `● ${activeCall.callType === "video" ? "Video" : "Audio"} call · ${activeCall.participantCount} in call`
                          : thread.last_message_preview || "Tap to open chat"}
                      </p>
                      {thread.unread_count > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[11px] font-semibold text-white">
                          {thread.unread_count > 99 ? "99+" : thread.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="pointer-events-none absolute bottom-0 left-[4.5rem] right-0 h-px bg-border-subtle" />
                </div>
              );
            })
          )}
        </div>
      ) : (
      <div
        className="flex-1 overflow-y-auto"
        onScroll={filter === "all" ? handleThreadsScroll : undefined}
      >
        {(filter === "all" ? isLoading : filterLoading && visibleActive.length === 0) ? (
          <div className="p-4 text-sm text-content-secondary">Loading chats...</div>
        ) : visibleActive.length === 0 && !showBlockedSection ? (
          <div className="px-4 py-10 text-center text-sm text-content-secondary">
            {filter === "unread"
              ? "No unread chats."
              : filter === "groups"
                ? "No group chats."
                : "No conversations found."}
          </div>
        ) : (
          <>
          {visibleActive.length === 0 && showBlockedSection && !query ? (
            <p className="px-4 pb-2 pt-3 text-xs text-content-secondary">
              No active chats — open <span className="font-medium text-content">Blocked</span> below.
            </p>
          ) : null}
          {visibleActive.map((thread) => {
            const others = thread.participants.filter(
              (participant: ChatParticipant) => participant.id !== currentUser?.id
            );
            const primary = others[0] ?? thread.participants[0];
            const isGroup = isGroupThread(thread, currentUser?.id);
            const displayName = isGroup && thread.name ? thread.name : primary?.name || thread.name || "Chat";
            const avatarUrl = isGroup && thread.banner_url ? thread.banner_url : primary?.avatarUrl;
            const selected = selectedThreadId === thread.id;
            const canBlock = isDirectBlockableThread(thread, currentUser?.id);
            const activeCall = activeCallsByThread[thread.id];

            return (
              <div
                key={thread.id}
                onClick={() => onOpenThread(thread.id, thread)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenThread(thread.id, thread);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`group cursor-pointer relative flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-surface-hover ${
                  selected ? "bg-surface-hover" : "bg-transparent"
                }`}
              >
                <div className="h-12 w-12 shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[15px] font-medium text-content">{displayName}</span>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        thread.unread_count > 0 ? "text-[#25D366]" : "text-content-tertiary"
                      }`}
                    >
                      {formatThreadListTime(thread.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${activeCall ? 'text-green-600 font-medium' : 'text-content-secondary'}`}>
                      {activeCall
                        ? `● ${activeCall.callType === 'video' ? 'Video' : 'Audio'} call · ${activeCall.participantCount} in call`
                        : (thread.last_message_preview || "Tap to open chat")}
                    </p>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {thread.pinned ? <Pin className="h-3.5 w-3.5 text-content-tertiary" aria-label="Pinned" /> : null}
                      {thread.unread_count > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1 text-[11px] font-semibold text-white">
                          {thread.unread_count > 99 ? "99+" : thread.unread_count}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
                <div className="relative self-center">
                  <button
                    type="button"
                    data-chat-menu-trigger
                    aria-label="Chat actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuThreadId((prev) => (prev === thread.id ? null : thread.id));
                    }}
                    className="rounded-full p-1.5 text-content-tertiary opacity-60 transition hover:bg-surface-hover hover:text-content sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuThreadId === thread.id ? (
                    <div
                      data-chat-menu
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-8 z-20 w-52 rounded-xl border border-border bg-surface p-1 shadow-xl"
                    >
                        <button
                        type="button"
                        onClick={(e) => onMenuAction(e, thread, "toggle-archive")}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-content hover:bg-surface-hover"
                      >
                        <Archive className="h-4 w-4" />
                        <span>{thread.archived ? "Unarchive chat" : "Archive chat"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onMenuAction(e, thread, "toggle-pin")}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-content hover:bg-surface-hover"
                      >
                        {thread.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        <span>{thread.pinned ? "Unpin chat" : "Pin chat"}</span>
                      </button>
                      {canBlock ? (
                        <button
                          type="button"
                          onClick={(e) => onMenuAction(e, thread, "toggle-block")}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-content hover:bg-surface-hover"
                        >
                          <Ban className="h-4 w-4" />
                          <span>{thread.is_block ? "Unblock contact" : "Block contact"}</span>
                        </button>
                      ) : null}
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
                <span className="pointer-events-none absolute bottom-0 left-[4.5rem] right-0 h-px bg-border-subtle" />
              </div>
            );
          })}
          {showBlockedSection ? (
            <div className="border-t border-border px-4 pt-2">
              <button
                type="button"
                onClick={() => setBlockedExpanded((e) => !e)}
                className="mb-1 flex w-full items-center gap-1 text-left text-xs font-medium uppercase tracking-wide text-content-secondary hover:text-content"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${blockedExpanded ? "" : "-rotate-90"}`}
                />
                Blocked ({blockedThreads.length})
              </button>
              {blockedExpanded
                ? filteredBlocked.map((thread) => {
                    const others = thread.participants.filter(
                      (participant: ChatParticipant) => participant.id !== currentUser?.id
                    );
                    const primary = others[0] ?? thread.participants[0];
                    const displayName = primary?.name || thread.name || "Chat";
                    const avatarUrl = primary?.avatarUrl;
                    const selected = selectedThreadId === thread.id;

                    return (
                      <div
                        key={`blocked-${thread.id}`}
                        onClick={() => onOpenThread(thread.id, thread)}
                        role="button"
                        tabIndex={0}
                        className={`group relative flex w-full cursor-pointer items-start gap-3 border-b border-border-subtle py-3 text-left opacity-80 transition hover:bg-surface-hover ${
                          selected ? "bg-primary-50 text-primary-700 dark:text-primary-400" : ""
                        }`}
                      >
                        <div className="h-12 w-12 shrink-0">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-tertiary font-semibold text-content-secondary">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-content">{displayName}</p>
                          <p className="truncate text-xs text-content-secondary">Blocked · tap to manage</p>
                        </div>
                        <button
                          type="button"
                          data-chat-menu-trigger
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuThreadId((prev) => (prev === thread.id ? null : thread.id));
                          }}
                          className="rounded-full p-1.5 text-content-tertiary hover:bg-surface-hover"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuThreadId === thread.id ? (
                          <div
                            data-chat-menu
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-4 top-10 z-20 w-52 rounded-xl border border-border bg-surface p-1 shadow-xl"
                          >
                            <button
                              type="button"
                              onClick={(e) => onMenuAction(e, thread, "toggle-block")}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-content hover:bg-surface-hover"
                            >
                              <Ban className="h-4 w-4" />
                              <span>Unblock contact</span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                : null}
            </div>
          ) : null}
          </>
        )}
        {filter === "all" && !isLoading && hasMore ? (
          <div className="flex justify-center py-3 text-sm text-content-secondary">
            {isLoadingMore ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading more…
              </span>
            ) : (
              <span className="text-content-tertiary">Scroll for more</span>
            )}
          </div>
        ) : null}
      </div>
      )}
    </aside>
  );
}
