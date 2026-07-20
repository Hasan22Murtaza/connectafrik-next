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
  Info,
  Loader2,
  LogOut,
  Mic,
  MinusCircle,
  MoreVertical,
  Pencil,
  Phone,
  Ban,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
  Video,
  X,
  XCircle,
  ChevronDown,
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
import ChatLocationPicker, {
  type ChatLocationSelection,
} from "./ChatLocationPicker";
import ChatMediaGallery from "./ChatMediaGallery";
import ChatTranslationMenu from "./ChatTranslationMenu";
import ChatWebcamCapture from "./ChatWebcamCapture";
import FilePreview from "./FilePreview";
import { ChatDateDivider, ChatUnreadDivider, MessageBubble } from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { formatMediaDuration } from "./messageMediaUtils";
import {
  ChatRichTextEditor,
  type ChatRichTextEditorHandle,
  richTextIsEmpty,
} from "@/features/chat/richtext";
import { serializePostLocation } from "@/features/social/utils/postLocation";
import {
  isDirectBlockableThread,
  isThreadMessagingBlocked,
} from "@/features/chat/utils/threadHelpers";
import { useActiveCallSession } from "@/features/chat/hooks/useActiveCallSession";
import { useMessageTranslations } from "@/features/chat/hooks/useMessageTranslations";

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
    isMessagesLoadingForThread,
    sendMessage,
    currentUser,
    callRequests,
    minimizedThreadIds,
    openThread,
    startCall,
    joinCall,
    activeCallsByThread,
    markThreadRead,
    clearMessagesForUser,
    markMessageDeletedForUser,
    setMessagesForThread,
    setThreadPinned,
    setThreadBlocked,
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
  const isMessagesLoading = isMessagesLoadingForThread(threadId);
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

  const {
    receiveLanguage,
    setReceiveLanguage,
    getDisplayContent,
    translateOneMessage,
    showOriginalForMessage,
    isTranslating,
    getMessageLanguage,
    overrides,
    defaultOneClickLanguage,
  } = useMessageTranslations(threadId, displayMessages, currentUser?.id);

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
  const { activeSession, canJoin, isInCall } = useActiveCallSession(threadId, currentUserId ?? undefined);
  const threadActiveCall = activeCallsByThread[threadId];

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

  const isMarketplaceThread = thread?.type === "marketplace";

  const displayThreadName = useMemo(() => {
    if (isSelfChat) {
      return `${currentUser?.name || "You"} (Notes)`;
    }
    if (isMarketplaceThread) {
      return primaryParticipant?.name || thread?.name || "Marketplace chat";
    }
    if (isGroupThread && thread?.name) {
      return thread.name;
    }
    return primaryParticipant?.name || thread?.name || "Chat";
  }, [
    isSelfChat,
    isMarketplaceThread,
    isGroupThread,
    primaryParticipant?.name,
    thread?.name,
    currentUser?.name,
  ]);

  const marketplaceProductTitle = thread?.product_title || thread?.name || null;

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
    if (isMarketplaceThread && thread?.product_image) {
      return thread.product_image;
    }
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
    isMarketplaceThread,
    thread?.product_image,
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

  /** `/user/[id]` is keyed by the peer's profile id. */
  const peerProfileRouteSegment = useMemo(() => {
    if (isGroupThread) return null;
    if (isSelfChat) return currentUser?.id ?? null;
    return primaryParticipant?.id ?? null;
  }, [isGroupThread, isSelfChat, currentUser?.id, primaryParticipant?.id]);

  const [draft, setDraft] = useState("");
  
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceElapsedSec, setVoiceElapsedSec] = useState(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const attachMenuRef = useRef<HTMLFormElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const initialUnreadCountRef = useRef(0);
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
  const composerEditorRef = useRef<ChatRichTextEditorHandle>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [participantRolesById, setParticipantRolesById] = useState<
    Record<string, string>
  >({});
  const [leavingGroup, setLeavingGroup] = useState(false);
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
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const scrollHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const msg of messages) {
      map.set(msg.id, msg);
    }
    return map;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (scrollHighlightTimerRef.current) clearTimeout(scrollHighlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setHistoryPage(0);
    setHasOlderMessages(true);
    setIsLoadingOlderMessages(false);
    isPrependingHistoryRef.current = false;
    setHighlightedMessageId(null);
    setShowMessageSearch(false);
    setMessageSearchDraft("");
    setMessageSearchKeyword("");
    setSearchMessages([]);
    setSearchPage(0);
    setSearchHasOlder(false);
    setSearchLoading(false);
    setShowMediaGallery(false);
    setShowParticipantsList(false);
    setParticipantRolesById({});
    setLeavingGroup(false);
    setEditingMessage(null);
    draftBeforeComposerEditRef.current = "";
    setForwardingMessage(null);
    setForwardSearch("");
    setInfoMessage(null);
    setMessageInfo(null);
    setMessageInfoLoading(false);
    setMessageInfoError(null);
    setPendingFiles((prev) => {
      fileUploadService.revokePreviews(prev);
      return [];
    });
    setAttachmentMenuOpen(false);
  }, [threadId]);

  useEffect(() => {
    if (forwardingMessage) setForwardSearch("");
  }, [forwardingMessage]);

  useEffect(() => {
    if (!showParticipantsList || !threadId) return;
    let cancelled = false;
    void (async () => {
      try {
        const map: Record<string, string> = {};
        const rows = await apiClient.get<
          Array<{ user_id: string; role?: string }>
        >(`/api/chat/threads/${threadId}/participants`);
        for (const row of rows ?? []) {
          if (row.user_id) map[row.user_id] = (row.role || "member").toLowerCase();
        }

        // Social groups store admin/moderator on group_memberships
        if (thread?.group_id) {
          const groupMembers =
            await supabaseMessagingService.getGroupMembers(thread.group_id);
          for (const m of groupMembers) {
            if (m.user_id && m.role) {
              map[m.user_id] = m.role.toLowerCase();
            }
          }
        }

        if (!cancelled) setParticipantRolesById(map);
      } catch {
        if (!cancelled) setParticipantRolesById({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showParticipantsList, threadId, thread?.group_id]);

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

  const flashMessageHighlight = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    if (scrollHighlightTimerRef.current) clearTimeout(scrollHighlightTimerRef.current);
    scrollHighlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      scrollHighlightTimerRef.current = null;
    }, 1800);
  }, []);

  const ensureMessageLoaded = useCallback(
    async (messageId: string): Promise<boolean> => {
      const hasMessage = () =>
        getMessagesForThread(threadId).some((msg) => msg.id === messageId);

      if (hasMessage()) return true;
      if (messageSearchKeyword.trim()) return false;

      let page = historyPage;
      let canLoadMore = hasOlderMessages;
      isPrependingHistoryRef.current = true;

      try {
        while (canLoadMore && page < 40) {
          page += 1;
          const { messages: olderMessages, hasMore } =
            await supabaseMessagingService.getThreadMessages(threadId, {
              page,
              limit: MESSAGES_PAGE_SIZE,
            });

          if (!olderMessages.length) {
            setHasOlderMessages(false);
            break;
          }

          canLoadMore = hasMore;
          setHasOlderMessages(hasMore);
          const currentMessages = getMessagesForThread(threadId);
          const mergedMap = new Map<string, ChatMessage>();
          currentMessages.forEach((msg) => mergedMap.set(msg.id, msg));
          olderMessages.forEach((msg) => mergedMap.set(msg.id, msg));
          const merged = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          setMessagesForThread(threadId, merged);
          setHistoryPage(page);

          if (hasMessage()) return true;
        }
      } finally {
        requestAnimationFrame(() => {
          isPrependingHistoryRef.current = false;
        });
      }

      return hasMessage();
    },
    [
      threadId,
      historyPage,
      hasOlderMessages,
      messageSearchKeyword,
      getMessagesForThread,
      setMessagesForThread,
    ]
  );

  const scrollToMessage = useCallback(
    async (messageId: string) => {
      if (!messageId) return;

      const loaded = await ensureMessageLoaded(messageId);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const el = document.getElementById(`chat-message-${messageId}`);
      if (!el) {
        if (!loaded) toast.error("Original message is unavailable");
        else toast.error("Could not scroll to the original message");
        return;
      }

      const container = messagesScrollRef.current;
      if (container) {
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const top =
          elRect.top -
          containerRect.top +
          container.scrollTop -
          container.clientHeight / 2 +
          elRect.height / 2;
        container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      flashMessageHighlight(messageId);
    },
    [ensureMessageLoaded, flashMessageHighlight]
  );

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

  // Capture unread count before markThreadRead clears it (render-phase snapshot on thread switch)
  const unreadThreadKeyRef = useRef(threadId);
  if (unreadThreadKeyRef.current !== threadId) {
    unreadThreadKeyRef.current = threadId;
    initialUnreadCountRef.current = Math.max(0, Number(thread?.unread_count) || 0);
  }

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el || displayMessages.length === 0) return;
    if (isPrependingHistoryRef.current) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
    setShowScrollToBottom(false);
  }, [threadId, displayMessages.length]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollTop <= 32) {
        void loadOlderMessages();
      }
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollToBottom(distanceFromBottom > 120);
    };

    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [loadOlderMessages]);

  useEffect(() => {
    if (!voiceRecording) {
      setVoiceElapsedSec(0);
      return;
    }
    setVoiceElapsedSec(0);
    const id = window.setInterval(() => {
      setVoiceElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [voiceRecording]);

  const scrollMessagesToBottom = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowScrollToBottom(false);
  }, []);

  const unreadDividerBeforeIndex = useMemo(() => {
    const n = initialUnreadCountRef.current;
    if (!n || messageSearchKeyword.trim() || displayMessages.length === 0) return -1;
    return Math.max(0, displayMessages.length - n);
  }, [displayMessages.length, messageSearchKeyword, threadId]);

  useEffect(() => {
    if (!attachmentMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachmentMenuOpen(false);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
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
    if (messagingBlocked) {
      toast.error(
        blockedByMe
          ? "Unblock this contact to send messages"
          : "You cannot message this contact"
      );
      return;
    }

    if (editingMessage) {
      const text = draft.trim();
      if (richTextIsEmpty(text)) return;
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
        composerEditorRef.current?.clear();
        stopTyping();
      } catch {
        toast.error("Could not update message");
      } finally {
        setIsSending(false);
      }
      return;
    }

    const text = draft.trim();
    if (richTextIsEmpty(text) && pendingFiles.length === 0) return;

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
    composerEditorRef.current?.clear();
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
      const msg =
        typeof error?.message === "string" && error.message.length > 0
          ? error.message
          : "Failed to send message";
      toast.error(msg);
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
    const restored = draftBeforeComposerEditRef.current;
    draftBeforeComposerEditRef.current = "";
    setDraft(restored);
    composerEditorRef.current?.setMarkdown(restored);
  }, []);

  const beginComposerEdit = useCallback((message: ChatMessage) => {
    draftBeforeComposerEditRef.current = draft;
    setEditingMessage(message);
    setReplyingTo(null);
    setForwardingMessage(null);
    fileUploadService.revokePreviews(pendingFiles);
    setPendingFiles([]);
    setAttachmentMenuOpen(false);
    const next = message.content ?? "";
    setDraft(next);
    requestAnimationFrame(() => {
      composerEditorRef.current?.setMarkdown(next);
      composerEditorRef.current?.focus();
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
      composerEditorRef.current?.setMarkdown(restore);
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
      composerEditorRef.current?.setMarkdown(restore);
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

  const canBlockContact = isDirectBlockableThread(thread, currentUser?.id);
  const messagingBlocked = isThreadMessagingBlocked(thread);
  const blockedByMe = Boolean(thread?.is_block);
  const blockedByOther = Boolean(thread?.blocked_by_other);

  const handleBlockToggle = async () => {
    if (!thread || !canBlockContact) return;
    const nextBlocked = !thread.is_block;
    if (nextBlocked) {
      const confirmed = window.confirm(
        `Block ${displayThreadName}? They will not be able to call or message you in this chat.`
      );
      if (!confirmed) return;
    }
    try {
      await setThreadBlocked(threadId, nextBlocked);
      toast.success(nextBlocked ? "Contact blocked" : "Contact unblocked");
      setShowOptionsMenu(false);
    } catch {
      toast.error("Could not update block");
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

  const handleJoinCall = async () => {
    try {
      userInitiatedCall.current = true;
      await joinCall(threadId);
    } catch {
      userInitiatedCall.current = false;
    }
  };


  const handleFilesSelected = (files: FileUploadResult[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
    setAttachmentMenuOpen(false);
  };

  const handlePasteFiles = useCallback(
    async (files: File[]) => {
      if (messagingBlocked || editingMessage || files.length === 0) return;
      const results = await fileUploadService.fromFiles(files);
      if (results.length) {
        setPendingFiles((prev) => [...prev, ...results]);
      }
    },
    [messagingBlocked, editingMessage]
  );

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

  const handleSendLocation = useCallback(
    async (place: ChatLocationSelection) => {
      if (messagingBlocked || isSending) {
        toast.error(
          blockedByMe
            ? "Unblock this contact to send messages"
            : "You cannot message this contact"
        );
        return;
      }
      const content = serializePostLocation({
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      });
      setLocationPickerOpen(false);
      setIsSending(true);
      try {
        await sendMessage(threadId, content, {
          content,
          message_type: "location",
        });
        stopTyping();
      } catch (error: any) {
        toast.error(error?.message || "Failed to send location");
      } finally {
        setIsSending(false);
      }
    },
    [
      messagingBlocked,
      isSending,
      blockedByMe,
      sendMessage,
      threadId,
      stopTyping,
    ]
  );

  const showSendButton =
    editingMessage !== null
      ? true
      : !richTextIsEmpty(draft) || pendingFiles.length > 0;

  const composerSendDisabled =
    messagingBlocked || (editingMessage !== null && richTextIsEmpty(draft));

  const mentionCandidates = useMemo(
    () =>
      (thread?.participants || [])
        .filter((p: ChatParticipant) => p.id !== currentUser?.id)
        .map((p: ChatParticipant) => ({
          id: p.id,
          name: p.name || "User",
          username: (p as { username?: string }).username ?? null,
          avatarUrl: p.avatarUrl ?? null,
        })),
    [thread?.participants, currentUser?.id]
  );

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

  const handleLeaveGroup = useCallback(async () => {
    if (!isGroupThread || leavingGroup) return;
    if (
      !window.confirm(
        "Leave this group? You will no longer receive messages from this chat."
      )
    ) {
      return;
    }
    setLeavingGroup(true);
    try {
      if (thread?.group_id) {
        const data = await apiClient.post<{ thread_id: string | null }>(
          `/api/groups/${thread.group_id}/leave`
        );
        const leftThreadId = data?.thread_id || threadId;
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("groupChatLeft", {
              detail: { threadId: leftThreadId },
            })
          );
        }
      } else {
        await apiClient.post(
          `/api/chat/threads/${threadId}/participants/leave`
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("groupChatLeft", { detail: { threadId } })
          );
        }
      }
      toast.success("Left group");
      setShowParticipantsList(false);
      if (variant === "page") router.push("/chat");
    } catch (error: any) {
      toast.error(error?.message || "Failed to leave group");
    } finally {
      setLeavingGroup(false);
    }
  }, [
    isGroupThread,
    leavingGroup,
    thread?.group_id,
    threadId,
    variant,
    router,
  ]);

  const handleDeleteChatFromMenu = useCallback(async () => {
    if (!currentUser) return;
    if (
      !window.confirm(
        "Delete this chat? It will be removed from your chats list and your message history will be cleared. The other person will not be affected."
      )
    ) {
      return;
    }
    setShowOptionsMenu(false);
    const prevMessages = getMessagesForThread(threadId);
    try {
      clearMessagesForUser(threadId, currentUser.id);
      await supabaseMessagingService.deleteThreadForMe(threadId, currentUser.id);
      closeThread(threadId);
      if (variant === "page") router.push("/chat");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("chatThreadDeleted", { detail: { threadId } })
        );
      }
      toast.success("Chat deleted");
    } catch {
      if (prevMessages.length > 0) {
        setMessagesForThread(threadId, prevMessages);
      }
      toast.error("Could not delete chat");
    }
  }, [
    currentUser,
    threadId,
    getMessagesForThread,
    clearMessagesForUser,
    closeThread,
    variant,
    router,
    setMessagesForThread,
  ]);



  const chatHeaderOptionsMenuSections = useMemo((): ChatHeaderOptionsMenuSection[] => {

    const primary: ChatHeaderOptionsMenuItem[] = [
      {
        id: "contact",
        label: isGroupThread ? "Group info" : "Contact info",
        Icon: Info,
        onClick: () => {
          setShowOptionsMenu(false);
          if (isGroupThread) {
            setShowParticipantsList(true);
            return;
          }
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
      ...(canBlockContact
        ? [
            {
              id: "block",
              label: thread?.is_block ? "Unblock contact" : "Block contact",
              Icon: Ban,
              onClick: () => void handleBlockToggle(),
            } satisfies ChatHeaderOptionsMenuItem,
          ]
        : []),

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
    thread?.is_block,
    canBlockContact,
    isGroupThread,
    visibleMessages.length,
    openMessageSearchFromMenu,
    handleOpenThreadDetailPage,
    handlePinToggle,
    handleBlockToggle,
    handleClearAllMessages,
    handleCloseChatFromMenu,
    handleDeleteChatFromMenu,
  ]);

  const isPageVariant = variant === "page";

  return (
    <div
      className={`pointer-events-auto relative flex max-w-full flex-col ${
        attachmentMenuOpen ? "overflow-visible" : "overflow-hidden"
      } ${isPageVariant
          ? "h-full w-full"
          : "w-72 rounded-2xl sm:w-80 sm:max-w-full shadow-[0_8px_28px_rgba(11,20,26,0.14)]"
        }`}
    >
      <div
        className={`flex items-center justify-between gap-2 border-b border-border/80 bg-surface px-2.5 py-2 sm:px-4 ${isPageVariant ? "" : "rounded-tl-2xl rounded-tr-2xl"
          }`}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="relative h-10 w-10 shrink-0">
            {headerAvatarAvailable ? (
              <img
                src={headerAvatarUrl}
                alt={displayThreadName}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-border-subtle"
                onError={() => setHeaderImageFailed(true)}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 ring-2 ring-border-subtle">
                {headerInitial}
              </div>
            )}
            {!isGroupThread && directSubtitle === "Online" ? (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-green-500" aria-hidden />
            ) : null}
          </div>
          <div
            className="min-w-0 cursor-pointer"
            onClick={() => {
              if (isGroupThread) {
                setShowParticipantsList(true);
                return;
              }
              handleOpenThreadDetailPage();
            }}
          >
            <div className="truncate text-sm font-semibold text-content">
              {displayThreadName}
            </div>
            {(canJoin || isInCall || threadActiveCall) && (
              <div className="mt-0.5 flex items-center gap-2">
                {canJoin && activeSession?.participantProfiles?.length ? (
                  <div className="flex -space-x-1.5">
                    {activeSession.participantProfiles.slice(0, 4).map((p) => (
                      <div key={p.id} className="h-5 w-5 overflow-hidden rounded-full border border-white bg-primary-100 dark:border-surface">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-primary-700">
                            {(p.full_name || p.username || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500" />
                <span className="min-w-0 truncate text-xs font-medium text-green-600 dark:text-green-400">
                  {canJoin
                    ? `Group call · ${activeSession?.participants.length ?? threadActiveCall?.participantCount ?? 0} in call`
                    : `In call · ${activeSession?.participants.length ?? threadActiveCall?.participantCount ?? 0} participants`}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                if (isMarketplaceThread && thread?.product_id) {
                  e.stopPropagation();
                  router.push(`/marketplace/${thread.product_id}`);
                  return;
                }
                if (isGroupThread) {
                  e.stopPropagation();
                  setShowParticipantsList(true);
                }
              }}
              className={`block w-full truncate text-left text-xs text-content-secondary hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500 ${
                isGroupThread ? "cursor-pointer hover:underline" : ""
              }`}
            >
              {isSelfChat
                ? "Save messages to yourself"
                : isMarketplaceThread && marketplaceProductTitle
                  ? `Marketplace · ${marketplaceProductTitle}`
                  : isGroupThread
                    ? `${thread?.participants?.length ?? 0} members`
                    : (directSubtitle ?? "Offline")}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <ChatTranslationMenu
            value={receiveLanguage}
            onChange={(language) => void setReceiveLanguage(language)}
          />
          {canJoin && (
            <button
              type="button"
              onClick={() => void handleJoinCall()}
              disabled={messagingBlocked}
              className="mr-1 flex max-w-[5.5rem] items-center gap-1 rounded-full bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 sm:max-w-none sm:gap-1.5 sm:px-3"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Join</span>
            </button>
          )}
          {!canJoin && !isInCall && (
            <>
              <button
                type="button"
                onClick={() => handleStartCall("audio")}
                disabled={messagingBlocked}
                className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Voice call"
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleStartCall("video")}
                disabled={messagingBlocked}
                className="hidden h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 min-[380px]:flex"
                aria-label="Video call"
              >
                <Video className="h-5 w-5" />
              </button>
            </>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowOptionsMenu((open) => !open);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-content-tertiary transition hover:bg-surface-hover hover:text-content-secondary"
              aria-expanded={showOptionsMenu}
              aria-haspopup="menu"
              aria-label="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showOptionsMenu && (
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[min(240px,calc(100vw-1.5rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl animate-[chatFadeIn_140ms_ease-out]"
              >
                {chatHeaderOptionsMenuSections.map((section, sectionIdx) => (
                  <React.Fragment key={section.id}>
                    {sectionIdx > 0 ? (
                      <div
                        role="separator"
                        className="my-1 border-t border-border"
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
                        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] leading-snug";
                      const rowClass =
                        disabled
                          ? `${baseRow} cursor-not-allowed text-content-tertiary opacity-60`
                          : tone === "danger"
                            ? `${baseRow} text-red-600 hover:bg-surface-hover`
                            : `${baseRow} text-content hover:bg-surface-hover`;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="menuitem"
                          disabled={disabled}
                          onClick={onClick}
                          className={rowClass}
                        >
                          <Icon className="h-[20px] w-[20px] shrink-0 opacity-90" />
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
        <div className="flex items-center gap-1 border-b border-border-subtle bg-surface-secondary px-1.5 py-1.5">
          <button
            type="button"
            onClick={closeMessageSearch}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-content hover:bg-surface-hover"
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
            className="min-w-0 flex-1 rounded-full border-0 bg-surface px-3 py-1.5 text-xs text-content placeholder:text-content-tertiary focus:outline-none focus:ring-0"
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
              className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-content-secondary hover:bg-surface-secondary"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className={`relative ${isPageVariant ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      <div
        ref={messagesScrollRef}
        className={`flex flex-col space-y-1 overflow-y-auto overflow-x-hidden bg-surface-canvas px-2 py-2 sm:space-y-1.5 sm:px-4 sm:py-3 scroll-smooth ${isPageVariant ? "min-h-0 flex-1" : "h-[250px] sm:h-[290px]"
          }`}
      >
        {isLoadingOlderMessages && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-xs text-content-secondary shadow-sm backdrop-blur-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />
              {messageSearchKeyword.trim() ? "Loading older matches…" : "Loading older messages…"}
            </div>
          </div>
        )}
        {searchLoading && messageSearchKeyword.trim() ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-10 w-10 animate-pulse rounded-full bg-surface-secondary" />
            <div className="h-3 w-40 animate-pulse rounded-full bg-surface-secondary" />
            <p className="text-sm text-content-secondary">Searching messages…</p>
          </div>
        ) : isMessagesLoading && displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <p className="text-sm text-content-secondary">Loading messages…</p>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-[chatFadeIn_220ms_ease-out]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface/90 text-2xl shadow-sm ring-1 ring-border-subtle">
              💬
            </div>
            <p className="text-sm font-medium text-content">
              {messageSearchKeyword.trim()
                ? `No messages match "${messageSearchKeyword.trim()}"`
                : "No messages yet"}
            </p>
            <p className="max-w-[220px] text-xs text-content-secondary">
              {messageSearchKeyword.trim()
                ? "Try a different keyword."
                : "Say hello — send a message to start the conversation."}
            </p>
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
            const showSenderHeader =
              isGroupThread &&
              !isOwn &&
              (!prev ||
                showDateDivider ||
                !chatUserIdsEqual(
                  getChatMessageAuthorId(prev),
                  getChatMessageAuthorId(message)
                ));

            return (
              <Fragment key={message.id}>
                {showDateDivider ? (
                  <ChatDateDivider dateIso={message.created_at} />
                ) : null}
                {index === unreadDividerBeforeIndex ? <ChatUnreadDivider /> : null}
                <MessageBubble
                  message={message}
                  threadId={threadId}
                  isOwnMessage={isOwn}
                  currentUserId={currentUser?.id || ""}
                  threadParticipants={
                    thread?.participants?.map((p: ChatParticipant) => p.id) || []
                  }
                  participantPresence={participantPresenceById}
                  showSenderHeader={showSenderHeader}
                  onReply={handleReply}
                  onForward={openForwardPicker}
                  onDelete={handleDelete}
                  onBeginEdit={beginComposerEdit}
                  composerEditingMessageId={editingMessage?.id ?? null}
                  onReact={handleMessageReaction}
                  onShowInfo={(msg) => void openMessageInfo(msg)}
                  onScrollToMessage={(messageId) => void scrollToMessage(messageId)}
                  repliedToMessage={
                    message.reply_to_id ? messagesById.get(message.reply_to_id) ?? null : null
                  }
                  highlighted={highlightedMessageId === message.id}
                  translationDisplay={getDisplayContent(message, isOwn)}
                  isTranslating={isTranslating(message.id)}
                  activeTranslationLanguage={getMessageLanguage(message.id, isOwn)}
                  showOriginalOverride={overrides[message.id]?.showOriginal ?? false}
                  defaultTranslateLanguage={defaultOneClickLanguage}
                  onTranslateMessage={(language) =>
                    void translateOneMessage(message.id, language)
                  }
                  onToggleShowOriginal={() =>
                    showOriginalForMessage(message.id, isOwn)
                  }
                />
              </Fragment>
            );
          })
        )}
        <div aria-hidden="true" />
      </div>

      {showScrollToBottom ? (
        <button
          type="button"
          onClick={scrollMessagesToBottom}
          className="absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-content-secondary shadow-[0_2px_8px_rgba(11,20,26,0.2)] ring-1 ring-border transition hover:bg-surface-hover hover:text-content animate-[chatFadeIn_160ms_ease-out]"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      ) : null}
      </div>

      <TypingIndicator isTyping={typingUserIds.length > 0} />

      {messagingBlocked ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
          {blockedByMe ? (
            <p>
              You blocked this contact.{" "}
              {canBlockContact ? (
                <button
                  type="button"
                  onClick={() => void handleBlockToggle()}
                  className="font-medium text-primary-700 underline hover:text-primary-800"
                >
                  Unblock
                </button>
              ) : null}
            </p>
          ) : blockedByOther ? (
            <p>You cannot message or call this contact.</p>
          ) : null}
        </div>
      ) : null}

      {pendingFiles.length > 0 && !editingMessage && (
        <div className="border-t border-border-subtle px-2.5 pb-2 sm:px-4 sm:pb-3">
          <FilePreview files={pendingFiles} onRemove={removePendingFile} />
        </div>
      )}

      <form
        id={`chat-composer-${threadId}`}
        onSubmit={handleSend}
        className={`relative overflow-visible border-t border-border/60 bg-surface px-2.5 py-2 sm:px-3 sm:py-2.5 ${isPageVariant ? "pb-[max(0.5rem,env(safe-area-inset-bottom))]" : "rounded-bl-2xl rounded-br-2xl"
          } ${messagingBlocked ? "pointer-events-none opacity-60" : ""}`}
        ref={attachMenuRef}
      >
        <ChatAttachmentMenu
          open={attachmentMenuOpen}
          onFilesSelected={handleFilesSelected}
          onClose={() => setAttachmentMenuOpen(false)}
          onOpenCamera={() => setWebcamOpen(true)}
          onOpenLocation={() => setLocationPickerOpen(true)}
        />

        {editingMessage ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-border bg-surface-secondary px-2.5 py-2 border-l-[3px] border-l-[#128c7e]">
            <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-[#128c7e]" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#128c7e]">
                Editing message
              </div>
              <div className="mt-0.5 truncate text-xs font-medium text-content-secondary">
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
              className="flex-shrink-0 rounded-full p-1 text-content-secondary transition hover:bg-surface-hover hover:text-content"
              aria-label="Discard edit"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : replyingTo ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl bg-surface-secondary p-2 border-l-[3px] border-[#128c7e]">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-xs font-semibold text-[#128c7e]">
                Replying to {replyingTo.sender?.name || "Unknown"}
              </div>
              <div className="truncate text-sm text-content-secondary">
                {replyingTo.is_deleted
                  ? "This message was deleted"
                  : replyingTo.content}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="flex-shrink-0 rounded-full p-1 text-content-secondary hover:bg-surface-hover hover:text-content"
              aria-label="Cancel reply"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

          {voiceRecording && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-surface-secondary px-2.5 py-2 animate-[chatFadeIn_160ms_ease-out] sm:gap-3 sm:px-3 sm:py-2.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 animate-[chatRecPulse_1s_ease-in-out_infinite] rounded-full bg-red-500" />
            <div className="flex min-w-0 flex-1 items-center gap-2 text-content-secondary">
              <div className="flex h-6 min-w-0 flex-1 items-end gap-[2px] overflow-hidden text-[#128c7e]/70">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="chat-wave-bar w-[3px] rounded-full bg-current"
                    style={{
                      height: `${6 + ((i * 5) % 14)}px`,
                      animationDelay: `${(i % 6) * 70}ms`,
                    }}
                  />
                ))}
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-content">
                {formatMediaDuration(voiceElapsedSec)}
              </span>
            </div>
            <span className="hidden shrink-0 text-[11px] font-medium text-content-tertiary sm:inline">
              Tap stop to send
            </span>
          </div>
        )}

        <div className="flex items-end gap-1.5 sm:gap-2">
          <div className="relative flex-shrink-0 self-end">
            <button
              type="button"
              onClick={() => {
                !editingMessage && setAttachmentMenuOpen((o) => !o);
              }}
              disabled={!!editingMessage}
              className={`mb-0.5 flex h-10 w-10 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:pointer-events-none disabled:opacity-40 ${
                attachmentMenuOpen ? "bg-surface-hover text-[#128c7e]" : ""
              }`}
              aria-label="Attach"
              aria-expanded={attachmentMenuOpen}
              title={
                editingMessage
                  ? "Finish editing before attaching files"
                  : undefined
              }
            >
              <Plus className={`h-[22px] w-[22px] transition-transform duration-200 ${attachmentMenuOpen ? "rotate-45" : ""}`} strokeWidth={1.75} />
            </button>
          </div>

          <ChatRichTextEditor
            ref={composerEditorRef}
            value={draft}
            onChange={setDraft}
            onTyping={handleTyping}
            onSubmit={() => {
              const form = document.getElementById(`chat-composer-${threadId}`) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            onPasteFiles={(files) => void handlePasteFiles(files)}
            disabled={messagingBlocked}
            mentionCandidates={mentionCandidates}
            placeholder={
              messagingBlocked
                ? blockedByMe
                  ? "Unblock to message"
                  : "Messaging unavailable"
                : editingMessage
                  ? "Edit message"
                  : "Type a message"
            }
            showToolbar
          />

          <div className="relative mb-0.5 h-10 w-10 flex-shrink-0 self-end">
            {showSendButton ? (
              <button
                type="submit"
                disabled={isSending || composerSendDisabled}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 animate-[chatFadeIn_140ms_ease-out]"
                aria-label={
                  editingMessage ? "Done editing — save changes" : "Send message"
                }
              >
                {isSending ? (
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Send className="h-[18px] w-[18px]" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleVoiceRecording}
                disabled={isSending || !!editingMessage}
                className={`absolute inset-0 flex items-center justify-center rounded-full text-white transition active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 animate-[chatFadeIn_140ms_ease-out] ${
                  voiceRecording
                    ? "bg-red-500 hover:bg-red-600"
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
                  <Mic className="h-5 w-5" strokeWidth={1.75} />
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      <ChatWebcamCapture
        isOpen={webcamOpen}
        onClose={() => setWebcamOpen(false)}
        onCaptured={handleFilesSelected}
      />

      <ChatLocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={(place) => void handleSendLocation(place)}
      />

      <ChatMediaGallery
        threadId={threadId}
        open={showMediaGallery}
        onClose={() => setShowMediaGallery(false)}
        isGroupChat={isGroupThread}
      />

      {showParticipantsList ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Group info"
          onClick={() => setShowParticipantsList(false)}
        >
          <div
            className="flex max-h-[min(90vh,520px)] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(11,20,26,0.22)] dark:bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-content">Group info</h2>
                <p className="mt-0.5 text-sm text-content-secondary">
                  {thread?.participants?.length ?? 0}{" "}
                  {(thread?.participants?.length ?? 0) === 1
                    ? "member"
                    : "members"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowParticipantsList(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-content transition hover:bg-surface-hover"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-3.5">
                {[...(thread?.participants ?? [])]
                  .sort((a, b) => {
                    const aAdmin =
                      (participantRolesById[a.id] || "") === "admin" ? 0 : 1;
                    const bAdmin =
                      (participantRolesById[b.id] || "") === "admin" ? 0 : 1;
                    if (aAdmin !== bAdmin) return aAdmin - bAdmin;
                    return (a.name || "").localeCompare(b.name || "");
                  })
                  .map((p: ChatParticipant) => {
                    const isYou = p.id === currentUser?.id;
                    const role = participantRolesById[p.id] || "";
                    const isAdmin = role === "admin";
                    const label = p.name || "User";

                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowParticipantsList(false);
                            router.push(`/user/${encodeURIComponent(p.id)}`);
                          }}
                          className="flex w-full items-center gap-3 text-left transition hover:opacity-80"
                        >
                          <div className="relative h-10 w-10 shrink-0">
                            {p.avatarUrl ? (
                              <img
                                src={p.avatarUrl}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-600">
                                {label.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate text-sm font-medium text-content">
                              {isYou ? `${label} (you)` : label}
                            </span>
                            {isAdmin ? (
                              <span className="shrink-0 rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-orange-600">
                                Admin
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>

            <div className="shrink-0 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => void handleLeaveGroup()}
                disabled={leavingGroup}
                className="flex items-center gap-2 text-sm font-medium text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {leavingGroup ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Leave group
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {infoMessage ? (
        <div
          className="absolute inset-0 z-[95] flex flex-col overflow-hidden rounded-2xl bg-surface"
          role="dialog"
          aria-modal="true"
          aria-label="Message info"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-secondary px-2 py-2 text-content">
            <button
              type="button"
              onClick={() => {
                setInfoMessage(null);
                setMessageInfo(null);
                setMessageInfoError(null);
                setMessageInfoLoading(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-hover"
              aria-label="Back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <CheckCheck className="h-5 w-5 shrink-0 opacity-90" />
              <span className="truncate text-sm font-semibold">Message info</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-secondary px-3 py-3">
            {messageInfoLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-content-secondary">
                <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
                <span className="text-xs">Loading message info…</span>
              </div>
            ) : messageInfoError ? (
              <div className="py-4 text-center text-xs text-red-600">{messageInfoError}</div>
            ) : (
              <>
                <div className="mb-4 rounded-xl border border-border bg-surface p-3 shadow-sm">
                  <div className="mb-1 text-[11px] font-semibold text-content-secondary">
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
                  <div className="space-y-0.5 text-xs text-content-secondary">
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
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-content-secondary">
                      No reads yet
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border bg-surface">
                      {(messageInfo?.read_receipts ?? []).map((r) => (
                        <div
                          key={`read-${r.user_id}`}
                          className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 last:border-b-0"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-xs font-semibold text-fuchsia-700">
                            {receiptInitial(receiptDisplayName(r))}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-content">
                              {receiptDisplayName(r)}
                            </div>
                            <div className="text-xs text-content-secondary">
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
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-content-secondary">
                      Everyone has read this message
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border bg-surface">
                      {(messageInfo?.delivered_receipts ?? []).map((r) => (
                        <div
                          key={`delivered-${r.user_id}`}
                          className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 last:border-b-0"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
                            {receiptInitial(receiptDisplayName(r))}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-content">
                              {receiptDisplayName(r)}
                            </div>
                            <div className="text-xs text-content-secondary">
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
            className="flex h-[min(88vh,640px)] w-full max-w-md flex-col rounded-t-2xl border border-border bg-surface-canvas shadow-2xl sm:h-[min(560px,85vh)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-1 border-b border-border/80 bg-surface-canvas px-1 py-2">
              <button
                type="button"
                onClick={cancelForwardPicker}
                className="rounded-full p-2 text-content hover:bg-surface-hover"
                aria-label="Back"
              >
                <ChevronLeft className="h-7 w-7" strokeWidth={2} />
              </button>
              <h2 className="text-lg font-medium text-content">
                Forward message to
              </h2>
            </div>

            <div className="shrink-0 border-b border-border/80 bg-surface-canvas px-3 pb-3 pt-1">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary"
                  aria-hidden
                />
                <input
                  type="search"
                  value={forwardSearch}
                  onChange={(e) => setForwardSearch(e.target.value)}
                  placeholder="Search contacts…"
                  className="w-full rounded-lg border-0 bg-surface-input py-2.5 pl-10 pr-3 text-sm text-content shadow-sm placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
              {filteredForwardThreads.length === 0 &&
                filteredForwardContacts.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-content-secondary">
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
                  <ul className="divide-y divide-border-subtle">
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
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div className="relative h-12 w-12 shrink-0">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt=""
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-tertiary text-lg font-semibold text-content-secondary">
                                  {label.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-content">
                                {label}
                              </p>
                              <p className="truncate text-sm text-content-secondary">
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
                  <ul className="divide-y divide-border-subtle">
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
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div className="relative h-12 w-12 shrink-0">
                              {m.avatar_url ? (
                                <img
                                  src={m.avatar_url}
                                  alt=""
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-tertiary text-lg font-semibold text-content-secondary">
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-content">
                                {m.name}
                              </p>
                              <p className="truncate text-sm text-content-secondary">
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
