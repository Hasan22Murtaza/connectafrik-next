import MessageStatusIndicator from "@/features/chat/components/MessageStatusIndicator";
import type { ChatMessage, ChatAttachment } from "@/features/chat/services/supabaseMessagingService";
import { formatDistanceToNow } from "date-fns";
import { Download, FileText, MoreVertical, UserCircle } from "lucide-react";
import React, { useState, useMemo } from "react";
import { BsReply } from "react-icons/bs";
import { RiShareForwardLine } from "react-icons/ri";

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

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  currentUserId: string;
  threadParticipants?: string[]; // Array of participant user IDs in this thread
  participantPresence?: Record<string, 'online' | 'away' | 'busy' | 'offline'>; // Presence status of participants
  onReply?: (message: ChatMessage) => void;
  onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
  canDeleteForEveryone?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  currentUserId,
  threadParticipants = [],
  participantPresence = {},
  onReply,
  onDelete,
  canDeleteForEveryone = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleDelete = (deleteForEveryone: boolean) => {
    if (onDelete) {
      onDelete(message.id, deleteForEveryone);
    }
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

  if (isDeletedForMe) return null;

  // Show "Call ended" as a centered system message in the chat
  if (message.message_type === "call_ended") {
    return (
      <div className="flex justify-center mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
          <span>{message.content || "📞 Call ended"}</span>
        </div>
      </div>
    );
  }

  const systemMessageTypes = [
    "call_ended",
    "call_accepted",
    "call_request",
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
      return status === 'online' || status === 'away' || status === 'busy';
    });

    if (hasOnlineRecipient) {
      return "delivered";
    }

    // All recipients are offline - message is sent but not delivered
    return "sent";
  };

  const messageStatus = getMessageStatus();

  return (
    <div
      className={`flex ${
        isOwnMessage ? "justify-end" : "justify-start"
      } mb-3 relative`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >

      {/* Message Bubble */}
      <div
        className={`max-w-[70%] ${
          isOwnMessage ? "ml-auto" : "mr-auto"
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
            className={`mb-2 p-2 rounded-lg border-l-4 ${
              isOwnMessage
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
          className={`rounded-2xl px-4 py-2  relative ${
            isOwnMessage
              ? "bg-orange-500 text-white rounded-br-none"
              : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none"
          }`}
        >
          {isDeleted ? (
            <p className="text-sm italic opacity-60">
              🚫 This message was deleted
            </p>
          ) : (
            <>
              {/* Attachments */}
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

                    // Generic file attachment
                    return (
                      <a
                        key={att.id}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 rounded-lg p-2 transition-colors ${
                          isOwnMessage
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

              {/* Text content */}
              {message.content && (
                <p className="text-sm break-words">{linkifyContent(message.content, isOwnMessage)}</p>
              )}
            </>
          )}

          {/* Timestamp and Status */}
          <div
            className={`flex items-center justify-between mt-1 ${
              isOwnMessage
                ? "text-orange-100"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <span className="text-xs">
              {formatDistanceToNow(new Date(message.created_at), {
                addSuffix: true,
              })}
            </span>
            <MessageStatusIndicator
              status={messageStatus}
              isOwnMessage={isOwnMessage}
            />
          </div>

          {/* Reply Icon - show on hover */}
          {isHovered && onReply && !isDeleted && (
            <button
              onClick={handleReply}
              className={`absolute top-0 ${isOwnMessage ? "-left-6" : "-right-6"}  text-gray-500 hover:text-gray-700 transition`}
              aria-label="Reply"
              type="button"
            >
              {isOwnMessage ? 
              <BsReply className="w-5 h-5" />
              : <RiShareForwardLine className="w-5 h-5" />

              }
            </button>
          )}

          {/* Three Dots Icon - show on hover */}
          {isHovered && isOwnMessage && onDelete && !isDeleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((prev) => !prev);
              }}
              className="absolute top-1 right-2 p-1 "
              aria-label="More options"
              type="button"
            >
              <MoreVertical className="w-4 h-4 text-gray-200" />
            </button>
          )}

          {/* Delete menu - show when menu open */}
          {showMenu && (
            <div
              className="absolute top-full right-0 z-50 mt-1 w-38 rounded-md border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg text-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  handleDelete(false);
                  setShowMenu(false);
                }}
                className="w-full px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700  text-[12px]"
                type="button"
              >
                Delete for Me
              </button>
              {canDeleteForEveryone && (
                <button
                  onClick={() => {
                    handleDelete(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700  text-[12px] text-red-600 "
                  type="button"
                >
                  Delete for Everyone
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
