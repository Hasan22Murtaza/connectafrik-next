import MessageStatusIndicator from "@/features/chat/components/MessageStatusIndicator";
import type { ChatMessage, ChatAttachment } from "@/features/chat/services/supabaseMessagingService";
import { toCallSessionStatusMessageType } from "@/features/chat/services/callSessionRealtime";
import { format, formatDistanceToNow } from "date-fns";
import { Download, FileText, MoreVertical, UserCircle } from "lucide-react";
import React, { useState, useRef, useCallback } from "react";
import { BsReply } from "react-icons/bs";
import { RiShareForwardLine } from "react-icons/ri";
import ReactionIcon, {
  PICKER_REACTIONS,
  KIND_TO_EMOJI,
  type ReactionKind,
} from "@/shared/components/ReactionIcon";
import { TbMoodPlus } from "react-icons/tb";


const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<]+/gi;

function linkifyContent(text: string, isOwn: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX.source, 'gi');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    const href = url.startsWith('http') ? url : `https://${url}`;
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline break-all ${isOwn ? 'text-white hover:text-orange-100' : 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'}`}
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
  threadParticipants?: string[]; // Array of participant user IDs in this thread
  participantPresence?: Record<string, 'online' | 'offline'>;
  onReply?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
  onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
  /** Opens WhatsApp-style composer edit mode (sender-only from parent). */
  onBeginEdit?: (message: ChatMessage) => void;
  /** Message id whose text is currently open in the composer (subtle bubble highlight). */
  composerEditingMessageId?: string | null;
  onReact?: (messageId: string, emoji: string) => void;
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
    setShowReactionPicker(true);
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
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isRightSwipe && onReply) {
      onReply(message);
    }
  };

  const handleDelete = (deleteForEveryone: boolean) => {
    if (onDelete) {
      onDelete(message.id, deleteForEveryone);
    }
    setShowMenu(false);
  };

  const startComposerEdit = () => {
    if (!isOwnMessage || !onBeginEdit || !isEditableTextMessage(message)) return;
    onBeginEdit(message);
    setShowMenu(false);
  };

  const handleReply = () => {
    if (onReply) {
      onReply(message);
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

  const canEditMessage =
    isOwnMessage && Boolean(onBeginEdit) && isEditableTextMessage(message);
  const canDeleteForEveryone = isOwnMessage && Boolean(onDelete);
  const canDeleteForMe = Boolean(onDelete);
  const canForward =
    Boolean(onForward) && isForwardableChatMessage(message);
  const showOverflowMenu =
    canEditMessage || canDeleteForMe || canForward;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!showOverflowMenu) return;
    setShowMenu(true);
  };

  const handleForwardClick = () => {
    if (onForward && isForwardableChatMessage(message)) {
      onForward(message);
    }
    setShowMenu(false);
  };

  if (isDeletedForMe) return null;

  // Show "Call ended" as a centered system message in the chat
  if (toCallSessionStatusMessageType(message.message_type || "") === "ended") {
    return (
      <div className="flex justify-center mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
          <span>{message.content || "📞 Call ended"}</span>
        </div>
      </div>
    );
  }

  if (
    message.message_type === "group_member_joined" ||
    message.message_type === "group_member_left"
  ) {
    return (
      <div className="flex justify-center mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
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

  if (systemMessageTypes.includes(message.message_type ?? "")) {
    return null;
  }

  const getMessageStatus = (): "sending" | "sent" | "delivered" | "read" => {
    if (!isOwnMessage) return "sent";

    const otherParticipants = threadParticipants.filter(
      (id) => id !== currentUserId
    );

    if (otherParticipants.length === 0) {
      return "sent";
    }

    if (message.read_by && Array.isArray(message.read_by)) {
      const otherParticipantsWhoRead = otherParticipants.filter((id) =>
        message.read_by!.includes(id)
      );

      if (otherParticipantsWhoRead.length > 0) {
        return "read";
      }
    }

    // Check if any recipient is online - if all are offline, show "sent"
    // If at least one is online, show "delivered" (message delivered but not read)
    const hasOnlineRecipient = otherParticipants.some((id) => {
      const status = participantPresence[id];
      return status === 'online';
    });

    if (hasOnlineRecipient) {
      return "delivered";
    }

    // All recipients are offline - message is sent but not delivered
    return "sent";
  };

  const messageStatus = getMessageStatus();

  const showEditedBadge = Boolean(message.is_edited);
  const showForwardBadge = Boolean(message.is_forward);

  const isComposerEditingThis =
    Boolean(composerEditingMessageId) &&
    composerEditingMessageId === message.id &&
    !isDeleted;

  return (
    <div
      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"
        } mb-3 relative`}
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

      {/* Message Bubble */}
      <div
        className={`max-w-[70%] ${isOwnMessage ? "ml-auto" : "mr-auto"
          } relative`}
      >
        {/* Sender Info (for group chats or other users' messages) */}
        {!isOwnMessage && message.sender && (
          <div className="flex items-center gap-2 mb-1 px-1">
            {message.sender.avatarUrl ? (
              <img
                src={message.sender.avatarUrl}
                alt={message.sender.name}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <UserCircle className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              {message.sender.name}
            </span>
          </div>
        )}

        {/* Reply Preview (if this is a reply) */}
        {message.reply_to_id && (
          <div
            className={`mb-2 p-2 rounded-lg border-l-4 ${isOwnMessage
                ? "bg-orange-100 dark:bg-orange-900/20 border-orange-500"
                : "bg-gray-100 dark:bg-gray-800 border-gray-400"
              }`}
          >
            <div className="text-xs text-gray-600 dark:text-gray-400 italic">
              💬 Replying to a message
            </div>
          </div>
        )}

        {/* Message Content */}
        <div
          className={`rounded-2xl px-3 py-1  relative transition-shadow ${isOwnMessage
              ? "bg-orange-500 text-white rounded-br-none "
              : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none"
            } ${
              isComposerEditingThis
                ? "ring-2 ring-amber-300 dark:ring-amber-500/70 ring-offset-2 ring-offset-white dark:ring-offset-gray-950 shadow-md"
                : ""
            }`}
        >
          {isDeleted ? (
            <p className="text-sm italic opacity-60">
              🚫 This message was deleted
            </p>
          ) : (
            <>
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-1 space-y-2">
                  {message.attachments.map((att: ChatAttachment) => {
                    if (att.type === "image") {
                      return (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={att.url}
                            alt={att.name}
                            className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
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
                          className="max-w-full rounded-lg max-h-48"
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

                    // Generic file attachment
                    return (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 rounded-lg p-2 transition-colors ${isOwnMessage
                            ? "bg-orange-600/30 hover:bg-orange-600/50"
                            : "bg-gray-300/50 hover:bg-gray-300/70 dark:bg-gray-600/50 dark:hover:bg-gray-600/70"
                          }`}
                      >
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {att.name}
                          </p>
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
                    <p className="text-sm break-words">
                      {linkifyContent(message.content, isOwnMessage)}
                    </p>
                  ) : null}
            </>
          )}

          {/* Timestamp and Status */}
          <div
            className={`flex items-center justify-between mt-1 gap-2 ${isOwnMessage
                  ? "text-orange-100"
                  : "text-gray-500 dark:text-gray-400"
                }`}
          >
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
              <span className="text-[11px] shrink-0 tabular-nums">
                {format(new Date(message.created_at), "HH:mm")}
              </span>
              {showForwardBadge && (
                <span className="text-[11px] leading-none opacity-70 lowercase">
                  forwarded
                </span>
              )}
              {showEditedBadge && (
                <span className="text-[11px] leading-none opacity-70 lowercase">
                  edited
                </span>
              )}
            </div>
            <MessageStatusIndicator
              status={messageStatus}
              isOwnMessage={isOwnMessage}
            />
          </div>

          {isHovered && !isDeleted && (
            <div
              className={`
      absolute top-1/2 -translate-y-1/2  flex items-center
      transition-all duration-200 
      ${isOwnMessage ? "-left-24" : "-right-16"}
    `}

            >
              {showOverflowMenu && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu((prev) => !prev);
                    }}
                    className="text-gray-800 hover:text-orange-500 transition p-1.5 hover:bg-gray-100 rounded-full"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* Reply */}
              {onReply && (
                <button
                  type="button"
                  onClick={handleReply}
                  className="text-gray-800 hover:text-orange-500 transition p-1.5 hover:bg-gray-100 rounded-full"
                  title="Reply"
                >
                  <BsReply className="w-4 h-4" />
                </button>
              )}
              {canForward ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onForward) onForward(message);
                  }}
                  className="text-gray-800 hover:text-orange-500 transition p-1.5 hover:bg-gray-100 rounded-full"
                  title="Forward"
                >
                  <RiShareForwardLine className="w-4 h-4" />
                </button>
              ) : null}

              {/* Emoji / Reaction */}
              {onReact && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReactionPicker((prev) => !prev);
                    }}
                    className="text-gray-800 hover:text-orange-500 transition p-1.5 hover:bg-gray-100 rounded-full"
                  >
                    <TbMoodPlus />
                  </button>

                  {/* Emoji Picker */}
                  {showReactionPicker && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                      <div className="flex gap-1 bg-white  p-1.5 rounded-full shadow-lg ">
                        {PICKER_REACTIONS.map((kind: ReactionKind) => (
                          <button
                            key={kind}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowReactionPicker(false);
                              onReact(message.id, KIND_TO_EMOJI[kind]);
                            }}
                            className="hover:scale-110 transition noto-color-emoji-regular"
                          >
                            <ReactionIcon type={kind} size={22} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}


            </div>
          )}
          {showMenu && showOverflowMenu && (
            <div
              className={`absolute top-full z-[9999] mt-1 w-40 rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-sm p-1 ${
                isOwnMessage ? "right-0" : "left-0"
              }`}
            >
              {canEditMessage ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startComposerEdit();
                  }}
                  className="w-full p-1 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl"
                >
                  Edit
                </button>
              ) : null}
              {canForward ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleForwardClick();
                  }}
                  className="w-full p-1 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl"
                >
                  Forward
                </button>
              ) : null}
              {canDeleteForMe ? (
                <button
                  type="button"
                  onClick={() => handleDelete(false)}
                  className="w-full p-1 text-left text-sm text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl"
                >
                  Delete for Me
                </button>
              ) : null}
              {canDeleteForEveryone ? (
                <button
                  type="button"
                  onClick={() => handleDelete(true)}
                  className="w-full p-1 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl"
                >
                  Delete for Everyone
                </button>
              ) : null}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
