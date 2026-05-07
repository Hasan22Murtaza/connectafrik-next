import MessageStatusIndicator from "@/features/chat/components/MessageStatusIndicator";
import type { ChatAttachment, ChatMessage } from "@/features/chat/services/supabaseMessagingService";
import { toCallSessionStatusMessageType } from "@/features/chat/services/callSessionRealtime";
import { format } from "date-fns";
import { ChevronDown, Download, FileText, UserCircle } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import ReactionIcon, {
  KIND_TO_EMOJI,
  PICKER_REACTIONS,
  type ReactionKind,
} from "@/shared/components/ReactionIcon";
import { TbMoodPlus } from "react-icons/tb";

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+/gi;

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
        className={`break-all underline ${isOwn ? "text-[#005c4b] hover:text-[#014f40]" : "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"}`}
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
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionPickerCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (isRightSwipe && onReply) onReply(message);
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
    } catch {
      // Clipboard may be blocked by browser permissions.
    }
    setShowMenu(false);
  };

  React.useEffect(() => {
    const handleClickOutside = () => setShowMenu(false);
    if (showMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showMenu]);

  const isDeleted = message.is_deleted;
  const isDeletedForMe = message.deleted_for?.includes(currentUserId) ?? false;

  const canEditMessage = isOwnMessage && Boolean(onBeginEdit) && isEditableTextMessage(message);
  const canDeleteForEveryone = isOwnMessage && Boolean(onDelete);
  const canDeleteForMe = Boolean(onDelete);
  const canForward = Boolean(onForward) && isForwardableChatMessage(message);
  const canShowInfo = isOwnMessage && Boolean(onShowInfo) && !isDeleted;
  const canCopy = Boolean((message.content || "").trim());
  const showOverflowMenu = canEditMessage || canDeleteForMe || canForward || canShowInfo || canCopy || Boolean(onReply);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!showOverflowMenu) return;
    setShowMenu(true);
  };

  const handleForwardClick = () => {
    if (onForward && isForwardableChatMessage(message)) onForward(message);
    setShowMenu(false);
  };

  if (isDeletedForMe) return null;

  if (toCallSessionStatusMessageType(message.message_type || "") === "ended") {
    return (
      <div className="mb-3 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <span>{message.content || "📞 Call ended"}</span>
        </div>
      </div>
    );
  }

  if (message.message_type === "group_member_joined" || message.message_type === "group_member_left") {
    return (
      <div className="mb-3 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
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

  return (
    <div
      className={`relative mb-3 flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
        setShowReactionPicker(false);
      }}
    >
      <div className={`relative max-w-[78%] ${isOwnMessage ? "ml-auto" : "mr-auto"}`}>
        {!isOwnMessage && message.sender && (
          <div className="mb-1 flex items-center gap-2 px-1">
            {message.sender.avatarUrl ? (
              <img src={message.sender.avatarUrl} alt={message.sender.name} className="h-5 w-5 rounded-full" />
            ) : (
              <UserCircle className="h-5 w-5 text-gray-400" />
            )}
            <span className="text-xs font-medium text-[#54656f]">{message.sender.name}</span>
          </div>
        )}

        {message.reply_to_id && (
          <div
            className={`mb-1.5 rounded-md border-l-4 p-2 ${
              isOwnMessage ? "border-[#25d366] bg-[#c8edc1]" : "border-[#d1d7db] bg-[#f5f6f6]"
            }`}
          >
            <div className="text-xs italic text-[#667781]">Replying to a message</div>
          </div>
        )}

        <div
          className={`relative rounded-2xl px-3 py-1.5 transition-shadow ${
            isOwnMessage
              ? "rounded-br-md bg-[#d9fdd3] text-[#111b21]"
              : "rounded-bl-md bg-white text-[#111b21] shadow-[0_1px_0_rgba(17,27,33,0.08)]"
          } ${
            isComposerEditingThis
              ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-white shadow-md dark:ring-amber-500/70 dark:ring-offset-gray-950"
              : ""
          }`}
        >
          {isDeleted ? (
            <p className="text-sm italic opacity-60">This message was deleted</p>
          ) : (
            <>
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-1 space-y-2">
                  {message.attachments.map((att: ChatAttachment) => {
                    if (att.type === "image") {
                      return (
                        <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={att.url}
                            alt={att.name}
                            className="max-h-48 max-w-full cursor-pointer rounded-lg object-cover transition-opacity hover:opacity-90"
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
                          className="max-h-48 max-w-full rounded-lg"
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
                        className={`flex items-center gap-2 rounded-lg p-2 transition-colors ${
                          isOwnMessage ? "bg-[#c8edc1] hover:bg-[#bfe7b7]" : "bg-gray-300/50 hover:bg-gray-300/70"
                        }`}
                      >
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{att.name}</p>
                          <p className="text-[10px] opacity-70">
                            {att.size < 1024
                              ? `${att.size} B`
                              : att.size < 1048576
                                ? `${(att.size / 1024).toFixed(1)} KB`
                                : `${(att.size / 1048576).toFixed(1)} MB`}
                          </p>
                        </div>
                        <Download className="h-4 w-4 flex-shrink-0 opacity-70" />
                      </a>
                    );
                  })}
                </div>
              )}

              {message.content ? (
                <p className="break-words text-sm">{linkifyContent(message.content, isOwnMessage)}</p>
              ) : null}
            </>
          )}

          <div className="mt-1 flex items-center justify-end gap-1.5 text-[#667781]">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
              <span className="shrink-0 text-[11px] tabular-nums">
                {format(new Date(message.created_at), "HH:mm")}
              </span>
              {showForwardBadge ? (
                <span className="text-[11px] lowercase leading-none opacity-70">forwarded</span>
              ) : null}
              {showEditedBadge ? (
                <span className="text-[11px] lowercase leading-none opacity-70">edited</span>
              ) : null}
            </div>
            <MessageStatusIndicator status={messageStatus} isOwnMessage={isOwnMessage} />
          </div>

          {isHovered && !isDeleted && showOverflowMenu ? (
            <div className={`absolute top-1.5 ${isOwnMessage ? "left-1.5" : "right-1.5"}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                className="rounded-full bg-[#ffffffd9] p-1 text-[#54656f] shadow-sm hover:bg-white"
                aria-label="Open message actions"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {showMenu && (
            <div
              className={`absolute -top-10 z-[9998] ${isOwnMessage ? "right-1" : "left-1"}`}
              onMouseEnter={handleReactionPickerEnter}
              onMouseLeave={handleReactionPickerLeave}
            >
              <div className="flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-lg ring-1 ring-black/5">
                {PICKER_REACTIONS.map((kind: ReactionKind) => (
                  <button
                    key={kind}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReact?.(message.id, KIND_TO_EMOJI[kind]);
                      setShowMenu(false);
                    }}
                    className="rounded-full p-0.5 transition hover:scale-110"
                  >
                    <ReactionIcon type={kind} size={18} />
                  </button>
                ))}
                {onReact ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReactionPicker((prev) => !prev);
                    }}
                    className="rounded-full p-0.5 text-[#54656f] hover:bg-gray-100"
                    aria-label="More reactions"
                  >
                    <TbMoodPlus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {showReactionPicker && onReact ? (
                <div className="absolute bottom-full left-1/2 z-[9999] mb-2 -translate-x-1/2">
                  <div className="flex gap-1 rounded-full bg-white p-1.5 shadow-lg ring-1 ring-black/5">
                    {PICKER_REACTIONS.map((kind: ReactionKind) => (
                      <button
                        key={`extra-${kind}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReactionPicker(false);
                          onReact(message.id, KIND_TO_EMOJI[kind]);
                          setShowMenu(false);
                        }}
                        className="transition hover:scale-110"
                      >
                        <ReactionIcon type={kind} size={20} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {showMenu && showOverflowMenu ? (
            <div
              className={`absolute top-full z-[9999] mt-1 min-w-[180px] rounded-md bg-white py-1 shadow-xl ring-1 ring-black/10 ${
                isOwnMessage ? "right-0" : "left-0"
              }`}
            >
              {onReply ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReply();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#111b21] hover:bg-gray-100"
                >
                  Reply
                </button>
              ) : null}
              {canCopy ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCopyText();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#111b21] hover:bg-gray-100"
                >
                  Copy
                </button>
              ) : null}
              {canForward ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleForwardClick();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#111b21] hover:bg-gray-100"
                >
                  Forward
                </button>
              ) : null}
              {canEditMessage ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startComposerEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#111b21] hover:bg-gray-100"
                >
                  Edit
                </button>
              ) : null}
              {canShowInfo ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowInfo?.(message);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#111b21] hover:bg-gray-100"
                >
                  Message info
                </button>
              ) : null}
              {canDeleteForMe ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[#111b21] hover:bg-gray-100"
                >
                  Delete for Me
                </button>
              ) : null}
              {canDeleteForEveryone ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
                >
                  Delete for Everyone
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
