import MessageStatusIndicator from "@/features/chat/components/MessageStatusIndicator";
import type {
  ChatHeaderOptionsMenuItem,
  ChatHeaderOptionsMenuSection,
} from "@/features/chat/types/chatHeaderOptionsMenu";
import type { ChatMessage } from "@/features/chat/services/supabaseMessagingService";
import { toCallSessionStatusMessageType } from "@/features/chat/services/callSessionRealtime";
import {
  differenceInCalendarDays,
  format,
  isThisYear,
  isToday,
  isYesterday,
  startOfDay,
} from "date-fns";
import {
  ChevronDown,
  ChevronsRight,
  Copy,
  ExternalLink,
  Forward,
  Info,
  Languages,
  Loader2,
  Pencil,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Reply,
  Smile,
  Trash2,
} from "lucide-react";
import React, { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import ReactionIcon, {
  KIND_TO_EMOJI,
  PICKER_REACTIONS,
  type ReactionKind,
} from "@/shared/components/ReactionIcon";
import { TbMoodPlus } from "react-icons/tb";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import ReactionsModal, { type ReactionsModalGroup } from "@/shared/components/ReactionsModal";
import {
  messageTranslationLanguageLabel,
  type MessageTranslationTargetCode,
} from "@/features/chat/constants/messageTranslationLanguages";
import { shouldOfferMessageTranslate } from "@/features/chat/utils/detectMessageLanguage";
import MessageAttachments from "./MessageAttachments";
import ChatMediaViewer, { type ChatMediaViewerItem } from "./ChatMediaViewer";
import {
  extractConnectAfrikPostId,
  extractFirstUrl,
  isEmojiOnlyMessage,
  participantNameColor,
  stripConnectAfrikPostUrls,
} from "./messageMediaUtils";
import { ChatRichTextRenderer } from "@/features/chat/richtext";
import { stripMarkdown } from "@/features/chat/richtext/markdown";
import ChatLocationCard, {
  tryParseChatLocationContent,
} from "./ChatLocationCard";
import ChatPostCard from "./ChatPostCard";

const WA_QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export function formatChatDateDividerLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const todayStart = startOfDay(new Date());
  const dStart = startOfDay(date);
  const daysAgo = differenceInCalendarDays(todayStart, dStart);
  if (daysAgo >= 2 && daysAgo <= 6) {
    return format(date, "EEEE");
  }
  return isThisYear(date) ? format(date, "MMMM d") : format(date, "MMMM d, yyyy");
}

export function ChatDateDivider({ dateIso }: { dateIso: string }) {
  const label = formatChatDateDividerLabel(new Date(dateIso));
  return (
    <div className="flex justify-center py-2.5">
      <span className="rounded-lg bg-surface/95 px-3.5 py-1 text-[12px] font-semibold tracking-wide text-content-secondary shadow-[0_1px_1px_rgba(11,20,26,0.12)] backdrop-blur-sm dark:bg-surface/90">
        {label}
      </span>
    </div>
  );
}

export function ChatUnreadDivider() {
  return (
    <div className="relative my-3 flex items-center justify-center px-2" role="separator" aria-label="Unread messages">
      <div className="absolute inset-x-2 top-1/2 h-px bg-primary-500/35 sm:inset-x-4" />
      <span className="relative z-[1] rounded-full bg-primary-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm sm:px-3 sm:text-[11px]">
        Unread messages
      </span>
    </div>
  );
}

function isEditableTextMessage(m: ChatMessage): boolean {
  if (m.is_deleted) return false;
  const t = m.message_type || "text";
  return t === "text";
}

function isForwardableChatMessage(m: ChatMessage): boolean {
  if (m.is_deleted) return false;
  const hasText = Boolean(m.content?.trim());
  const hasAtt = Boolean(m.attachments && m.attachments.length > 0);
  return hasText || hasAtt;
}

/** WhatsApp-style voice / missed call row inside a bubble */
function getCallBubblePresentation(
  message: ChatMessage,
): { variant: "missed" | "voice"; title: string; subtitle: string } | null {
  const mt = (message.message_type || "").toLowerCase();
  const content = (message.content || "").trim();
  const contentLower = content.toLowerCase();

  if (mt === "missed" || contentLower === "missed call") {
    return {
      variant: "missed",
      title: "Missed voice call",
      subtitle: "Click to call back",
    };
  }
  if (mt === "declined") {
    return {
      variant: "voice",
      title: "Voice call",
      subtitle: content || "No answer",
    };
  }
  return null;
}

