"use client";
// @ts-nocheck

import { useProductionChat } from "@/contexts/ProductionChatContext";
import {
  chatUserIdsEqual,
  getChatMessageAuthorId,
  supabaseMessagingService,
  type ChatMessage,
} from "@/features/chat/services/supabaseMessagingService";
import type {
  ChatHeaderOptionsMenuItem,
  ChatHeaderOptionsMenuSection,
} from "@/features/chat/types/chatHeaderOptionsMenu";
import { apiClient } from "@/lib/api-client";
import { useMembers, type Member } from "@/shared/hooks/useMembers";
import {
  deriveUserPresence,
  formatContactPresenceLine,
} from "@/shared/hooks/usePresence";
import { useTypingIndicator } from "@/shared/hooks/useTypingIndicator";
import {
  getPresentUserIds,
  subscribeChatPresenceSync,
} from "@/shared/services/chatPresenceRealtime";
import {
  FileUploadResult,
  fileUploadService,
} from "@/shared/services/fileUploadService";
import type { ChatParticipant, PresenceStatus } from "@/shared/types/chat";
import { isSameDay } from "date-fns";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Mic,
  MinusCircle,
  MoreVertical,
  Pencil,
  Phone,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
  Video,
  X,
  XCircle
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { toast } from "react-hot-toast";
import ChatAttachmentMenu from "./ChatAttachmentMenu";
import ChatMediaGallery from "./ChatMediaGallery";
import ChatWebcamCapture from "./ChatWebcamCapture";
import FilePreview from "./FilePreview";
import { ChatDateDivider, MessageBubble } from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

interface ChatWindowProps {
  threadId: string;
  onClose?: (threadId: string) => void;
  onMinimize?: (threadId: string) => void;
  variant?: "dock" | "page";
}

interface MessageInfoUser {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
}

interface MessageReceipt {
  user_id: string;
  read_at?: string | null;
  delivered_at?: string | null;
  user?: MessageInfoUser | null;
}

interface MessageInfoData {
  id: string;
  created_at?: string | null;
  sent_at?: string | null;
  read_count?: number;
  delivered_count?: number;
  read_receipts?: MessageReceipt[];
  delivered_receipts?: MessageReceipt[];
}

const formatMessageInfoDate = (ts?: string | null): string => {
  if (!ts) return "";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
};

const formatMessageInfoDateLabel = (ts?: string | null): string => {
  if (!ts) return "";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
};

const formatMessageInfoTimeLabel = (ts?: string | null): string => {
  if (!ts) return "";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const receiptDisplayName = (r: MessageReceipt): string =>
  r.user?.display_name || r.user?.full_name || r.user?.username || "Unknown";

const receiptInitial = (name: string): string => {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
};

function buildForwardPayload(message: ChatMessage): {
  text: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: "image" | "video" | "file";
    size: number;
    mimeType: string;
  }[];
} {
  const body = message.content?.trim() || "";
  const att = message.attachments ?? [];
  let main = body;
  if (!main && att.length > 0) {
    main = att.map((a) => `📎 ${a.name}`).join("\n");
  }
  if (!main) main = "Message";
  const text = main;
  if (!att.length) return { text };
  return {
    text,
    attachments: att.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      type: a.type,
      size: a.size,
      mimeType: a.mimeType,
    })),
  };
}

