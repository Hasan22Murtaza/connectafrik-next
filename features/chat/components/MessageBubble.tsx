import MessageStatusIndicator from "@/features/chat/components/MessageStatusIndicator";
import type {
  ChatHeaderOptionsMenuItem,
  ChatHeaderOptionsMenuSection,
} from "@/features/chat/types/chatHeaderOptionsMenu";
import type { ChatAttachment, ChatMessage } from "@/features/chat/services/supabaseMessagingService";
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
  Bot,
  ChevronDown,
  ChevronsRight,
  Copy,
  Download,
  FileText,
  Forward,
  Info,
  Pencil,
  Pin,
  Reply,
  Smile,
  Square,
  Star,
  ThumbsDown,
  Trash2,
  UserCircle,
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

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+/gi;

/** WhatsApp-style quick reactions in the hover / context strip */
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
      <span className="rounded-lg bg-white/95 px-3 py-1 text-[11.5px] font-medium uppercase tracking-wide text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
        {label}
      </span>
    </div>
  );
}

function linkifyContent(text: string, isOwn: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX.source, "gi");

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`break-all underline ${isOwn ? "text-[#027eb5] hover:text-[#026aa1]" : "text-blue-600 hover:text-blue-800"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
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

interface MessageBubbleProps {
  message: ChatMessage;
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
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
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
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<"above" | "below">("below");
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionPickerCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleBlockRef = useRef<HTMLDivElement | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

  const router = useRouter(); 
  const MENU_VIEWPORT_GAP = 8;
  /** Conservative height for reactions + overflow menu so we pick above/below before paint. */
  const ESTIMATED_MENU_HEIGHT = 320;
  const MESSAGE_PREVIEW_LIMIT = 220;

  const computeMenuPlacement = useCallback((): "above" | "below" => {
    const el = bubbleBlockRef.current;
    if (!el) return "below";
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_VIEWPORT_GAP;
    const spaceAbove = rect.top - MENU_VIEWPORT_GAP;
    if (spaceBelow >= ESTIMATED_MENU_HEIGHT) return "below";
    if (spaceAbove >= ESTIMATED_MENU_HEIGHT) return "above";
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
    const fitsBelow = spaceBelow >= menuHeight;
    const fitsAbove = spaceAbove >= menuHeight;

    setMenuPlacement((prev) => {
      if (prev === "below" && !fitsBelow && (fitsAbove || spaceAbove >= spaceBelow)) return "above";
      if (prev === "above" && !fitsAbove && (fitsBelow || spaceBelow > spaceAbove)) return "below";
      return prev;
    });
  }, [showMenu, showReactionPicker]);

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
    const txt = (message.content || "").trim();
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
    setShowMenu(false);
  };

  React.useEffect(() => {
    if (!showMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      const el = bubbleBlockRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setShowMenu(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showMenu]);

  const isDeleted = message.is_deleted;
  const isDeletedForMe = message.deleted_for?.includes(currentUserId) ?? false;

  const canEditMessage = isOwnMessage && Boolean(onBeginEdit) && isEditableTextMessage(message);
  const canDeleteForEveryone = isOwnMessage && Boolean(onDelete);
  const canDeleteForMe = Boolean(onDelete);
  const canForward = Boolean(onForward) && isForwardableChatMessage(message);
  const canShowInfo = isOwnMessage && Boolean(onShowInfo) && !isDeleted;
  const canCopy = Boolean((message.content || "").trim());
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
        : [])
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
      <div className="mb-3 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
          <span>{message.content || "📞 Call ended"}</span>
        </div>
      </div>
    );
  }

  if (message.message_type === "group_member_joined" || message.message_type === "group_member_left") {
    return (
      <div className="mb-3 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  const systemMessageTypes = [
    "initiated",
    "ringing",
    "active",
    "declined",
    "ended",
    "missed",
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

  const bubbleBg = isOwnMessage
    ? showForwardBadge
      ? "bg-orange-50"
      : "bg-orange-50/80"
    : "bg-white";
  const toggleExpanded = (messageId: string) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };
  
  const isExpanded = expandedMessages[message.id];
  const shouldTruncate =
    message.content &&
    message.content.length > MESSAGE_PREVIEW_LIMIT;
  
  const displayText =
    shouldTruncate && !isExpanded
      ? `${message.content.slice(0, MESSAGE_PREVIEW_LIMIT)}...`
      : message.content;

  return (
    <div
      className={`relative mb-2 flex items-end gap-2 ${isOwnMessage ? "flex-row-reverse justify-end" : "justify-start"}`}
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
        className={`relative min-w-0 max-w-[min(78%,420px)] flex-1 ${isOwnMessage ? "ml-auto flex flex-col items-end" : "mr-auto flex flex-col items-start"}`}
      >
        {!isOwnMessage && message.sender ? (
          <div className="mb-0.5 flex max-w-full items-center gap-2 px-1">
            {message.sender.avatarUrl ? (
              <img src={message.sender.avatarUrl} alt={message.sender.name} className="h-5 w-5 rounded-full" />
            ) : (
              <UserCircle className="h-5 w-5 text-[#8696a0]" />
            )}
            <span className="truncate text-xs font-medium text-[#54656f] cursor-pointer hover:underline" onClick={() => router.push(`/user/${message?.sender?.id}`)}>{message.sender?.name}</span>
          </div>
        ) : null}

        {message.reply_to_id ? (
          <div
            className={`mb-1 max-w-full rounded-md border-l-[3px] p-2 ${
              isOwnMessage ? "border-[#25d366] bg-[#c8edc1]/90" : "border-[#00a884] bg-white/80"
            }`}
          >
            <div className="text-[11px] italic text-[#667781]">Replying to a message</div>
          </div>
        ) : null}

        <div className="relative" ref={bubbleBlockRef}>
          {isHovered && !isDeleted && onReact && !selectionMode ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMessageMenu();
              }}
              className={`absolute top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#54656f] shadow-[0_1px_1px_rgba(11,20,26,0.2)] ring-1 ring-black/5 transition hover:bg-[#f5f6f6] ${
                isOwnMessage ? "-left-9" : "-right-9"
              }`}
              aria-label="Add reaction"
            >
              <Smile className="h-4 w-4" />
            </button>
          ) : null}

          {showMenu ? (
            <div
              ref={messageMenuRef}
              className={`absolute z-[10001] flex flex-col items-stretch gap-1 ${isOwnMessage ? "right-0 items-end" : "left-0 items-start"} ${
                menuPlacement === "below" ? "top-full mt-1" : "bottom-full mb-1"
              }`}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={handleReactionPickerEnter}
              onMouseLeave={handleReactionPickerLeave}
            >
              {onReact ? (
                <div className="flex items-center gap-0.5 rounded-full bg-white px-1.5 py-1 shadow-[0_2px_5px_rgba(11,20,26,0.16)] ring-1 ring-black/[0.06]">
                  {WA_QUICK_REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReact(message.id, emoji);
                        setShowMenu(false);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[22px] transition hover:bg-[#f5f6f6]"
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
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#54656f] hover:bg-[#f5f6f6]"
                    aria-label="More reactions"
                  >
                    <TbMoodPlus className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
              {showReactionPicker && onReact ? (
                <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1.5 shadow-[0_2px_5px_rgba(11,20,26,0.16)] ring-1 ring-black/[0.06]">
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
                      className="rounded-full p-0.5 transition hover:scale-110"
                    >
                      <ReactionIcon type={kind} size={22} />
                    </button>
                  ))}
                </div>
              ) : null}

              {(showOverflowMenu || onReact) && messageOverflowMenuSections.length > 0 ? (
                <div
                  role="menu"
                  className="min-w-[200px] max-w-[280px] overflow-hidden rounded-lg bg-white py-1 shadow-[0_2px_5px_rgba(11,20,26,0.26)] ring-1 ring-black/[0.08]"
                >
                  {messageOverflowMenuSections.map((section, sectionIdx) => (
                    <Fragment key={section.id}>
                      {sectionIdx > 0 ? <div role="separator" className="my-1 h-px bg-[#e9edef]" /> : null}
                      {section.items.map((item) => {
                        const { id, label, Icon, tone = "default", trailing, disabled, onClick } = item;
                        const baseRow =
                          "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] leading-snug transition-colors";
                        const rowClass = disabled
                          ? `${baseRow} cursor-not-allowed text-[#8696a0] opacity-60`
                          : tone === "danger"
                            ? `${baseRow} text-red-600 hover:bg-red-50`
                            : `${baseRow} text-[#111b21] hover:bg-[#f5f6f6]`;
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
                              className={`h-[18px] w-[18px] shrink-0 ${
                                disabled ? "text-[#8696a0]" : tone === "danger" ? "text-red-600" : "text-[#54656f]"
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


            <div
              className={`relative z-[1] rounded-lg px-2.5 pb-1 pt-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${bubbleBg} ${
                isOwnMessage ? "rounded-tr-sm" : "rounded-tl-sm"
              } ${
                isComposerEditingThis
                  ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-[#e5ddd5]"
                  : ""
              }`}
            >
              {isHovered && !isDeleted && (showOverflowMenu || onReact) && !selectionMode ? (
                <div className="absolute right-1 top-1 z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMessageMenu();
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[#54656f] shadow-[0_1px_1px_rgba(11,20,26,0.2)] ring-1 ring-black/5 transition hover:bg-[#f5f6f6]"
                    aria-label="Open message actions"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {showForwardBadge && !isDeleted ? (
                <div className="mb-1 flex items-center gap-1 pr-1">
                  <ChevronsRight
                    className="h-3.5 w-3.5 shrink-0 text-[#5b6c66]"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="text-[12px] italic leading-snug text-[#5b6c66]">Forwarded</span>
                </div>
              ) : null}

              {isDeleted ? (
                <p className="pr-1 text-sm italic text-[#667781]">This message was deleted</p>
              ) : (
                <>
                  {message.attachments && message.attachments.length > 0 ? (
                    <div className="mb-1 space-y-2">
                      {message.attachments.map((att: ChatAttachment) => {
                        if (att.type === "image") {
                          return (
                            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                              <img
                                src={att.url}
                                alt={att.name}
                                className="max-h-48 max-w-full cursor-pointer rounded-md object-cover transition-opacity hover:opacity-90"
                                loading="lazy"
                              />
                            </a>
                          );
                        }

                        if (att.type === "video") {
                          return (
                            <video
                              key={att.id}
                              src={att.url}
                              controls
                              preload="metadata"
                              className="max-h-48 max-w-full rounded-md"
                            />
                          );
                        }

                        if (att.mimeType?.startsWith("audio/")) {
                          return (
                            <audio
                              key={att.id}
                              src={att.url}
                              controls
                              preload="metadata"
                              className="w-full max-w-[min(100%,280px)]"
                            />
                          );
                        }

                        return (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 rounded-md p-2 transition-colors ${
                              isOwnMessage ? "bg-[#c5e8bc] hover:bg-[#b8e0ad]" : "bg-[#f0f2f5] hover:bg-[#e5e8eb]"
                            }`}
                          >
                            <FileText className="h-5 w-5 shrink-0 text-[#54656f]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-[#111b21]">{att.name}</p>
                              <p className="text-[10px] text-[#667781]">
                                {att.size < 1024
                                  ? `${att.size} B`
                                  : att.size < 1048576
                                    ? `${(att.size / 1024).toFixed(1)} KB`
                                    : `${(att.size / 1048576).toFixed(1)} MB`}
                              </p>
                            </div>
                            <Download className="h-4 w-4 shrink-0 text-[#54656f]" />
                          </a>
                        );
                      })}
                    </div>
                  ) : null}

                {message.content ? (
                  <div className="pr-1">
                    <p className="break-words text-[14.2px] leading-[1.45] text-[#111b21] whitespace-pre-wrap">
                      {linkifyContent(displayText || "", isOwnMessage)}
                    </p>

                    {shouldTruncate ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(message.id)}
                        className="mt-1 text-[12px] font-medium text-orange-500 hover:underline"
                      >
                        {isExpanded ? "Read less" : "Read more"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                </>
              )}

              <div className="mt-0.5 flex items-end justify-end gap-1 pl-6">
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-0">
                  {showEditedBadge ? (
                    <span className="text-[11px] lowercase leading-none text-[#667781]">edited</span>
                  ) : null}
                  <span className="shrink-0 text-[11px] tabular-nums text-[#667781]">
                    {format(new Date(message.created_at), "HH:mm")}
                  </span>
                </div>
                <MessageStatusIndicator status={messageStatus} isOwnMessage={isOwnMessage} />
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};