interface MessageBubbleProps {
  message: ChatMessage;
  threadId: string;
  isOwnMessage: boolean;
  currentUserId: string;
  threadParticipants?: string[];
  participantPresence?: Record<string, "online" | "offline">;
  onReply?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
  onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
  onBeginEdit?: (message: ChatMessage) => void;
  composerEditingMessageId?: string | null;
  onReact?: (messageId: string, emoji: string) => void;
  onShowInfo?: (message: ChatMessage) => void;
  selectionMode?: boolean;
  isMessageSelected?: boolean;
  /** Group chats only: show avatar + name above inbound bubbles */
  showSenderHeader?: boolean;
  translationDisplay?: {
    text: string;
    isTranslated: boolean;
    language: MessageTranslationTargetCode | null;
  };
  isTranslating?: boolean;
  activeTranslationLanguage?: MessageTranslationTargetCode | null;
  showOriginalOverride?: boolean;
  defaultTranslateLanguage?: MessageTranslationTargetCode;
  onTranslateMessage?: (language: MessageTranslationTargetCode) => void;
  onToggleShowOriginal?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  threadId,
  isOwnMessage,
  currentUserId,
  threadParticipants = [],
  participantPresence = {},
  onReply,
  onForward,
  onDelete,
  onBeginEdit,
  composerEditingMessageId = null,
  onReact,
  onShowInfo,
  selectionMode = false,
  showSenderHeader = false,
  translationDisplay,
  isTranslating = false,
  activeTranslationLanguage = null,
  showOriginalOverride = false,
  defaultTranslateLanguage = "en",
  onTranslateMessage,
  onToggleShowOriginal,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showQuickReactions, setShowQuickReactions] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<"above" | "below" | "side">("below");
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const reactionPickerCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickReactionsRef = useRef<HTMLDivElement | null>(null);
  const bubbleBlockRef = useRef<HTMLDivElement | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [reactionModalGroups, setReactionModalGroups] = useState<ReactionsModalGroup[]>([]);
  const [mediaViewer, setMediaViewer] = useState<{
    items: ChatMediaViewerItem[];
    index: number;
  } | null>(null);

  const router = useRouter();
  const MENU_VIEWPORT_GAP = 8;
  /** Conservative height for reactions + overflow menu so we pick above/below before paint. */
  const ESTIMATED_MENU_HEIGHT = 320;
  const MESSAGE_PREVIEW_LIMIT = 220;

  const computeMenuPlacement = useCallback((): "above" | "below" | "side" => {
    const el = bubbleBlockRef.current;
    if (!el) return "below";
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_VIEWPORT_GAP;
    const spaceAbove = rect.top - MENU_VIEWPORT_GAP;
    const spaceRight = window.innerWidth - rect.right - MENU_VIEWPORT_GAP;
    const spaceLeft = rect.left - MENU_VIEWPORT_GAP;

    if (spaceBelow >= ESTIMATED_MENU_HEIGHT) return "below";
    if (spaceAbove >= ESTIMATED_MENU_HEIGHT) return "above";

    if (spaceRight >= 220 && spaceLeft >= 220) return "side";
    return spaceBelow >= spaceAbove ? "below" : "above";
  }, []);

  const toggleMessageMenu = useCallback(() => {
    setShowMenu((open) => {
      if (open) return false;
      setMenuPlacement(computeMenuPlacement());
      return true;
    });
  }, [computeMenuPlacement]);

  const openMessageMenu = useCallback(() => {
    setMenuPlacement(computeMenuPlacement());
    setShowMenu(true);
  }, [computeMenuPlacement]);

  useLayoutEffect(() => {
    if (!showMenu) return;
    const el = bubbleBlockRef.current;
    const menuEl = messageMenuRef.current;
    if (!el || !menuEl) return;

    const rect = el.getBoundingClientRect();
    const menuHeight = menuEl.getBoundingClientRect().height;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_VIEWPORT_GAP;
    const spaceAbove = rect.top - MENU_VIEWPORT_GAP;
    const spaceRight = window.innerWidth - rect.right - MENU_VIEWPORT_GAP;
    const spaceLeft = rect.left - MENU_VIEWPORT_GAP;
    const fitsBelow = spaceBelow >= menuHeight;
    const fitsAbove = spaceAbove >= menuHeight;

    setMenuPlacement((prev) => {
      if (fitsBelow) return "below";
      if (fitsAbove) return "above";
      if (spaceRight >= 220 && spaceLeft >= 220) return "side";
      return prev === "below" ? "above" : prev === "above" ? "below" : "below";
    });
  }, [showMenu, showReactionPicker]);

  useLayoutEffect(() => {
    if (!showQuickReactions) return;
    setMenuPlacement(computeMenuPlacement());
    const el = bubbleBlockRef.current;
    const quickEl = quickReactionsRef.current;
    if (!el || !quickEl) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_VIEWPORT_GAP;
    const spaceAbove = rect.top - MENU_VIEWPORT_GAP;
    // prefer below if there's room, otherwise above
    setMenuPlacement((prev) => (spaceBelow >= 120 ? "below" : spaceAbove >= 120 ? "above" : prev));
  }, [showQuickReactions, computeMenuPlacement]);

  const handleReactionPickerEnter = useCallback(() => {
    if (reactionPickerCloseTimer.current) {
      clearTimeout(reactionPickerCloseTimer.current);
      reactionPickerCloseTimer.current = null;
    }
  }, []);

  const handleReactionPickerLeave = useCallback(() => {
    reactionPickerCloseTimer.current = setTimeout(() => {
      setShowReactionPicker(false);
    }, 280);
  }, []);

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isRightSwipe && onReply && !selectionMode) onReply(message);
  };

  const handleDelete = (deleteForEveryone: boolean) => {
    onDelete?.(message.id, deleteForEveryone);
    setShowMenu(false);
  };

  const startComposerEdit = () => {
    if (!isOwnMessage || !onBeginEdit || !isEditableTextMessage(message)) return;
    onBeginEdit(message);
    setShowMenu(false);
  };

  const handleReply = () => {
    onReply?.(message);
    setShowMenu(false);
  };

  const handleCopyText = async () => {
    const txt = (translationDisplay?.text || message.content || "").trim();
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(stripMarkdown(txt));
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
    setShowMenu(false);
  };

  React.useEffect(() => {
    if (!showMenu && !showQuickReactions && !showReactionPicker) return;
    const handlePointerDown = (e: MouseEvent) => {
      const el = bubbleBlockRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setShowMenu(false);
      setShowQuickReactions(false);
      setShowReactionPicker(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showMenu, showQuickReactions, showReactionPicker]);

  const isDeleted = message.is_deleted;
  const isDeletedForMe = message.deleted_for?.includes(currentUserId) ?? false;

  const canEditMessage = isOwnMessage && Boolean(onBeginEdit) && isEditableTextMessage(message);
  const canDeleteForEveryone = isOwnMessage && Boolean(onDelete);
  const canDeleteForMe = Boolean(onDelete);
  const canForward = Boolean(onForward) && isForwardableChatMessage(message);
  const canShowInfo = isOwnMessage && Boolean(onShowInfo) && !isDeleted;
  const canCopy = Boolean((message.content || "").trim());
  const canTranslate =
    Boolean(onTranslateMessage) &&
    !isOwnMessage &&
    !isDeleted &&
    (message.message_type || "text") === "text" &&
    Boolean((message.content || "").trim());
  const offerTranslateLink =
    canTranslate &&
    shouldOfferMessageTranslate(message.content || "", defaultTranslateLanguage);
  const showOverflowMenu =
    canEditMessage ||
    canDeleteForMe ||
    canForward ||
    canShowInfo ||
    canCopy ||
    Boolean(onReply);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!showOverflowMenu && !onReact) return;
    openMessageMenu();
  };

  const handleForwardClick = () => {
    if (onForward && isForwardableChatMessage(message)) onForward(message);
    setShowMenu(false);
  };

  const openPlaceholder = (feature: string) => {
    toast(`${feature} is not available yet`, { icon: "ℹ️" });
    setShowMenu(false);
  };

  const messageOverflowMenuSections = useMemo((): ChatHeaderOptionsMenuSection[] => {
    const primary: ChatHeaderOptionsMenuItem[] = [
      ...(onReply
        ? [
          {
            id: "reply",
            label: "Reply",
            Icon: Reply,
            onClick: () => {
              handleReply();
            },
          },
        ]
        : []),
      ...(canCopy
        ? [
          {
            id: "copy",
            label: "Copy",
            Icon: Copy,
            onClick: () => {
              void handleCopyText();
            },
          },
        ]
        : []),
      ...(canForward
        ? [
          {
            id: "forward",
            label: "Forward",
            Icon: Forward,
            onClick: () => {
              handleForwardClick();
            },
          },
        ]
        : []),
      ...(canEditMessage
        ? [
          {
            id: "edit",
            label: "Edit",
            Icon: Pencil,
            onClick: () => {
              startComposerEdit();
            },
          },
        ]
        : []),
    ];

    const secondary: ChatHeaderOptionsMenuItem[] = [

      ...(canShowInfo
        ? [
          {
            id: "message-info",
            label: "Message info",
            Icon: Info,
            onClick: () => {
              onShowInfo?.(message);
              setShowMenu(false);
            },
          },
        ]
        : []),
    ];

    const destructive: ChatHeaderOptionsMenuItem[] = [

      ...(canDeleteForMe
        ? [
          {
            id: "delete-for-me",
            label: "Delete for me",
            Icon: Trash2,
            onClick: () => handleDelete(false),
          },
        ]
        : []),
      ...(canDeleteForEveryone
        ? [
          {
            id: "delete-for-everyone",
            label: "Delete for everyone",
            Icon: Trash2,
            tone: "danger" as const,
            onClick: () => handleDelete(true),
          },
        ]
        : []),
    ];

    return [
      { id: "primary", items: primary },
      ...(secondary.length > 0 ? [{ id: "secondary", items: secondary }] : []),
      { id: "destructive", items: destructive },
    ];
  }, [
    message,
    onReply,
    onForward,
    onBeginEdit,
    onDelete,
    onShowInfo,
    canCopy,
    canForward,
    canEditMessage,
    canShowInfo,
    canDeleteForMe,
    canDeleteForEveryone,
    handleReply,
    handleCopyText,
    handleForwardClick,
    startComposerEdit,
    handleDelete,
    openPlaceholder,
  ]);

  if (isDeletedForMe) return null;

  if (toCallSessionStatusMessageType(message.message_type || "") === "ended") {
    return (
      <div className="mb-2 flex justify-center animate-[chatMsgIn_200ms_ease-out]">
        <div className="flex items-center gap-2 rounded-full bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-content-secondary shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] backdrop-blur-sm">
          <span>{message.content || "Call ended"}</span>
        </div>
      </div>
    );
  }

  if (message.message_type === "group_member_joined" || message.message_type === "group_member_left") {
    return (
      <div className="mb-2 flex justify-center animate-[chatMsgIn_200ms_ease-out]">
        <div className="flex items-center gap-2 rounded-full bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-content-secondary shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] backdrop-blur-sm">
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  if (message.message_type === "marketplace_system") {
    return (
      <div className="mb-2 flex justify-center animate-[chatMsgIn_200ms_ease-out]">
        <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-medium text-amber-900 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-amber-950/50 dark:text-amber-100">
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  const systemMessageTypes = [
    "initiated",
    "ringing",
    "active",
    "ended",
    "failed",
    "call_notification",
    "hand_raised",
    "reaction",
    "screen_share_started",
    "screen_share_stopped",
  ];

  if (systemMessageTypes.includes(message.message_type ?? "")) return null;

  const getMessageStatus = (): "sending" | "sent" | "delivered" | "read" => {
    if (!isOwnMessage) return "sent";
    if (message.id.startsWith("optimistic:")) return "sending";
    const otherParticipants = threadParticipants.filter((id) => id !== currentUserId);
    if (otherParticipants.length === 0) return "sent";

    if (message.read_by && Array.isArray(message.read_by)) {
      const otherParticipantsWhoRead = otherParticipants.filter((id) => message.read_by!.includes(id));
      if (otherParticipantsWhoRead.length > 0) return "read";
    }

    const hasOnlineRecipient = otherParticipants.some((id) => participantPresence[id] === "online");
    return hasOnlineRecipient ? "delivered" : "sent";
  };

  const messageStatus = getMessageStatus();
  const showEditedBadge = Boolean(message.is_edited);
  const showForwardBadge = Boolean(message.is_forward);
  const isComposerEditingThis =
    Boolean(composerEditingMessageId) && composerEditingMessageId === message.id && !isDeleted;

  const callPresentation =
    !isDeleted && !(message.attachments && message.attachments.length > 0)
      ? getCallBubblePresentation(message)
      : null;

  const locationPayload =
    !isDeleted &&
    (message.message_type === "location" ||
      Boolean(tryParseChatLocationContent(message.content)))
      ? tryParseChatLocationContent(message.content) ||
        (message.message_type === "location"
          ? {
              display_name:
                message.content?.trim() || "Location",
            }
          : null)
      : null;

  /** Outgoing / incoming bubble fill — WhatsApp-inspired, tokenized for themes */
  const bubbleBg = isOwnMessage ? "chat-bubble-own" : "bg-surface";
  const forwardAccent =
    showForwardBadge && isOwnMessage ? "border-l-[3px] border-[#25d366] pl-[9px]" : "";
  const emojiOnly =
    !isDeleted &&
    !locationPayload &&
    !(message.attachments && message.attachments.length > 0) &&
    isEmojiOnlyMessage(stripMarkdown(message.content || ""));
  const sharedPostId =
    !isDeleted && !locationPayload && message.content
      ? extractConnectAfrikPostId(stripMarkdown(message.content))
      : null;
  const sourceContent = translationDisplay?.text ?? message.content ?? "";
  const displayContent = sharedPostId
    ? stripConnectAfrikPostUrls(sourceContent)
    : sourceContent;
  const linkPreviewUrl =
    !isDeleted &&
    !emojiOnly &&
    !locationPayload &&
    !sharedPostId &&
    message.content
      ? extractFirstUrl(stripMarkdown(message.content))
      : null;
  const toggleExpanded = (messageId: string) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const isExpanded = expandedMessages[message.id];
  const plainContent = stripMarkdown(
    sharedPostId ? displayContent : message.content || ""
  );
  const shouldTruncate = plainContent.length > MESSAGE_PREVIEW_LIMIT;

  const activeReactions = (message.reactions ?? [])
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const reactionTotal = activeReactions.reduce((sum, r) => sum + r.count, 0);
  const hasReactions = activeReactions.length > 0;

  const reactionsEndpoint = `/api/chat/threads/${threadId}/messages/${message.id}/reactions`;

  const fallbackReactionGroups = useMemo<ReactionsModalGroup[]>(
    () =>
      activeReactions.map((r) => ({
        type: r.emoji,
        count: r.count,
        users: [],
      })),
    [activeReactions]
  );

  const openReactionsModal = useCallback(async () => {
    setShowReactionsModal(true);
    setReactionModalGroups(fallbackReactionGroups);
    try {
      const res = await apiClient.get<{
        data: Array<{
          emoji?: string
          type?: string
          count: number
          users: ReactionsModalGroup['users']
        }>
      }>(reactionsEndpoint);
      const groups = (res?.data || []).map((g) => ({
        type: g.type ?? g.emoji ?? '',
        count: g.count,
        users: g.users ?? [],
      }));
      if (groups.length > 0) {
        setReactionModalGroups(groups);
      }
    } catch {
      toast.error('Could not load reactions');
    }
  }, [reactionsEndpoint, fallbackReactionGroups]);

  return (
    <div
      className={`relative flex items-end gap-1.5 animate-[chatMsgIn_220ms_ease-out] sm:gap-2 ${hasReactions ? "mb-8" : "mb-1.5"} ${isOwnMessage ? "flex-row-reverse justify-end" : "justify-start"}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowReactionPicker(false);
      }}
    >
      <div
        className={`relative min-w-0 max-w-[88%] flex-1 sm:max-w-[min(82%,440px)] ${isOwnMessage ? "ml-auto flex flex-col items-end" : "mr-auto flex flex-col items-start"}`}
      >
        {showSenderHeader && !isOwnMessage && message.sender ? (
          <div className="mb-0.5 flex max-w-full items-center gap-1.5 px-1">
            {message.sender.avatarUrl ? (
              <img
                src={message.sender.avatarUrl}
                alt=""
                className="h-5 w-5 rounded-full object-cover ring-1 ring-black/5"
              />
            ) : (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{
                  backgroundColor: participantNameColor(
                    message.sender.id || message.sender_id
                  ),
                }}
              >
                {(message.sender.name || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span
              className="truncate text-[12px] font-semibold cursor-pointer hover:underline"
              style={{
                color: participantNameColor(message.sender.id || message.sender_id),
              }}
              onClick={() => router.push(`/user/${message?.sender?.id}`)}
            >
              {message.sender?.name}
            </span>
          </div>
        ) : null}

        <div className="group/bubble relative" ref={bubbleBlockRef}>
          <div
            className={`relative inline-block max-w-full overflow-visible px-2.5 pb-1.5 pt-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-shadow ${
              emojiOnly
                ? "bg-transparent shadow-none px-1"
                : `${bubbleBg} rounded-br-[10px] rounded-bl-[10px] ${
                    isOwnMessage
                      ? "rounded-tl-[10px] rounded-tr-[4px] after:pointer-events-none after:absolute after:-right-[6px] after:top-0 after:border-y-[6px] after:border-y-transparent after:border-l-[7px] after:border-l-[var(--chat-bubble-own)]"
                      : "rounded-tr-[10px] rounded-tl-[4px] before:pointer-events-none before:absolute before:-left-[6px] before:top-0 before:border-y-[6px] before:border-y-transparent before:border-r-[7px] before:border-r-[var(--surface-primary)]"
                  }`
            } ${forwardAccent} ${
              isComposerEditingThis
                ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent"
                : ""
            }`}
          >
            {!isDeleted && (showOverflowMenu || onReact) && !selectionMode && (isHovered || showMenu || showQuickReactions || showReactionPicker) ? (
              <div className="absolute right-0 top-0 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMessageMenu();
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-bl-[18px] rounded-tl-2xl rounded-br-[18px] bg-black/10 text-white backdrop-blur-sm transition hover:bg-black/20 hover:text-white/90"
                  aria-label="Open message actions"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {!isDeleted && onReact && !selectionMode && (isHovered || showMenu || showQuickReactions || showReactionPicker) ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuickReactions((s) => !s);
                  setShowMenu(false);
                }}
                className={`absolute z-30 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-content-secondary shadow-[0_1px_1px_rgba(11,20,26,0.2)] ring-1 ring-black/5 transition hover:bg-surface-hover -top-3 left-1/2 -translate-x-1/2 sm:top-1/2 sm:left-auto sm:-translate-y-1/2 sm:translate-x-0 ${
                  isOwnMessage ? "sm:-left-9" : "sm:-right-9"
                }`}
                aria-label="Add reaction"
              >
                <Smile className="h-4 w-4" />
              </button>
            ) : null}
            {/* emojis */}
            <div>
              {onReact ? (
                <div
                  ref={quickReactionsRef}
                  className={`absolute z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-full bg-surface px-1.5 py-1 shadow-[0_6px_18px_rgba(11,20,26,0.18)] ring-1 ring-black/[0.06] transform-gpu transition-all duration-150 ease-out scrollbar-thin ${
                    menuPlacement === "above"
                      ? "bottom-full mb-2"
                      : "top-full mt-2"
                  } left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 ${
                    isOwnMessage ? "sm:right-0" : "sm:left-0"
                  } ${
                    showQuickReactions
                      ? "pointer-events-auto scale-100 opacity-100"
                      : "pointer-events-none scale-95 opacity-0"
                  }`}
                  style={{ willChange: "transform, opacity" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {WA_QUICK_REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReact(message.id, emoji);
                        setShowQuickReactions(false);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[22px] transition hover:bg-surface-hover noto-color-emoji-regular"
                      aria-label={`React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReactionPicker((prev) => !prev);
                      // keep quick reactions visible while picker is open
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-content-secondary hover:bg-surface-hover"
                    aria-label="More reactions"
                  >
                    <TbMoodPlus className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
              {showReactionPicker && onReact ? (
                <div
                  className={`absolute z-50 noto-color-emoji-regular flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-full bg-surface px-1.5 py-1 shadow-[0_6px_18px_rgba(11,20,26,0.18)] ring-1 ring-black/[0.06] transform-gpu transition-all duration-150 ease-out scrollbar-thin ${
                    menuPlacement === "above"
                      ? "bottom-full mb-2"
                      : "top-full mt-2"
                  } left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 ${
                    isOwnMessage ? "sm:right-0" : "sm:left-0"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={handleReactionPickerEnter}
                  onMouseLeave={handleReactionPickerLeave}
                >
                  {PICKER_REACTIONS.map((kind: ReactionKind) => (
                    <button
                      key={`extra-${kind}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReactionPicker(false);
                        onReact(message.id, KIND_TO_EMOJI[kind]);
                        setShowMenu(false);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[22px] transition hover:bg-surface-hover noto-color-emoji-regular"
                    >
                      <ReactionIcon type={kind} size={22} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {showMenu ? (
              <div
                ref={messageMenuRef}
                className={`absolute z-[9999] flex max-w-[calc(100vw-1rem)] flex-col items-stretch gap-1 ${
                  isOwnMessage ? "right-0 items-end sm:right-full sm:mr-1" : "left-0 items-start sm:left-full sm:ml-1"
                } ${
                  menuPlacement === "above"
                    ? "bottom-full mb-2"
                    : menuPlacement === "side"
                      ? "top-4"
                      : "top-full mt-2 sm:top-4 sm:mt-0"
                }`}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={handleReactionPickerEnter}
                onMouseLeave={handleReactionPickerLeave}
              >


                {(showOverflowMenu || onReact) && messageOverflowMenuSections.length > 0 ? (
                  <div
                    role="menu"
                    className="min-w-[200px] max-w-[280px] overflow-hidden rounded-lg bg-surface py-1 shadow-[0_2px_5px_rgba(11,20,26,0.26)] ring-1 ring-black/[0.08]"
                  >
                    {messageOverflowMenuSections.map((section, sectionIdx) => (
                      <Fragment key={section.id}>
                        {sectionIdx > 0 ? <div role="separator" className="my-1 h-px bg-border-subtle" /> : null}
                        {section.items.map((item) => {
                          const { id, label, Icon, tone = "default", trailing, disabled, onClick } = item;
                          const baseRow =
                            "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] leading-snug transition-colors";
                          const rowClass = disabled
                            ? `${baseRow} cursor-not-allowed text-content-tertiary opacity-60`
                            : tone === "danger"
                              ? `${baseRow} text-red-600 hover:bg-red-50`
                              : `${baseRow} text-content hover:bg-surface-hover`;
                          return (
                            <button
                              key={id}
                              type="button"
                              role="menuitem"
                              disabled={disabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                              }}
                              className={rowClass}
                            >
                              <Icon
                                className={`h-[18px] w-[18px] shrink-0 ${disabled ? "text-content-tertiary" : tone === "danger" ? "text-red-600" : "text-content-secondary"
                                  }`}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1">{label}</span>
                              {trailing ? <span className="shrink-0">{trailing}</span> : null}
                            </button>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {showForwardBadge && !isDeleted ? (
              <div className="mb-1 flex items-center gap-1 pr-1">
                <ChevronsRight
                  className="h-3.5 w-3.5 shrink-0 text-content-tertiary"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="text-[12px] italic leading-snug text-content-tertiary">Forwarded</span>
              </div>
            ) : null}

            {message.reply_to_id && !isDeleted ? (
              <div
                className={`mb-1.5 max-w-full overflow-hidden rounded-lg border-l-[3px] px-2 py-1.5 ${
                  isOwnMessage
                    ? "border-[#25d366] bg-black/[0.06] dark:bg-white/10"
                    : "border-primary-500 bg-surface-secondary/70"
                }`}
              >
                <div className="text-[11px] font-semibold text-primary-700 dark:text-primary-300">
                  Reply
                </div>
                <div className="truncate text-[12px] italic text-content-tertiary">
                  Original message
                </div>
              </div>
            ) : null}

            {isDeleted ? (
              <p className="pr-1 text-sm italic text-content-tertiary">This message was deleted</p>
            ) : callPresentation ? (
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-[0_0.5px_1.5px_rgba(11,20,26,0.12)]">
                  {callPresentation.variant === "missed" ? (
                    <PhoneMissed className="h-[22px] w-[22px] text-[#ea0038]" strokeWidth={2} aria-hidden />
                  ) : isOwnMessage ? (
                    <PhoneOutgoing className="h-[21px] w-[21px] text-content" strokeWidth={2} aria-hidden />
                  ) : (
                    <PhoneIncoming className="h-[21px] w-[21px] text-content" strokeWidth={2} aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[15px] font-medium leading-snug text-content">{callPresentation.title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-content-tertiary">{callPresentation.subtitle}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-end self-stretch">
                  <div className="flex items-end justify-end gap-1">
                    {showEditedBadge ? (
                      <span className="text-[11px] lowercase leading-none text-content-tertiary">edited</span>
                    ) : null}
                    <span className="shrink-0 text-[11px] tabular-nums text-content-tertiary">
                      {format(new Date(message.created_at), "HH:mm")}
                    </span>
                    <MessageStatusIndicator status={messageStatus} isOwnMessage={isOwnMessage} />
                  </div>
                </div>
              </div>
            ) : locationPayload ? (
              <ChatLocationCard location={locationPayload} isOwnMessage={isOwnMessage} />
            ) : emojiOnly ? (
              <div className="px-1 py-0.5">
                <p className="noto-color-emoji-regular text-[36px] leading-none tracking-wide sm:text-[42px]">
                  {plainContent.trim()}
                </p>
              </div>
            ) : (
              <>
                {message.attachments && message.attachments.length > 0 ? (
                  <MessageAttachments
                    attachments={message.attachments}
                    isOwnMessage={isOwnMessage}
                    onOpenMedia={(items, index) => setMediaViewer({ items, index })}
                  />
                ) : null}

                {sharedPostId ? (
                  <ChatPostCard postId={sharedPostId} isOwnMessage={isOwnMessage} />
                ) : null}

                {linkPreviewUrl ? (
                  <a
                    href={linkPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`mb-1.5 flex w-[min(100%,280px)] items-start gap-2 overflow-hidden rounded-lg border-l-[3px] p-2 transition hover:opacity-95 ${
                      isOwnMessage
                        ? "border-[#128c7e] bg-black/[0.05] dark:bg-white/10"
                        : "border-primary-500 bg-surface-secondary/60"
                    }`}
                  >
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-content-tertiary" />
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-content">Link</p>
                      <p className="truncate text-[11px] text-content-tertiary">{linkPreviewUrl}</p>
                    </div>
                  </a>
                ) : null}

                {displayContent.trim() ? (
                  <ChatRichTextRenderer
                    content={displayContent}
                    isOwnMessage={isOwnMessage}
                    maxChars={MESSAGE_PREVIEW_LIMIT}
                    expanded={Boolean(isExpanded) || !shouldTruncate}
                    onToggleExpand={() => toggleExpanded(message.id)}
                  />
                ) : null}

                {canTranslate &&
                !isDeleted &&
                !locationPayload &&
                (offerTranslateLink ||
                  isTranslating ||
                  translationDisplay?.isTranslated ||
                  (activeTranslationLanguage && showOriginalOverride) ||
                  (activeTranslationLanguage &&
                    !translationDisplay?.isTranslated &&
                    !showOriginalOverride)) ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    {isTranslating ||
                    (activeTranslationLanguage &&
                      !translationDisplay?.isTranslated &&
                      !showOriginalOverride) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-content-tertiary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Translating…
                      </span>
                    ) : translationDisplay?.isTranslated ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleShowOriginal?.();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline"
                      >
                        <Languages className="h-3 w-3" />
                        Show original
                      </button>
                    ) : activeTranslationLanguage && showOriginalOverride ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleShowOriginal?.();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline"
                      >
                        <Languages className="h-3 w-3" />
                        Show translation
                      </button>
                    ) : offerTranslateLink ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTranslateMessage?.(defaultTranslateLanguage);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline"
                      >
                        <Languages className="h-3 w-3" />
                        Translate to{" "}
                        {messageTranslationLanguageLabel(defaultTranslateLanguage)}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}

            {!callPresentation ? (
              <div className="mt-0.5 flex items-end justify-end gap-1 pl-6">
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-0">
                  {showEditedBadge ? (
                    <span className="text-[11px] lowercase leading-none text-content-tertiary">edited</span>
                  ) : null}
                  <span className="shrink-0 text-[11px] tabular-nums text-content-tertiary">
                    {format(new Date(message.created_at), "HH:mm")}
                  </span>
                </div>
                <MessageStatusIndicator status={messageStatus} isOwnMessage={isOwnMessage} />
              </div>
            ) : null}

            {hasReactions && !isDeleted ? (
              <button
                type="button"
                role="group"
                aria-label="View message reactions"
                onClick={(e) => {
                  e.stopPropagation();
                  void openReactionsModal();
                }}
                className={`absolute z-10 flex max-w-[min(100%,200px)] cursor-pointer items-center rounded-full bg-surface p-1 shadow-[0_1px_3px_rgba(11,20,26,0.16)] ring-1 ring-border-subtle transition hover:bg-surface-hover hover:scale-105 noto-color-emoji-regular animate-[chatReactPop_280ms_ease-out] ${isOwnMessage
                    ? "-bottom-4 right-2 "
                    : "-bottom-4 left-2  "
                  }`}
              >
                {activeReactions.slice(0, 3).map((reaction, index) => (
                  <span
                    key={reaction.emoji}
                    className={`flex shrink-0 items-center justify-center rounded-full p-px ${index > 0 ? "-ml-0.5" : ""
                      }`}
                    aria-hidden
                  >
                    <span className="text-[13px] leading-none">{reaction.emoji}</span>
                  </span>
                ))}
                {reactionTotal > 1 ? (
                  <span className="min-w-[10px] shrink-0 pl-0.5 text-[11px] font-normal tabular-nums leading-none text-content-tertiary">
                    {reactionTotal}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ReactionsModal
        isOpen={showReactionsModal}
        onClose={() => setShowReactionsModal(false)}
        reactionGroups={
          reactionModalGroups.length > 0 ? reactionModalGroups : fallbackReactionGroups
        }
        reactionsEndpoint={reactionsEndpoint}
        reactionDisplay="emoji"
        onUserClick={(userId) => router.push(`/user/${userId}`)}
      />

      <ChatMediaViewer
        open={Boolean(mediaViewer)}
        items={mediaViewer?.items ?? []}
        initialIndex={mediaViewer?.index ?? 0}
        onClose={() => setMediaViewer(null)}
      />
    </div>
  );
};
