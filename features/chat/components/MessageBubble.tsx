import MessageStatusIndicator from "@/features/chat/components/MessageStatusIndicator";
import type {
  ChatHeaderOptionsMenuItem,
  ChatHeaderOptionsMenuSection,
} from "@/features/chat/types/chatHeaderOptionsMenu";
import type { ChatMessage } from "@/features/chat/services/supabaseMessagingService";
import { getChatMessageAuthorId, supabaseMessagingService } from "@/features/chat/services/supabaseMessagingService";
import { ApiError } from "@/lib/api-client";
import {
  isViewOnceMessage,
  viewOnceKindFromMessage,
} from "@/features/chat/viewOnce";
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
  Check,
  ChevronDown,
  ChevronsRight,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Forward,
  Info,
  Languages,
  Loader2,
  Pencil,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Pin,
  Reply,
  Share2,
  Smile,
  Square,
  Trash2,
  UserPlus,
  Video,
  MessageSquare,
} from '@/shared/icons';
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
import ViewOncePlaceholder from "./ViewOncePlaceholder";
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
    <div className="flex justify-center py-2">
      <span className="rounded-[7px] border border-[#e9edef] bg-white px-3 py-[5px] text-[12.5px] font-medium text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.08)] dark:border-border dark:bg-surface dark:text-content-secondary">
        {label}
      </span>
    </div>
  );
}

export function ChatUnreadDivider() {
  return (
    <div className="relative my-2.5 flex items-center justify-center px-2" role="separator" aria-label="Unread messages">
      <div className="absolute inset-x-3 top-1/2 h-px bg-[#e9edef] dark:bg-border sm:inset-x-6" />
      <span className="relative z-[1] rounded-[7px] border border-[#e9edef] bg-white px-2.5 py-[3px] text-[11px] font-medium uppercase tracking-wide text-[#54656f] dark:border-border dark:bg-surface dark:text-content-secondary">
        Unread messages
      </span>
    </div>
  );
}

function isEditableTextMessage(m: ChatMessage): boolean {
  if (m.is_deleted) return false;
  if (isViewOnceMessage(m)) return false;
  const t = m.message_type || "text";
  return t === "text";
}

function isForwardableChatMessage(m: ChatMessage): boolean {
  if (m.is_deleted) return false;
  if (isViewOnceMessage(m)) return false;
  const hasText = Boolean(m.content?.trim());
  const hasAtt = Boolean(m.attachments && m.attachments.length > 0);
  return hasText || hasAtt;
}

function formatReplyQuote(message: ChatMessage | null | undefined): {
  senderName: string;
  preview: string;
} {
  if (!message) {
    return { senderName: "Reply", preview: "Original message" };
  }

  const senderName = message.sender?.name || "Unknown";
  if (message.is_deleted) {
    return { senderName, preview: "This message was deleted" };
  }
  if (isViewOnceMessage(message)) {
    const kind = viewOnceKindFromMessage(message);
    if (message.view_once_opened) {
      return { senderName, preview: kind === "video" ? "Opened video" : "Opened photo" };
    }
    return { senderName, preview: kind === "video" ? "Video · View once" : "Photo · View once" };
  }
  if (message.attachments?.length) {
    const att = message.attachments[0];
    if (att.type === "image") return { senderName, preview: "Photo" };
    if (att.type === "video") return { senderName, preview: "Video" };
    return { senderName, preview: att.name || "Attachment" };
  }

  const mt = (message.message_type || "text").toLowerCase();
  if (mt === "location") return { senderName, preview: "Location" };
  if (mt === "audio" || mt === "voice") return { senderName, preview: "Voice message" };

  const text = stripMarkdown(message.content || "").replace(/\s+/g, " ").trim();
  return { senderName, preview: text || "Message" };
}