function newChatClientSendId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cs_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function sortChatWindowMessages(msgs: ChatMessage[]): ChatMessage[] {
  return [...msgs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

const MESSAGES_PAGE_SIZE = 50;

const ChatWindow: React.FC<ChatWindowProps> = ({
  threadId,
  onClose,
  onMinimize,
  variant = "dock",
}) => {
  const {
    getThreadById,
    getMessagesForThread,
    sendMessage,
    currentUser,
    callRequests,
    minimizedThreadIds,
    openThread,
    startCall,
    markThreadRead,
    clearMessagesForUser,
    markMessageDeletedForUser,
    setMessagesForThread,
    setThreadPinned,
    threads,
    startChatWithMembers,
    closeThread,
  } = useProductionChat();

  const router = useRouter();
  const pathname = usePathname();

  const { members } = useMembers();

  const [presentUserIds, setPresentUserIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!currentUser?.id) return;
    const tick = () => setPresentUserIds(new Set(getPresentUserIds()));
    tick();
    return subscribeChatPresenceSync(tick);
  }, [currentUser?.id]);

  // Typing indicator
  const { typingUserIds, handleTyping, stopTyping } = useTypingIndicator(
    threadId,
    currentUser?.id ?? null
  );

  const thread = getThreadById(threadId);
  const messages = getMessagesForThread(threadId);
  const visibleMessages = useMemo(() => {
    if (!currentUser) return messages;
    return messages.filter((message: ChatMessage) =>
      !message.deleted_for?.includes(currentUser.id)
    );
  }, [messages, currentUser?.id]);

  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchDraft, setMessageSearchDraft] = useState("");
  const [messageSearchKeyword, setMessageSearchKeyword] = useState("");
  const [searchMessages, setSearchMessages] = useState<ChatMessage[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchHasOlder, setSearchHasOlder] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const searchVisibleMessages = useMemo(() => {
    if (!currentUser) return searchMessages;
    return searchMessages.filter(
      (message: ChatMessage) => !message.deleted_for?.includes(currentUser.id)
    );
  }, [searchMessages, currentUser?.id]);

  const displayMessages = messageSearchKeyword.trim()
    ? searchVisibleMessages
    : visibleMessages;

  const forwardCandidateThreads = useMemo(() => {
    return threads
      .filter((t) => t.id !== threadId)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
      );
  }, [threads, threadId]);

  const directChatPeerIds = useMemo(() => {
    const set = new Set();
    if (!currentUser?.id) return set;
    for (const t of threads) {
      const others = t.participants.filter(
        (p: ChatParticipant) => p.id !== currentUser.id
      );
      const isGroup =
        t.type === "group" ||
        Boolean(t.group_id) ||
        others.length > 1;
      if (!isGroup && others.length === 1) {
        set.add(others[0].id);
      }
    }
    return set;
  }, [threads, currentUser?.id]);

  const pendingCall = callRequests[threadId];
  const pendingCallType = pendingCall?.type;
  const pendingRoomId = pendingCall?.roomId;
  const pendingCallerId = pendingCall?.callerId;
  const currentUserId = currentUser?.id || null;

  const otherParticipants = useMemo(
    () =>
      thread?.participants?.filter((p: any) => p.id !== currentUser?.id) || [],
    [thread?.participants, currentUser?.id]
  );
  const primaryParticipant = otherParticipants[0];

  const isSelfChat = useMemo(() => {
    return (
      thread?.participants?.length === 1 &&
      thread?.participants[0]?.id === currentUser?.id
    );
  }, [thread?.participants, currentUser?.id]);

  const isGroupThread =
    thread?.type === "group" ||
    Boolean(thread?.group_id) ||
    (thread?.participants?.length ?? 0) > 2 ||
    Boolean((thread as any)?.isGroup);

  const displayThreadName = useMemo(() => {
    if (isSelfChat) {
      return `${currentUser?.name || "You"} (Notes)`;
    }
    if (isGroupThread && thread?.name) {
      return thread.name;
    }
    return primaryParticipant?.name || thread?.name || "Chat";
  }, [isSelfChat, isGroupThread, primaryParticipant?.name, thread?.name, currentUser?.name]);

  const [headerImageFailed, setHeaderImageFailed] = useState(false);
  const [enrichedBanner, setEnrichedBanner] = useState<{
    threadId: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!threadId || !currentUser?.id || !thread) return;
    if (!isGroupThread) return;
    const existing =
      (typeof thread.banner_url === "string" && thread.banner_url.trim()) || "";
    if (existing) {
      setEnrichedBanner(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const detail = await supabaseMessagingService.fetchThreadDetail(
        currentUser.id,
        threadId
      );
      const url =
        typeof detail?.banner_url === "string" ? detail.banner_url.trim() : "";
      if (!cancelled && url) setEnrichedBanner({ threadId, url });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    threadId,
    currentUser?.id,
    thread?.id,
    isGroupThread,
    thread?.banner_url,
    thread?.type,
    thread?.group_id,
    thread?.participants?.length,
  ]);

  const groupBannerUrl =
    (typeof thread?.banner_url === "string" && thread.banner_url.trim()) ||
    (enrichedBanner?.threadId === threadId ? enrichedBanner.url : "") ||
    "";

  const headerAvatarUrl = useMemo(() => {
    if (isGroupThread && groupBannerUrl) {
      return groupBannerUrl;
    }
    if (isSelfChat) {
      const self = thread?.participants?.find((p: any) => p.id === currentUser?.id);
      return (self?.avatarUrl ?? (self as any)?.avatar_url) || undefined;
    }
    const p = primaryParticipant;
    return (p?.avatarUrl ?? (p as any)?.avatar_url) || undefined;
  }, [
    isGroupThread,
    groupBannerUrl,
    isSelfChat,
    thread?.participants,
    primaryParticipant,
    currentUser?.id,
  ]);

  useEffect(() => {
    setHeaderImageFailed(false);
  }, [headerAvatarUrl]);

  const headerAvatarAvailable = Boolean(headerAvatarUrl) && !headerImageFailed;

  const headerInitial = useMemo(() => {
    if (isSelfChat) return (currentUser?.name || "You").charAt(0).toUpperCase();
    if (isGroupThread && thread?.name) return thread.name.charAt(0).toUpperCase();
    const name = primaryParticipant?.name || thread?.name || "U";
    return name.charAt(0).toUpperCase();
  }, [isSelfChat, isGroupThread, currentUser?.name, primaryParticipant?.name, thread?.name]);

  const primaryMember = useMemo(() => {
    if (!primaryParticipant?.id) return null;
    return members.find((m) => m.id === primaryParticipant.id) ?? null;
  }, [primaryParticipant?.id, members]);

  const participantPresenceById = useMemo(() => {
    const rec: Record<string, PresenceStatus> = {};
    thread?.participants?.forEach((p: { id: string }) => {
      if (presentUserIds.has(p.id)) {
        rec[p.id] = "online";
        return;
      }
      const m = members.find((mem) => mem.id === p.id);
      rec[p.id] = m
        ? deriveUserPresence({ status: m.status, last_seen: m.last_seen })
        : "offline";
    });
    return rec;
  }, [thread?.participants, members, presentUserIds]);

  const directSubtitle = useMemo(() => {
    if (isGroupThread) return null;
    if (!primaryParticipant?.id) return null;
    if (presentUserIds.has(primaryParticipant.id)) {
      return "Online";
    }
    return formatContactPresenceLine(
      primaryMember?.status ?? null,
      primaryMember?.last_seen ?? null
    );
  }, [
    isGroupThread,
    primaryParticipant?.id,
    primaryMember?.status,
    primaryMember?.last_seen,
    presentUserIds,
  ]);

  /** `/user/[username]` accepts handle, display name, or profile id (see user profile page). */
  const peerProfileRouteSegment = useMemo(() => {
    if (isGroupThread) return null;
    if (isSelfChat) {
      if (!currentUser?.id) return null;
      const m = members.find((mem) => mem.id === currentUser.id);
      if (m?.username?.trim()) return m.username.trim();
      return currentUser.id;
    }
    if (!primaryParticipant?.id) return null;
    const fromUsername =
      primaryMember?.username?.trim() ||
      String(
        (primaryParticipant as { username?: string | null }).username ?? ""
      ).trim();
    if (fromUsername) return fromUsername;
    const fromName = primaryParticipant.name?.trim();
    if (fromName) return fromName;
    return primaryParticipant.id;
  }, [
    isGroupThread,
    isSelfChat,
    currentUser?.id,
    primaryParticipant,
    primaryMember?.username,
    members,
  ]);

  const [draft, setDraft] = useState("");
  
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [pendingFiles, setPendingFiles] = useState<FileUploadResult[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(
    null
  );
  const [forwardSearch, setForwardSearch] = useState("");
  /** WhatsApp-style: message loaded into composer for PATCH save on Send */
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const draftBeforeComposerEditRef = useRef("");
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [infoMessage, setInfoMessage] = useState<ChatMessage | null>(null);
  const [messageInfo, setMessageInfo] = useState<MessageInfoData | null>(null);
  const [messageInfoLoading, setMessageInfoLoading] = useState(false);
  const [messageInfoError, setMessageInfoError] = useState<string | null>(null);
  const userInitiatedCall = useRef(false);
  const lastIncomingCallSyncKeyRef = useRef<string>("");
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const isPrependingHistoryRef = useRef(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setHistoryPage(0);
    setHasOlderMessages(true);
    setIsLoadingOlderMessages(false);
    isPrependingHistoryRef.current = false;
    setShowMessageSearch(false);
    setMessageSearchDraft("");
    setMessageSearchKeyword("");
    setSearchMessages([]);
    setSearchPage(0);
    setSearchHasOlder(false);
    setSearchLoading(false);
    setShowMediaGallery(false);
    setEditingMessage(null);
    draftBeforeComposerEditRef.current = "";
    setForwardingMessage(null);
    setForwardSearch("");
    setInfoMessage(null);
    setMessageInfo(null);
    setMessageInfoLoading(false);
    setMessageInfoError(null);
  }, [threadId]);

  useEffect(() => {
    if (forwardingMessage) setForwardSearch("");
  }, [forwardingMessage]);

  useEffect(() => {
    if (!threadId || !messageSearchKeyword.trim()) {
      setSearchMessages([]);
      setSearchPage(0);
      setSearchHasOlder(false);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    const kw = messageSearchKeyword.trim();
    setSearchLoading(true);
    void (async () => {
      try {
        const { messages: found, hasMore } = await supabaseMessagingService.getThreadMessages(threadId, {
          limit: MESSAGES_PAGE_SIZE,
          page: 0,
          keyword: kw,
        });
        if (cancelled) return;
        setSearchMessages(found);
        setSearchPage(0);
        setSearchHasOlder(hasMore);
      } catch (e) {
        console.error("Message search failed:", e);
        if (!cancelled) {
          setSearchMessages([]);
          setSearchHasOlder(false);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, messageSearchKeyword]);

  const loadOlderMessages = useCallback(async () => {
    if (!threadId || isLoadingOlderMessages) return;
    const scrollEl = messagesScrollRef.current;
    if (!scrollEl) return;

    const keyword = messageSearchKeyword.trim();
    if (keyword) {
      if (!searchHasOlder) return;
    } else if (!hasOlderMessages) {
      return;
    }

    setIsLoadingOlderMessages(true);
    const prevScrollHeight = scrollEl.scrollHeight;
    const prevScrollTop = scrollEl.scrollTop;

    try {
      if (keyword) {
        const nextPage = searchPage + 1;
        const { messages: olderMessages, hasMore } = await supabaseMessagingService.getThreadMessages(threadId, {
          page: nextPage,
          limit: MESSAGES_PAGE_SIZE,
          keyword,
        });

        if (!olderMessages.length) {
          setSearchHasOlder(false);
          return;
        }
        if (!hasMore) {
          setSearchHasOlder(false);
        }

        isPrependingHistoryRef.current = true;
        setSearchMessages((prev) => {
          const mergedMap = new Map<string, ChatMessage>();
          prev.forEach((msg) => mergedMap.set(msg.id, msg));
          olderMessages.forEach((msg) => mergedMap.set(msg.id, msg));
          return Array.from(mergedMap.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
        setSearchPage(nextPage);

        requestAnimationFrame(() => {
          const node = messagesScrollRef.current;
          if (!node) return;
          const heightDiff = node.scrollHeight - prevScrollHeight;
          node.scrollTop = prevScrollTop + heightDiff;
          isPrependingHistoryRef.current = false;
        });
      } else {
        const nextPage = historyPage + 1;
        const { messages: olderMessages, hasMore } = await supabaseMessagingService.getThreadMessages(threadId, {
          page: nextPage,
          limit: MESSAGES_PAGE_SIZE,
        });

        if (!olderMessages.length) {
          setHasOlderMessages(false);
          return;
        }
        if (!hasMore) {
          setHasOlderMessages(false);
        }

        const currentMessages = getMessagesForThread(threadId);
        const mergedMap = new Map<string, ChatMessage>();
        currentMessages.forEach((msg: ChatMessage) => mergedMap.set(msg.id, msg));
        olderMessages.forEach((msg: ChatMessage) => mergedMap.set(msg.id, msg));
        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        isPrependingHistoryRef.current = true;
        setMessagesForThread(threadId, merged);
        setHistoryPage(nextPage);

        requestAnimationFrame(() => {
          const node = messagesScrollRef.current;
          if (!node) return;
          const heightDiff = node.scrollHeight - prevScrollHeight;
          node.scrollTop = prevScrollTop + heightDiff;
          isPrependingHistoryRef.current = false;
        });
      }
    } catch (error) {
      console.error("Error loading older messages:", error);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [
    threadId,
    isLoadingOlderMessages,
    hasOlderMessages,
    historyPage,
    messageSearchKeyword,
    searchHasOlder,
    searchPage,
    getMessagesForThread,
    setMessagesForThread,
  ]);

  const menuRef = useRef<HTMLDivElement>(null);
  const clearChatInFlightRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowOptionsMenu(false);
      }
    };

    if (showOptionsMenu) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showOptionsMenu]);

  useEffect(() => {
    if (pendingCallType) {
      const initiatedByCurrentUser = Boolean(
        pendingCallerId && currentUserId && pendingCallerId === currentUserId
      );

      if (!initiatedByCurrentUser) {
        const syncKey = `${threadId}:${pendingCall?.callId || ""}:${pendingRoomId || ""}`;
        if (lastIncomingCallSyncKeyRef.current === syncKey) {
          return;
        }
        lastIncomingCallSyncKeyRef.current = syncKey;
      }
    }
  }, [
    pendingCallType,
    pendingRoomId,
    pendingCallerId,
    pendingCall?.callId,
    threadId,
    currentUserId,
  ]);

  useEffect(() => {
    if (thread && !minimizedThreadIds.includes(threadId)) {
      void markThreadRead(threadId);
    }
  }, [threadId, thread, minimizedThreadIds, messages.length, markThreadRead]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el || displayMessages.length === 0) return;
    if (isPrependingHistoryRef.current) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }, [threadId, displayMessages.length]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollTop <= 32) {
        void loadOlderMessages();
      }
    };

    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [loadOlderMessages]);

  useEffect(() => {
    if (!attachmentMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachmentMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [attachmentMenuOpen]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === "recording") {
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const closeMessageSearch = () => {
    setShowMessageSearch(false);
    setMessageSearchDraft("");
    setMessageSearchKeyword("");
    setSearchMessages([]);
    setSearchPage(0);
    setSearchHasOlder(false);
    setSearchLoading(false);
  };

  const openMessageSearchFromMenu = () => {
    setShowMessageSearch(true);
    setShowOptionsMenu(false);
  };

  const clearMessageSearch = () => {
    setMessageSearchDraft("");
    setMessageSearchKeyword("");
    setSearchMessages([]);
    setSearchPage(0);
    setSearchHasOlder(false);
    setSearchLoading(false);
  };

  const applyMessageSearch = () => {
    const trimmed = messageSearchDraft.trim();
    setMessageSearchKeyword(trimmed);
    if (!trimmed) {
      setSearchMessages([]);
      setSearchHasOlder(false);
      setSearchLoading(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSending) return;

    if (editingMessage) {
      const text = draft.trim();
      if (!text) return;
      if (pendingFiles.length > 0) {
        toast.error("Remove attachments before saving an edited message.");
        return;
      }
      setIsSending(true);
      try {
        const updated = await supabaseMessagingService.updateMessage(
          threadId,
          editingMessage.id,
          text
        );
        const msgs = getMessagesForThread(threadId);
        setMessagesForThread(
          threadId,
          msgs.map((m) => (m.id === editingMessage.id ? updated : m))
        );
        setEditingMessage(null);
        draftBeforeComposerEditRef.current = "";
        setDraft("");
        stopTyping();
      } catch {
        toast.error("Could not update message");
      } finally {
        setIsSending(false);
      }
      return;
    }

    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;

    const filesSnapshot = [...pendingFiles];
    const replyTarget = replyingTo;
    let prependSendId: string | undefined;

    if (filesSnapshot.length > 0 && currentUser) {
      prependSendId = newChatClientSendId();
      const optimisticId = `optimistic:${prependSendId}`;
      const optimisticAttachments = filesSnapshot.map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        type: f.type,
        size: f.size,
        mimeType: f.mimeType,
      }));
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        thread_id: threadId,
        sender_id: currentUser.id,
        content: text,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_type: "text",
        metadata: { __clientSendId: prependSendId },
        read_by: [currentUser.id],
        is_deleted: false,
        is_edited: false,
        attachments: optimisticAttachments,
        sender: {
          id: currentUser.id,
          name: currentUser.name || "You",
          avatarUrl: currentUser.avatarUrl,
        },
        reply_to_id: replyTarget?.id,
        reactions: [],
      };
      setMessagesForThread(
        threadId,
        sortChatWindowMessages([...getMessagesForThread(threadId), optimisticMessage])
      );
    }

    setDraft("");
    setPendingFiles([]);
    setReplyingTo(null);
    stopTyping();

    setIsSending(true);
    try {
      let uploadedAttachments = filesSnapshot;

      if (filesSnapshot.length > 0) {
        try {
          uploadedAttachments = await fileUploadService.uploadFiles(filesSnapshot);
        } catch (uploadError: any) {
          toast.error(uploadError.message || "Failed to upload files");
          if (prependSendId) {
            const msgs = getMessagesForThread(threadId).filter(
              (m) =>
                !(
                  m.id.startsWith("optimistic:") &&
                  (m.metadata as Record<string, unknown> | undefined)?.__clientSendId ===
                    prependSendId
                )
            );
            setMessagesForThread(threadId, msgs);
          }
          fileUploadService.revokePreviews(filesSnapshot);
          setIsSending(false);
          return;
        }
      }

      await sendMessage(threadId, text, {
        content: text,
        attachments: uploadedAttachments.map((f) => ({
          id: f.id,
          name: f.name,
          url: f.url,
          type: f.type,
          size: f.size,
          mimeType: f.mimeType,
        })),
        reply_to_id: replyTarget?.id,
        ...(prependSendId
          ? {
              metadata: { __clientSendId: prependSendId },
              skipContextOptimistic: true,
            }
          : {}),
      });

      fileUploadService.revokePreviews(filesSnapshot);
    } catch (error: any) {
      toast.error("Failed to send message");
      if (prependSendId) {
        const msgs = getMessagesForThread(threadId).filter(
          (m) =>
            !(
              m.id.startsWith("optimistic:") &&
              (m.metadata as Record<string, unknown> | undefined)?.__clientSendId ===
                prependSendId
            )
        );
        setMessagesForThread(threadId, msgs);
      }
      fileUploadService.revokePreviews(filesSnapshot);
    } finally {
      setIsSending(false);
    }
  };

  const cancelComposerEdit = useCallback(() => {
    setEditingMessage(null);
    setDraft(draftBeforeComposerEditRef.current);
    draftBeforeComposerEditRef.current = "";
  }, []);

  const beginComposerEdit = useCallback((message: ChatMessage) => {
    draftBeforeComposerEditRef.current = draft;
    setEditingMessage(message);
    setReplyingTo(null);
    setForwardingMessage(null);
    fileUploadService.revokePreviews(pendingFiles);
    setPendingFiles([]);
    setAttachmentMenuOpen(false);
    setDraft(message.content ?? "");
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
      composerInputRef.current?.select?.();
    });
  }, [draft, pendingFiles]);

  useEffect(() => {
    if (!editingMessage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelComposerEdit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingMessage, cancelComposerEdit]);

  useEffect(() => {
    if (!forwardingMessage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setForwardingMessage(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [forwardingMessage]);

  const handleReply = (message: ChatMessage) => {
    if (editingMessage) {
      const restore = draftBeforeComposerEditRef.current;
      draftBeforeComposerEditRef.current = "";
      setEditingMessage(null);
      setDraft(restore);
    }
    setForwardingMessage(null);
    setReplyingTo(message);
  };

  const openForwardPicker = useCallback((message: ChatMessage) => {
    if (editingMessage) {
      const restore = draftBeforeComposerEditRef.current;
      draftBeforeComposerEditRef.current = "";
      setEditingMessage(null);
      setDraft(restore);
    }
    setReplyingTo(null);
    setForwardingMessage(message);
  }, [editingMessage]);

  const cancelForwardPicker = useCallback(() => {
    setForwardingMessage(null);
    setForwardSearch("");
  }, []);

  const sendForwardedToThread = useCallback(
    async (targetThreadId: string) => {
      if (!forwardingMessage) return;
      const payload = buildForwardPayload(forwardingMessage);
      setForwardingMessage(null);
      setForwardSearch("");
      setIsSending(true);
      try {
        await sendMessage(targetThreadId, payload.text, {
          attachments: payload.attachments,
          is_forward: true,
        });
        toast.success("Message forwarded");
        void openThread(targetThreadId);
      } catch {
        toast.error("Could not forward message");
      } finally {
        setIsSending(false);
      }
    },
    [forwardingMessage, sendMessage, openThread]
  );

  const forwardSearchLower = forwardSearch.trim().toLowerCase();

  const filteredForwardThreads = useMemo(() => {
    if (!forwardSearchLower) return forwardCandidateThreads;
    return forwardCandidateThreads.filter((t) => {
      const otherParticipants = t.participants.filter(
        (p: ChatParticipant) => p.id !== currentUser?.id
      );
      const primary = otherParticipants[0] ?? t.participants[0];
      const isGroup =
        t.type === "group" ||
        Boolean(t.group_id) ||
        otherParticipants.length > 1;
      const label = (
        isGroup && t.name ? t.name : primary?.name || t.name || "Conversation"
      ).toLowerCase();
      const preview = (t.last_message_preview || "").toLowerCase();
      return (
        label.includes(forwardSearchLower) ||
        preview.includes(forwardSearchLower)
      );
    });
  }, [forwardCandidateThreads, forwardSearchLower, currentUser?.id]);

  const filteredForwardContacts = useMemo(() => {
    let list = members.filter(
      (m) => m.id !== currentUser?.id && !directChatPeerIds.has(m.id)
    );
    list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (forwardSearchLower) {
      list = list.filter((m) => {
        const n = m.name.toLowerCase();
        const u = (m.username || "").toLowerCase();
        return (
          n.includes(forwardSearchLower) || u.includes(forwardSearchLower)
        );
      });
    }
    return list;
  }, [members, currentUser?.id, directChatPeerIds, forwardSearchLower]);

  const forwardToMember = useCallback(
    async (member: Member) => {
      if (!forwardingMessage) return;
      const payload = buildForwardPayload(forwardingMessage);
      setForwardingMessage(null);
      setForwardSearch("");
      setIsSending(true);
      try {
        const participant: ChatParticipant = {
          id: member.id,
          name: member.name,
          avatarUrl: member.avatar_url,
        };
        const newThreadId = await startChatWithMembers([participant], {
          participant_ids: [member.id],
          openInDock: false,
        });
        if (!newThreadId) throw new Error("no thread");
        await sendMessage(newThreadId, payload.text, {
          attachments: payload.attachments,
          is_forward: true,
        });
        toast.success("Message forwarded");
        void openThread(newThreadId);
      } catch {
        toast.error("Could not forward message");
      } finally {
        setIsSending(false);
      }
    },
    [forwardingMessage, startChatWithMembers, sendMessage, openThread]
  );

  const handleDelete = async (
    messageId: string,
    deleteForEveryone: boolean
  ) => {
    if (!currentUser) return;

    try {
      if (deleteForEveryone) {
        await supabaseMessagingService.deleteMessageForEveryone(
          threadId,
          messageId,
          currentUser.id
        );
        toast.success("Message deleted for everyone");
      } else {
        await supabaseMessagingService.deleteMessageForMe(
          threadId,
          messageId,
          currentUser.id
        );
        markMessageDeletedForUser(threadId, messageId, currentUser.id);
        toast.success("Message deleted for you");
      }
    } catch (error) {
      toast.error(
        deleteForEveryone
          ? "Failed to delete message for everyone"
          : "Failed to delete message"
      );
    }
  };

  const handleMessageReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    try {
      const data = await apiClient.post<{
        action: string;
        emoji: string;
        reactions: { emoji: string; count: number; user_reacted: boolean }[];
        totalCount: number;
      }>(`/api/chat/threads/${threadId}/messages/${messageId}/reactions`, { emoji });
      const msgs = getMessagesForThread(threadId);
      setMessagesForThread(
        threadId,
        msgs.map((m) =>
          m.id === messageId ? { ...m, reactions: data.reactions } : m
        )
      );
    } catch {
      toast.error("Could not update reaction");
    }
  };

  const openMessageInfo = useCallback(
    async (message: ChatMessage) => {
      setInfoMessage(message);
      setMessageInfo(null);
      setMessageInfoError(null);
      setMessageInfoLoading(true);
      try {
        const data = await apiClient.get<MessageInfoData>(
          `/api/chat/threads/${threadId}/messages/${message.id}/info`
        );
        setMessageInfo(data);
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message: string }).message)
            : "Failed to load message info";
        setMessageInfoError(msg);
      } finally {
        setMessageInfoLoading(false);
      }
    },
    [threadId]
  );

  const handlePinToggle = async () => {
    if (!thread) return;
    const nextPinned = !thread.pinned;
    try {
      await setThreadPinned(threadId, nextPinned);
      toast.success(nextPinned ? "Chat pinned" : "Chat unpinned");
      setShowOptionsMenu(false);
    } catch {
      toast.error("Could not update pin");
    }
  };

  const handleClearAllMessages = async () => {
    if (!currentUser) return;
    if (clearChatInFlightRef.current) return;

    const confirmed = window.confirm(
      "Are you sure you want to clear all messages in this chat? This will only clear them for you."
    );

    if (!confirmed) return;

    clearChatInFlightRef.current = true;
    let prevMessagesForThread: ChatMessage[] | null = null;
    try {
      prevMessagesForThread = getMessagesForThread(threadId);

      clearMessagesForUser(threadId, currentUser.id);

      await supabaseMessagingService.clearThreadMessagesForMe(
        threadId,
        currentUser.id
      );

      toast.success("All messages cleared");
      setShowOptionsMenu(false);
    } catch {
      if (prevMessagesForThread) {
        setMessagesForThread(threadId, prevMessagesForThread);
      }
      toast.error("Failed to clear messages");
    } finally {
      clearChatInFlightRef.current = false;
    }
  };

  const handleStartCall = async (type: "audio" | "video") => {
    try {
      userInitiatedCall.current = true;
      await startCall(threadId, type, primaryParticipant?.id, primaryParticipant?.name, primaryParticipant?.avatarUrl);
    } catch (error) {
      userInitiatedCall.current = false;
    }
  };


  const handleFilesSelected = (files: FileUploadResult[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
    setAttachmentMenuOpen(false);
  };

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const startVoiceRecording = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording is not supported here");
      return;
    }
    if (voiceRecording || isSending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];
      const mime =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size) mediaChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        void (async () => {
          const mimeType = mr.mimeType || "audio/webm";
          stopMediaStream();
          mediaRecorderRef.current = null;
          setVoiceRecording(false);
          const chunks = mediaChunksRef.current;
          mediaChunksRef.current = [];
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size < 400) {
            if (blob.size > 0) toast.error("Voice message too short");
            return;
          }
          const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "webm";
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
          setIsSending(true);
          let prependSendId: string | undefined;
          let results: FileUploadResult[] = [];
          try {
            results = await fileUploadService.fromFiles([file]);
            if (currentUser) {
              prependSendId = newChatClientSendId();
              const optimisticId = `optimistic:${prependSendId}`;
              const optimisticAttachments = results.map((f) => ({
                id: f.id,
                name: f.name,
                url: f.url,
                type: f.type,
                size: f.size,
                mimeType: f.mimeType,
              }));
              const optimisticMessage: ChatMessage = {
                id: optimisticId,
                thread_id: threadId,
                sender_id: currentUser.id,
                content: "",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                message_type: "text",
                metadata: { __clientSendId: prependSendId },
                read_by: [currentUser.id],
                is_deleted: false,
                is_edited: false,
                attachments: optimisticAttachments,
                sender: {
                  id: currentUser.id,
                  name: currentUser.name || "You",
                  avatarUrl: currentUser.avatarUrl,
                },
                reactions: [],
              };
              setMessagesForThread(
                threadId,
                sortChatWindowMessages([...getMessagesForThread(threadId), optimisticMessage])
              );
            }
            const uploaded = await fileUploadService.uploadFiles(results);
            await sendMessage(threadId, "", {
              content: "",
              attachments: uploaded.map((f) => ({
                id: f.id,
                name: f.name,
                url: f.url,
                type: f.type,
                size: f.size,
                mimeType: f.mimeType,
              })),
              ...(prependSendId
                ? {
                    metadata: { __clientSendId: prependSendId },
                    skipContextOptimistic: true,
                  }
                : {}),
            });
            fileUploadService.revokePreviews(results);
            stopTyping();
          } catch (err: any) {
            toast.error(err?.message || "Failed to send voice message");
            if (prependSendId) {
              const msgs = getMessagesForThread(threadId).filter(
                (m) =>
                  !(
                    m.id.startsWith("optimistic:") &&
                    (m.metadata as Record<string, unknown> | undefined)?.__clientSendId ===
                      prependSendId
                  )
              );
              setMessagesForThread(threadId, msgs);
            }
            if (results.length > 0) {
              try {
                fileUploadService.revokePreviews(results);
              } catch {
                /* ignore */
              }
            }
          } finally {
            setIsSending(false);
          }
        })();
      };
      mr.start(100);
      setVoiceRecording(true);
    } catch {
      toast.error("Microphone access denied or unavailable");
    }
  };

  const toggleVoiceRecording = () => {
    const mr = mediaRecorderRef.current;
    if (voiceRecording && mr && mr.state === "recording") {
      mr.stop();
      return;
    }
    void startVoiceRecording();
  };

  const showSendButton =
    editingMessage !== null
      ? true
      : draft.trim().length > 0 || pendingFiles.length > 0;

  const composerSendDisabled =
    editingMessage !== null && draft.trim().length === 0;

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const target = prev[index];
      if (target) {
        fileUploadService.revokePreviews([target]);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleOpenThreadDetailPage = useCallback(() => {
    if (!threadId?.trim()) return;
    openThread(threadId);

    const href = isGroupThread
      ? `/chat/${encodeURIComponent(threadId)}`
      : peerProfileRouteSegment
        ? `/user/${encodeURIComponent(peerProfileRouteSegment)}`
        : null;
    if (!href) return;

    const pathsEqual = (a: string, b: string) => {
      if (a === b) return true;
      try {
        return decodeURIComponent(a) === decodeURIComponent(b);
      } catch {
        return false;
      }
    };
    if (pathsEqual(pathname, href)) return;
    router.push(href);
  }, [
    threadId,
    openThread,
    pathname,
    router,
    isGroupThread,
    peerProfileRouteSegment,
  ]);



  const handleCloseChatFromMenu = useCallback(() => {
    setShowOptionsMenu(false);
    closeThread(threadId);
    if (variant === "page") router.push("/chat");
  }, [threadId, closeThread, variant, router]);

  const handleDeleteChatFromMenu = useCallback(() => {
    if (!window.confirm("Remove this chat from your chats list?")) return;
    setShowOptionsMenu(false);
    closeThread(threadId);
    if (variant === "page") router.push("/chat");
    toast.success("Chat removed");
  }, [threadId, closeThread, variant, router]);



  const chatHeaderOptionsMenuSections = useMemo((): ChatHeaderOptionsMenuSection[] => {

    const primary: ChatHeaderOptionsMenuItem[] = [
      {
        id: "contact",
        label: "Contact info",
        Icon: Info,
        onClick: () => {
          setShowOptionsMenu(false);
          handleOpenThreadDetailPage();
        },
      },
      {
        id: "search",
        label: "Search",
        Icon: Search,
        onClick: () => openMessageSearchFromMenu(),
      },


      {
        id: "pin",
        label: thread?.pinned ? "Unpin chat" : "Pin chat",
        Icon: thread?.pinned ? PinOff : Pin,
        onClick: () => void handlePinToggle(),
      },

      {
        id: "close",
        label: "Close chat",
        Icon: XCircle,
        onClick: () => void handleCloseChatFromMenu(),
      },
    ];

    const destructive: ChatHeaderOptionsMenuItem[] = [

      {
        id: "clear",
        label: "Clear chat",
        Icon: MinusCircle,
        disabled: visibleMessages.length === 0,
        onClick: () => void handleClearAllMessages(),
      },
      {
        id: "delete",
        label: "Delete chat",
        Icon: Trash2,
        tone: "danger",
        onClick: () => void handleDeleteChatFromMenu(),
      },
    ];

    return [
      { id: "primary", items: primary },
      { id: "destructive", items: destructive },
    ];
  }, [
    thread?.pinned,
    visibleMessages.length,
    openMessageSearchFromMenu,
    handleOpenThreadDetailPage,
    handlePinToggle,
    handleClearAllMessages,
    handleCloseChatFromMenu,
    handleDeleteChatFromMenu,
  ]);

  const isPageVariant = variant === "page";

  return (
    <div
      className={`pointer-events-auto relative flex max-w-full flex-col   ${isPageVariant
          ? "h-full w-full "
          : "w-72 rounded-2xl sm:w-80 sm:max-w-full"
        }`}
    >
      <div
        className={`flex items-center justify-between border-b border-gray-200 bg-[#f7f8fa] p-2 ${isPageVariant ? "" : "rounded-tl-2xl rounded-tr-2xl"
          }`}
      >
        <div className="flex items-center space-x-3">
          <div className="relative h-10 w-10">
            {headerAvatarAvailable ? (
              <img
                src={headerAvatarUrl}
                alt={displayThreadName}
                className="h-10 w-10 rounded-full object-cover"
                onError={() => setHeaderImageFailed(true)}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                {headerInitial}
              </div>
            )}
          </div>
          <div className="cursor-pointer" onClick={handleOpenThreadDetailPage}
          >
            <div className="text-sm font-semibold text-gray-900 line-clamp-1" >
              {displayThreadName}
            </div>
            <button
              type="button"
              className="block w-full text-left text-xs text-gray-500 hover:text-gray-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
            >
              {isSelfChat
                ? "Save messages to yourself"
                : (thread?.participants?.length ?? 0) > 2
                  ? `${thread?.participants?.length} participants`
                  : (directSubtitle ?? "Offline")}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStartCall("audio")}
            className="text-gray-500 hover:text-[#f97316] transition"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleStartCall("video")}
            className="text-gray-500 hover:text-[#f97316]"
          >
            <Video className="h-5 w-5" />
          </button>


          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowOptionsMenu((open) => !open);
              }}
              className="text-gray-400 hover:text-gray-600"
              aria-expanded={showOptionsMenu}
              aria-haspopup="menu"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showOptionsMenu && (
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 top-full mt-1 z-50 min-w-[240px] rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
              >
                {chatHeaderOptionsMenuSections.map((section, sectionIdx) => (
                  <React.Fragment key={section.id}>
                    {sectionIdx > 0 ? (
                      <div
                        role="separator"
                        className="my-1 border-t border-gray-200 dark:border-gray-600"
                      />
                    ) : null}
                    {section.items.map((item) => {
                      const {
                        id,
                        label,
                        Icon,
                        tone = "default",
                        trailing,
                        disabled,
                        onClick,
                      } = item;
                      const baseRow =
                        "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] leading-snug";
                      const rowClass =
                        disabled
                          ? `${baseRow} cursor-not-allowed text-gray-400 opacity-60`
                          : tone === "danger"
                            ? `${baseRow} text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700/80`
                            : `${baseRow} text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700/80`;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="menuitem"
                          disabled={disabled}
                          onClick={onClick}
                          className={rowClass}
                        >
                          <Icon className="h-[22px] w-[22px] shrink-0 opacity-90" />
                          <span className="min-w-0 flex-1">{label}</span>
                          {trailing ? (
                            <span className="shrink-0">{trailing}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>



      {showMessageSearch && (
        <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-1.5 py-1.5">
          <button
            type="button"
            onClick={closeMessageSearch}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-gray-200/80"
            aria-label="Close search"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <input
            type="search"
            value={messageSearchDraft}
            onChange={(e) => setMessageSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyMessageSearch();
              }
            }}
            placeholder="Search…"
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-orange-200"
            aria-label="Search messages in this chat"
          />
          <button
            type="button"
            onClick={applyMessageSearch}
            className="shrink-0 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
          >
            Find
          </button>
          {(messageSearchDraft.trim() || messageSearchKeyword.trim()) && (
            <button
              type="button"
              onClick={clearMessageSearch}
              className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div
        ref={messagesScrollRef}
        className={`flex flex-col space-y-3 overflow-y-auto bg-[#f7f8fa] px-3 py-2 sm:space-y-4 sm:px-4 sm:py-3 ${isPageVariant ? "h-[calc(100vh-16rem)] sm:h-[calc(100vh-14rem)]" : "h-[250px] sm:h-[290px]"
          }`}
      >
        {isLoadingOlderMessages && (
          <div className="py-1 text-center text-xs text-gray-500">
            {messageSearchKeyword.trim() ? "Loading older matches..." : "Loading older messages..."}
          </div>
        )}
        {searchLoading && messageSearchKeyword.trim() ? (
          <div className="py-12 text-center text-sm text-gray-500">Searching messages...</div>
        ) : displayMessages.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            {messageSearchKeyword.trim()
              ? `No messages match "${messageSearchKeyword.trim()}".`
              : "Send a message to kick off the conversation."}
          </div>
        ) : (
          displayMessages.map((message: ChatMessage, index: number) => {
            const isOwn = chatUserIdsEqual(
              getChatMessageAuthorId(message),
              currentUser?.id
            );
            const prev = displayMessages[index - 1];
            const showDateDivider =
              !prev ||
              !isSameDay(
                new Date(prev.created_at),
                new Date(message.created_at)
              );

            return (
              <Fragment key={message.id}>
                {showDateDivider ? (
                  <ChatDateDivider dateIso={message.created_at} />
                ) : null}
                <MessageBubble
                  message={message}
                  isOwnMessage={isOwn}
                  currentUserId={currentUser?.id || ""}
                  threadParticipants={
                    thread?.participants?.map((p: ChatParticipant) => p.id) || []
                  }
                  participantPresence={participantPresenceById}
                  onReply={handleReply}
                  onForward={openForwardPicker}
                  onDelete={handleDelete}
                  onBeginEdit={beginComposerEdit}
                  composerEditingMessageId={editingMessage?.id ?? null}
                  onReact={handleMessageReaction}
                  onShowInfo={(msg) => void openMessageInfo(msg)}
                />
              </Fragment>
            );
          })
        )}
        <div aria-hidden="true" />
      </div>

      <TypingIndicator isTyping={typingUserIds.length > 0} />

      {pendingFiles.length > 0 && !editingMessage && (
        <div className="border-t border-gray-100 px-4 pb-3">
          <FilePreview files={pendingFiles} onRemove={removePendingFile} />
        </div>
      )}

      <form
        onSubmit={handleSend}
        className={`border-t border-gray-200 bg-[#f7f8fa] px-2 py-2 sm:px-3 sm:py-3 ${isPageVariant ? "sm:rounded-b-2xl" : "rounded-bl-2xl rounded-br-2xl"
          }`}
      >
        {editingMessage ? (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/90 dark:border-orange-900/70 dark:bg-orange-950/45 px-2.5 py-2 border-l-[3px] border-l-teal-500 dark:border-l-teal-500">
            <Pencil className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
                Editing message
              </div>
              <div className="text-xs text-teal-900/85 dark:text-teal-100/80 truncate mt-0.5 font-medium">
                {editingMessage.is_deleted ? (
                  "This message was deleted"
                ) : (
                  editingMessage.content?.replace(/\s+/g, " ").trim() || "Media"
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={cancelComposerEdit}
              className="flex-shrink-0 rounded-full p-1 text-teal-800 hover:bg-amber-100 dark:text-teal-200 dark:hover:bg-orange-900/60 transition"
              aria-label="Discard edit"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : replyingTo ? (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-2 border-l-4 border-orange-500">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Replying to {replyingTo.sender?.name || "Unknown"}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {replyingTo.is_deleted
                  ? "🚫 This message was deleted"
                  : replyingTo.content}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="flex-shrink-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="Cancel reply"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {voiceRecording && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording… tap the stop button to send
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <div className="relative flex-shrink-0" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => !editingMessage && setAttachmentMenuOpen((o) => !o)}
              disabled={!!editingMessage}
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[#54656f] hover:bg-black/5 disabled:pointer-events-none disabled:opacity-40 ${attachmentMenuOpen ? "ring-1 ring-[#25d366] text-[#128c7e]" : ""
                }`}
              aria-label="Attach"
              aria-expanded={attachmentMenuOpen}
              title={
                editingMessage
                  ? "Finish editing before attaching files"
                  : undefined
              }
            >
              <Plus className="h-5 w-5" />
            </button>
            {attachmentMenuOpen && (
              <ChatAttachmentMenu
                onFilesSelected={handleFilesSelected}
                onClose={() => setAttachmentMenuOpen(false)}
                onOpenCamera={() => setWebcamOpen(true)}
              />
            )}
          </div>
          <input
            ref={composerInputRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              handleTyping();
            }}
            placeholder={editingMessage ? "Edit message" : "Message"}
            aria-label={
              editingMessage ? "Editing message — press Escape to discard" : "Message input"
            }
            className="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#d1d7db] focus:outline-none "
          />
          {showSendButton ? (
            <button
              type="submit"
              disabled={isSending || composerSendDisabled}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white hover:bg-[#22c55e] active:bg-[#22c55e] disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9"
              aria-label={
                editingMessage ? "Done editing — save changes" : "Send message"
              }
            >
              {isSending ? (
                <svg className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Send className="h-5 w-5 sm:h-4 sm:w-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleVoiceRecording}
              disabled={isSending || !!editingMessage}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 ${voiceRecording
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-primary-600 hover:bg-primary-700"
                }`}
              aria-label={voiceRecording ? "Stop recording" : "Voice message"}
              title={
                editingMessage
                  ? "Finish editing before sending a voice message"
                  : voiceRecording
                    ? "Stop and send"
                    : "Voice message"
              }
            >
              {voiceRecording ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
              )}
            </button>
          )}
        </div>
      </form>

      <ChatWebcamCapture
        isOpen={webcamOpen}
        onClose={() => setWebcamOpen(false)}
        onCaptured={handleFilesSelected}
      />

      <ChatMediaGallery
        threadId={threadId}
        open={showMediaGallery}
        onClose={() => setShowMediaGallery(false)}
        isGroupChat={isGroupThread}
      />

      {infoMessage ? (
        <div
          className="absolute inset-0 z-[95] flex flex-col overflow-hidden rounded-2xl bg-white"
          role="dialog"
          aria-modal="true"
          aria-label="Message info"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-800 px-2 py-2 text-white">
            <button
              type="button"
              onClick={() => {
                setInfoMessage(null);
                setMessageInfo(null);
                setMessageInfoError(null);
                setMessageInfoLoading(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <CheckCheck className="h-5 w-5 shrink-0 opacity-90" />
              <span className="truncate text-sm font-semibold">Message info</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-3 py-3">
            {messageInfoLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-gray-500">
                <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
                <span className="text-xs">Loading message info…</span>
              </div>
            ) : messageInfoError ? (
              <div className="py-4 text-center text-xs text-red-600">{messageInfoError}</div>
            ) : (
              <>
                <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="mb-1 text-[11px] font-semibold text-gray-500">
                    Message
                  </div>
                  <div className="mb-2 flex justify-end">
                    <div className="max-w-[85%] rounded-xl rounded-br-sm bg-emerald-500 px-3 py-2 text-sm text-white">
                      {(infoMessage.content || "Media message").trim()}
                      <div className="mt-1 text-right text-[11px] text-emerald-100">
                        {formatMessageInfoTimeLabel(messageInfo?.sent_at || messageInfo?.created_at) ||
                          "--:--"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-0.5 text-xs text-gray-600">
                    <div>
                      Sent:{" "}
                      {formatMessageInfoDate(messageInfo?.sent_at || messageInfo?.created_at) || "-"}
                    </div>
                    <div>Read by: {messageInfo?.read_count ?? 0}</div>
                    <div>Delivered to: {messageInfo?.delivered_count ?? 0}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-emerald-700">Read by</h3>
                    <CheckCheck className="h-4 w-4 text-emerald-700" />
                  </div>
                  {(messageInfo?.read_receipts ?? []).length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
                      No reads yet
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                      {(messageInfo?.read_receipts ?? []).map((r) => (
                        <div
                          key={`read-${r.user_id}`}
                          className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-xs font-semibold text-fuchsia-700">
                            {receiptInitial(receiptDisplayName(r))}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {receiptDisplayName(r)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatMessageInfoDateLabel(r.read_at)}{" "}
                              {formatMessageInfoTimeLabel(r.read_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-emerald-700">Delivered to</h3>
                    <CheckCheck className="h-4 w-4 text-emerald-700" />
                  </div>
                  {(messageInfo?.delivered_receipts ?? []).length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
                      Everyone has read this message
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                      {(messageInfo?.delivered_receipts ?? []).map((r) => (
                        <div
                          key={`delivered-${r.user_id}`}
                          className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
                            {receiptInitial(receiptDisplayName(r))}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {receiptDisplayName(r)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatMessageInfoDateLabel(r.delivered_at)}{" "}
                              {formatMessageInfoTimeLabel(r.delivered_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {forwardingMessage ? (
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Forward message"
          onClick={cancelForwardPicker}
        >
          <div
            className="flex h-[min(88vh,640px)] w-full max-w-md flex-col rounded-t-2xl border border-gray-200 bg-[#f0f2f5] shadow-2xl dark:border-gray-700 dark:bg-[#0b141a] sm:h-[min(560px,85vh)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-1 border-b border-gray-200/80 bg-[#f0f2f5] px-1 py-2 dark:border-gray-800 dark:bg-[#202c33]">
              <button
                type="button"
                onClick={cancelForwardPicker}
                className="rounded-full p-2 text-[#111b21] hover:bg-black/5 dark:text-[#e9edef] dark:hover:bg-white/10"
                aria-label="Back"
              >
                <ChevronLeft className="h-7 w-7" strokeWidth={2} />
              </button>
              <h2 className="text-lg font-medium text-[#111b21] dark:text-[#e9edef]">
                Forward message to
              </h2>
            </div>

            <div className="shrink-0 border-b border-gray-200/80 bg-[#f0f2f5] px-3 pb-3 pt-1 dark:border-gray-800 dark:bg-[#202c33]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={forwardSearch}
                  onChange={(e) => setForwardSearch(e.target.value)}
                  placeholder="Search contacts…"
                  className="w-full rounded-lg border-0 bg-white py-2.5 pl-10 pr-3 text-sm text-[#111b21] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:bg-[#2a3942] dark:text-[#e9edef] dark:placeholder:text-gray-500"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-[#0b141a]">
              {filteredForwardThreads.length === 0 &&
                filteredForwardContacts.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {forwardSearchLower
                    ? "No contacts or chats match your search."
                    : "No other chats yet. Add contacts below will start a new chat when you forward."}
                </div>
              ) : null}

              {filteredForwardThreads.length > 0 ? (
                <div className="pb-2">
                  <p className="sticky top-0 z-[1] bg-emerald-700/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white dark:bg-emerald-800/95">
                    Recent chats
                  </p>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800/80">
                    {filteredForwardThreads.map((t) => {
                      const otherParticipants = t.participants.filter(
                        (p: ChatParticipant) => p.id !== currentUser?.id
                      );
                      const primary =
                        otherParticipants[0] ?? t.participants[0];
                      const isGroup =
                        t.type === "group" ||
                        Boolean(t.group_id) ||
                        otherParticipants.length > 1;
                      const label =
                        isGroup && t.name
                          ? t.name
                          : primary?.name || t.name || "Chat";
                      const avatarUrl =
                        isGroup && t.banner_url
                          ? t.banner_url
                          : primary?.avatarUrl;
                      const subtitle =
                        t.last_message_preview?.trim() ||
                        (isGroup
                          ? `${otherParticipants.length} participants`
                          : "Tap to forward");

                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => void sendForwardedToThread(t.id)}
                            disabled={isSending}
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#202c33]"
                          >
                            <div className="relative h-12 w-12 shrink-0">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt=""
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-300 text-lg font-semibold text-gray-600 dark:bg-gray-600 dark:text-gray-200">
                                  {label.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-[#111b21] dark:text-[#e9edef]">
                                {label}
                              </p>
                              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                                {subtitle}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {filteredForwardContacts.length > 0 ? (
                <div className="pb-4">
                  <p className="sticky top-0 z-[1] bg-emerald-700/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white dark:bg-emerald-800/95">
                    Contacts
                  </p>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800/80">
                    {filteredForwardContacts.map((m) => {
                      const presence = formatContactPresenceLine(
                        m.status ?? null,
                        m.last_seen ?? null
                      );
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => void forwardToMember(m)}
                            disabled={isSending}
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#202c33]"
                          >
                            <div className="relative h-12 w-12 shrink-0">
                              {m.avatar_url ? (
                                <img
                                  src={m.avatar_url}
                                  alt=""
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-300 text-lg font-semibold text-gray-600 dark:bg-gray-600 dark:text-gray-200">
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-[#111b21] dark:text-[#e9edef]">
                                {m.name}
                              </p>
                              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                                {m.username
                                  ? `@${m.username}`
                                  : presence || "New chat"}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ChatWindow;