/** WhatsApp-style voice / missed call row inside a bubble */
function getCallBubblePresentation(
  message: ChatMessage,
): { variant: "missed" | "voice" | "video"; title: string; subtitle: string } | null {
  const mt = (message.message_type || "").toLowerCase();
  const content = (message.content || "").trim();
  const contentLower = content.toLowerCase();
  const callType =
    typeof message.metadata?.callType === "string"
      ? message.metadata.callType.toLowerCase()
      : typeof message.metadata?.call_type === "string"
        ? message.metadata.call_type.toLowerCase()
        : "audio";

  if (mt === "accepted_on_another_device") {
    return {
      variant: callType === "video" ? "video" : "voice",
      title: callType === "video" ? "Video call" : "Voice call",
      subtitle: "Accepted on another device",
    };
  }

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
  onScrollToMessage?: (messageId: string) => void;
  repliedToMessage?: ChatMessage | null;
  highlighted?: boolean;
  composerEditingMessageId?: string | null;
  onReact?: (messageId: string, emoji: string) => void;
  onShowInfo?: (message: ChatMessage) => void;
  selectionMode?: boolean;
  isMessageSelected?: boolean;
  onEnterSelection?: (message: ChatMessage) => void;
  onToggleSelect?: (message: ChatMessage) => void;
  /** Group chats: start a 1:1 reply quoting this message */
  onReplyPrivately?: (message: ChatMessage) => void;
  /** Group chats: open a 1:1 chat with the sender */
  onMessageSender?: (message: ChatMessage) => void;
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
  isUploading?: boolean;
  uploadProgressById?: Record<string, number>;
  onCancelUpload?: () => void;
  /** First bubble in a consecutive same-sender cluster — shows the WhatsApp tail */
  showTail?: boolean;
  /** Last bubble in a consecutive same-sender cluster */
  isClusterEnd?: boolean;
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
  onScrollToMessage,
  repliedToMessage = null,
  highlighted = false,
  composerEditingMessageId = null,
  onReact,
  onShowInfo,
  selectionMode = false,
  isMessageSelected = false,
  onEnterSelection,
  onToggleSelect,
  onReplyPrivately,
  onMessageSender,
  showSenderHeader = false,
  translationDisplay,
  isTranslating = false,
  activeTranslationLanguage = null,
  showOriginalOverride = false,
  defaultTranslateLanguage = "en",
  onTranslateMessage,
  onToggleShowOriginal,
  isUploading = false,
  uploadProgressById,
  onCancelUpload,
  showTail = true,
  isClusterEnd = true,
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
    viewOnce?: boolean;
    messageId?: string;
  } | null>(null);
  const [viewOnceOpening, setViewOnceOpening] = useState(false);
  const [viewOnceOpenedLocal, setViewOnceOpenedLocal] = useState(false);
  const viewOnceBlobUrlsRef = useRef<string[]>([]);

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
    setShowQuickReactions(false);
    setShowMenu((open) => {
      if (open) return false;
      setMenuPlacement(computeMenuPlacement());
      return true;
    });
  }, [computeMenuPlacement]);

  const openMessageMenu = useCallback(() => {
    setShowQuickReactions(false);
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
  const hasAttachments = Boolean(message.attachments && message.attachments.length > 0);
  const isViewOnce = isViewOnceMessage(message);
  const viewOnceOpened = Boolean(message.view_once_opened) || viewOnceOpenedLocal;
  const viewOnceKind = viewOnceKindFromMessage(message);
  const canSaveOrOpen = hasAttachments && !isDeleted && !isUploading && !isViewOnce;
  const canSelect = Boolean(onEnterSelection) && !isDeleted;
  const canReport = !isOwnMessage && !isDeleted;
  const senderId = getChatMessageAuthorId(message);
  const senderName = (message.sender?.name || "User").trim() || "User";
  const canReplyPrivately =
    Boolean(onReplyPrivately) && !isOwnMessage && !isDeleted && Boolean(senderId);
  const canMessageSender =
    Boolean(onMessageSender) && !isOwnMessage && !isDeleted && Boolean(senderId);
  const messageSenderLabel =
    senderName.length > 28 ? `Message ${senderName.slice(0, 26)}...` : `Message ${senderName}`;
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
    canSaveOrOpen ||
    canSelect ||
    canReport ||
    canReplyPrivately ||
    canMessageSender ||
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

  const firstAttachment = message.attachments?.[0];

  const handleSaveAs = () => {
    if (isViewOnceMessage(message) || !firstAttachment?.url) return;
    const a = document.createElement("a");
    a.href = firstAttachment.url;
    a.download = firstAttachment.name || "file";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShowMenu(false);
  };

  const handleOpenWith = () => {
    if (isViewOnceMessage(message) || !firstAttachment?.url) return;
    window.open(firstAttachment.url, "_blank", "noopener,noreferrer");
    setShowMenu(false);
  };

  const handleShareAttachment = async () => {
    if (isViewOnceMessage(message) || !firstAttachment?.url) return;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: firstAttachment.name || "Attachment",
          url: firstAttachment.url,
        });
      } else {
        await navigator.clipboard.writeText(firstAttachment.url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled share */
    }
    setShowMenu(false);
  };

  const revokeViewOnceBlobs = useCallback(() => {
    viewOnceBlobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    });
    viewOnceBlobUrlsRef.current = [];
  }, []);

  const closeMediaViewer = useCallback(() => {
    const wasViewOnce = Boolean(mediaViewer?.viewOnce);
    const viewOnceMessageId = mediaViewer?.messageId;
    revokeViewOnceBlobs();
    setMediaViewer(null);
    if (wasViewOnce && viewOnceMessageId) {
      void supabaseMessagingService.completeViewOnce(threadId, viewOnceMessageId);
    }
  }, [mediaViewer, revokeViewOnceBlobs, threadId]);

  const handleOpenViewOnce = useCallback(async () => {
    if (!isViewOnceMessage(message) || isOwnMessage || viewOnceOpening) return;
    if (message.view_once_opened || viewOnceOpenedLocal) {
      toast.error("This message is no longer available");
      return;
    }
    setViewOnceOpening(true);
    try {
      const claimed = await supabaseMessagingService.claimViewOnce(threadId, message.id);
      setViewOnceOpenedLocal(true);
      const items: ChatMediaViewerItem[] = [];
      for (const att of claimed.attachments) {
        if (att.type !== "image" && att.type !== "video") continue;
        const blob = await supabaseMessagingService.fetchViewOnceMedia(
          threadId,
          message.id,
          att.id,
          claimed.token
        );
        const objectUrl = URL.createObjectURL(blob);
        viewOnceBlobUrlsRef.current.push(objectUrl);
        items.push({
          id: att.id,
          url: objectUrl,
          name: att.name,
          type: att.type,
          mimeType: att.mimeType,
        });
      }
      if (!items.length) {
        toast.error("This message is no longer available");
        void supabaseMessagingService.completeViewOnce(threadId, message.id);
        return;
      }
      setMediaViewer({ items, index: 0, viewOnce: true, messageId: message.id });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 409 || status === 410) {
        setViewOnceOpenedLocal(true);
        toast.error("This message is no longer available");
      } else if (status === 403) {
        toast.error("You cannot open this View Once message");
      } else {
        toast.error(error instanceof Error ? error.message : "Could not open View Once message");
      }
    } finally {
      setViewOnceOpening(false);
    }
  }, [isOwnMessage, message, threadId, viewOnceOpenedLocal, viewOnceOpening]);

  React.useEffect(() => {
    setViewOnceOpenedLocal(false);
  }, [message.id]);

  React.useEffect(() => {
    return () => {
      viewOnceBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      });
    };
  }, []);

  const handleReport = () => {
    toast.success("Thanks, we received your report");
    setShowMenu(false);
  };

  const handleSelect = () => {
    onEnterSelection?.(message);
    setShowMenu(false);
  };

  const messageOverflowMenuSections = useMemo((): ChatHeaderOptionsMenuSection[] => {
    const primary: ChatHeaderOptionsMenuItem[] = [
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
      ...(canReplyPrivately
        ? [
          {
            id: "reply-privately",
            label: "Reply privately",
            Icon: UserPlus,
            onClick: () => {
              onReplyPrivately?.(message);
              setShowMenu(false);
            },
          },
        ]
        : []),
      ...(canMessageSender
        ? [
          {
            id: "message-sender",
            label: messageSenderLabel,
            Icon: MessageSquare,
            onClick: () => {
              onMessageSender?.(message);
              setShowMenu(false);
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
      ...(!isDeleted
        ? [
          {
            id: "pin",
            label: "Pin",
            Icon: Pin,
            onClick: () => {
              toast("Pin is not available yet", { icon: "ℹ️" });
              setShowMenu(false);
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

    const media: ChatHeaderOptionsMenuItem[] = [
      ...(canSelect
        ? [
          {
            id: "select",
            label: "Select",
            Icon: Square,
            onClick: handleSelect,
          },
        ]
        : []),
      ...(canSaveOrOpen
        ? [
          {
            id: "save-as",
            label: "Save as",
            Icon: Download,
            onClick: handleSaveAs,
          },
          {
            id: "share",
            label: "Share",
            Icon: Share2,
            onClick: () => {
              void handleShareAttachment();
            },
          },
          {
            id: "open-with",
            label: "Open with",
            Icon: ExternalLink,
            onClick: handleOpenWith,
          },
        ]
        : []),
    ];

    const destructive: ChatHeaderOptionsMenuItem[] = [
      ...(canReport
        ? [
          {
            id: "report",
            label: "Report",
            Icon: Flag,
            onClick: handleReport,
          },
        ]
        : []),
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
      ...(media.length > 0 ? [{ id: "media", items: media }] : []),
      ...(destructive.length > 0 ? [{ id: "destructive", items: destructive }] : []),
    ];
  }, [
    message,
    onReply,
    onForward,
    onBeginEdit,
    onDelete,
    onShowInfo,
    onReplyPrivately,
    onMessageSender,
    canReplyPrivately,
    canMessageSender,
    messageSenderLabel,
    canCopy,
    canForward,
    canEditMessage,
    canShowInfo,
    canDeleteForMe,
    canDeleteForEveryone,
    canSaveOrOpen,
    canSelect,
    canReport,
    isDeleted,
    handleReply,
    handleCopyText,
    handleForwardClick,
    startComposerEdit,
    handleDelete,
    handleSelect,
    handleSaveAs,
    handleShareAttachment,
    handleOpenWith,
    handleReport,
  ]);

  if (isDeletedForMe) return null;

  if (toCallSessionStatusMessageType(message.message_type || "") === "ended") {
    return (
      <div className="mb-2 flex justify-center animate-[chatMsgIn_200ms_ease-out]">
        <div className="flex items-center gap-2 rounded-[7px] border border-[#e9edef] bg-white px-3.5 py-1.5 text-xs font-medium text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.08)] dark:border-border dark:bg-surface dark:text-content-secondary">
          <span>{message.content || "Call ended"}</span>
        </div>
      </div>
    );
  }

  if (message.message_type === "group_member_joined" || message.message_type === "group_member_left") {
    return (
      <div className="mb-2 flex justify-center animate-[chatMsgIn_200ms_ease-out]">
        <div className="flex items-center gap-2 rounded-[7px] border border-[#e9edef] bg-white px-3.5 py-1.5 text-xs font-medium text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.08)] dark:border-border dark:bg-surface dark:text-content-secondary">
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
  const bubbleBg = isOwnMessage ? "chat-bubble-own" : "chat-bubble-in";
  const bubbleShape = isOwnMessage
    ? showTail
      ? "rounded-tl-[8px] rounded-tr-[4px] rounded-br-[8px] rounded-bl-[8px] after:pointer-events-none after:absolute after:-right-[6px] after:top-0 after:border-y-[6px] after:border-y-transparent after:border-l-[7px] after:border-l-[var(--chat-bubble-own)]"
      : "rounded-[8px]"
    : showTail
      ? "rounded-tr-[8px] rounded-tl-[4px] rounded-br-[8px] rounded-bl-[8px] ring-1 ring-black/[0.04] before:pointer-events-none before:absolute before:-left-[6px] before:top-0 before:border-y-[6px] before:border-y-transparent before:border-r-[7px] before:border-r-[var(--chat-bubble-in)]"
      : "rounded-[8px] ring-1 ring-black/[0.04]";
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

  const replyQuote = formatReplyQuote(repliedToMessage);
  const mediaOnly =
    !isDeleted &&
    !callPresentation &&
    !locationPayload &&
    !emojiOnly &&
    Boolean(message.attachments && message.attachments.length > 0) &&
    !displayContent.trim() &&
    !sharedPostId &&
    !linkPreviewUrl;
  /** Images/videos can overlay the timestamp; file cards have Open/Save and need it below. */
  const visualMediaOnly =
    mediaOnly &&
    (message.attachments ?? []).every(
      (att) => att.type === "image" || att.type === "video"
    );

  return (
    <div
      id={`chat-message-${message.id}`}
      className={`relative flex items-end gap-1.5 animate-[chatMsgIn_220ms_ease-out] sm:gap-2 ${
        hasReactions ? "mb-8" : isClusterEnd ? "mb-2" : "mb-[2px]"
      } ${isOwnMessage ? "flex-row-reverse justify-end" : "justify-start"} ${highlighted ? "chat-message-jump-highlight rounded-xl" : ""} ${
        selectionMode ? "cursor-pointer pl-8" : ""
      }`}
      onClick={
        selectionMode
          ? () => onToggleSelect?.(message)
          : undefined
      }
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
      {selectionMode ? (
        <span
          className={`absolute left-0 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border ${
            isMessageSelected
              ? "border-[#00a884] bg-[#00a884] text-white"
              : "border-[#8696a0] bg-white dark:bg-surface"
          }`}
          aria-hidden
        >
          {isMessageSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
      ) : null}
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
            className={`relative inline-block max-w-full overflow-visible transition-shadow ${
              emojiOnly
                ? "bg-transparent shadow-none px-1"
                : `shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${bubbleBg} ${bubbleShape} ${
                    visualMediaOnly
                      ? "w-fit p-[3px] pb-1"
                      : mediaOnly
                        ? "w-fit p-1 pb-0.5"
                        : hasAttachments
                          ? "w-fit px-2.5 pb-1.5 pt-1.5"
                          : "px-2.5 pb-1.5 pt-1.5"
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

            {!isDeleted && !selectionMode && (onReact || onReply) && (isHovered || showMenu || showQuickReactions || showReactionPicker) ? (
              <div
                className={`absolute z-30 hidden items-center gap-0.5 sm:flex ${
                  isOwnMessage ? "right-full mr-1.5" : "left-full ml-1.5"
                } top-1/2 -translate-y-1/2`}
              >
                {onReact ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQuickReactions((s) => !s);
                      setShowMenu(false);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#54656f] shadow-[0_1px_1px_rgba(11,20,26,0.2)] ring-1 ring-black/5 transition hover:bg-[#f0f2f5] dark:bg-surface dark:text-content-secondary dark:hover:bg-surface-hover"
                    aria-label="Add reaction"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                ) : null}
                {onReply ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReply();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#54656f] shadow-[0_1px_1px_rgba(11,20,26,0.2)] ring-1 ring-black/5 transition hover:bg-[#f0f2f5] dark:bg-surface dark:text-content-secondary dark:hover:bg-surface-hover"
                    aria-label="Reply"
                  >
                    <Reply className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
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
                    showQuickReactions && !showMenu
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
                className={`absolute z-[9999] flex max-w-[calc(100vw-1rem)] flex-col items-stretch gap-1.5 ${
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
                {onReact ? (
                  <div
                    className="flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-full bg-white px-1.5 py-1 shadow-[0_6px_18px_rgba(11,20,26,0.18)] ring-1 ring-black/[0.06] dark:bg-surface"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {WA_QUICK_REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={`menu-${emoji}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReact(message.id, emoji);
                          setShowMenu(false);
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
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-content-secondary hover:bg-surface-hover"
                      aria-label="More reactions"
                    >
                      <TbMoodPlus className="h-5 w-5" />
                    </button>
                  </div>
                ) : null}

                {(showOverflowMenu || onReact) && messageOverflowMenuSections.length > 0 ? (
                  <div
                    role="menu"
                    className="w-[180px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl bg-white py-1 shadow-[0_2px_5px_rgba(11,20,26,0.26)] ring-1 ring-black/[0.08] dark:bg-surface"
                  >
                    {messageOverflowMenuSections.map((section, sectionIdx) => (
                      <Fragment key={section.id}>
                        {sectionIdx > 0 ? <div role="separator" className="my-1 h-px bg-[#e9edef] dark:bg-border-subtle" /> : null}
                        {section.items.map((item) => {
                          const { id, label, Icon, tone = "default", trailing, disabled, onClick } = item;
                          const baseRow =
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14.5px] leading-snug transition-colors";
                          const rowClass = disabled
                            ? `${baseRow} cursor-not-allowed text-content-tertiary opacity-60`
                            : tone === "danger"
                              ? `${baseRow} text-red-600 hover:bg-red-50`
                              : `${baseRow} text-[#111b21] hover:bg-[#f0f2f5] dark:text-content dark:hover:bg-surface-hover`;
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
                                className={`h-5 w-5 shrink-0 ${disabled ? "text-content-tertiary" : tone === "danger" ? "text-red-600" : "text-[#54656f] dark:text-content-secondary"
                                  }`}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate">{label}</span>
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onScrollToMessage?.(message.reply_to_id!);
                }}
                className={`mb-1.5 max-w-full overflow-hidden rounded-lg border-l-[3px] px-2 py-1.5 text-left transition hover:opacity-90 ${
                  isOwnMessage
                    ? "border-[#25d366] bg-black/[0.06] dark:bg-white/10"
                    : "border-primary-500 bg-surface-secondary/70"
                }`}
                aria-label={`Jump to message from ${replyQuote.senderName}`}
              >
                <div className="truncate text-[11px] font-semibold text-primary-700 dark:text-primary-300">
                  {replyQuote.senderName}
                </div>
                <div className="truncate text-[12px] italic text-content-tertiary">
                  {replyQuote.preview}
                </div>
              </button>
            ) : null}

            {isDeleted ? (
              <p className="pr-1 text-sm italic text-content-tertiary">This message was deleted</p>
            ) : callPresentation ? (
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-[0_0.5px_1.5px_rgba(11,20,26,0.12)]">
                  {callPresentation.variant === "missed" ? (
                    <PhoneMissed className="h-[22px] w-[22px] text-[#ea0038]" strokeWidth={2} aria-hidden />
                  ) : callPresentation.variant === "video" ? (
                    <Video className="h-[21px] w-[21px] text-content" strokeWidth={2} aria-hidden />
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
                {isViewOnce && !isUploading ? (
                    <ViewOncePlaceholder
                      kind={viewOnceKind}
                      opened={viewOnceOpened}
                      isOwnMessage={isOwnMessage}
                      loading={viewOnceOpening}
                      onOpen={handleOpenViewOnce}
                    />
                  ) : message.attachments && message.attachments.length > 0 ? (
                  <MessageAttachments
                    attachments={message.attachments}
                    isOwnMessage={isOwnMessage}
                    onOpenMedia={(items, index) => setMediaViewer({ items, index })}
                    isUploading={isUploading}
                    uploadProgressById={uploadProgressById}
                    onCancelUpload={onCancelUpload}
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
              <div
                className={
                  visualMediaOnly
                    ? "pointer-events-none absolute bottom-1.5 right-1.5 z-10 flex items-end justify-end gap-1 rounded-[6px] bg-black/45 px-1.5 py-0.5"
                    : mediaOnly
                      ? "mt-0.5 flex items-end justify-end gap-1 px-0.5"
                      : "mt-0.5 flex items-end justify-end gap-1 pl-6"
                }
              >
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-0">
                  {showEditedBadge ? (
                    <span
                      className={`text-[11px] lowercase leading-none ${
                        visualMediaOnly ? "text-white/90" : "text-content-tertiary"
                      }`}
                    >
                      edited
                    </span>
                  ) : null}
                  <span
                    className={`shrink-0 text-[11px] tabular-nums ${
                      visualMediaOnly ? "text-white/90" : "text-content-tertiary"
                    }`}
                  >
                    {format(new Date(message.created_at), "HH:mm")}
                  </span>
                </div>
                <MessageStatusIndicator
                  status={messageStatus}
                  isOwnMessage={isOwnMessage}
                  light={visualMediaOnly}
                />
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
        restrictActions={Boolean(mediaViewer?.viewOnce)}
        onClose={closeMediaViewer}
      />
    </div>
  );
};
