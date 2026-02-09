"use client";
// @ts-nocheck

import { useProductionChat } from "@/contexts/ProductionChatContext";
import {
  supabaseMessagingService,
  type ChatMessage,
} from "@/features/chat/services/supabaseMessagingService";
import { useMembers } from "@/shared/hooks/useMembers";
import {
  FileUploadResult,
  fileUploadService,
} from "@/shared/services/fileUploadService";
import type { PresenceStatus } from "@/shared/types/chat";
import {
  Minus,
  MoreVertical,
  Paperclip,
  Phone,
  Send,
  Video,
  X
} from "lucide-react";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { toast } from "react-hot-toast";
import FileAttachment from "./FileAttachment";
import FilePreview from "./FilePreview";
import { MessageBubble } from "./MessageBubble";

interface ChatWindowProps {
  threadId: string;
  onClose: (threadId: string) => void;
  onMinimize: (threadId: string) => void;
}

const formatPresenceLabel = (status?: string) => {
  switch (status) {
    case "online":
      return "Active now";
    case "away":
      return "Away";
    case "busy":
      return "Do not disturb";
    default:
      return "Offline";
  }
};

const ChatWindow: React.FC<ChatWindowProps> = ({
  threadId,
  onClose,
  onMinimize,
}) => {
  const {
    getThreadById,
    getMessagesForThread,
    sendMessage,
    currentUser,
    presence,
    callRequests,
    clearCallRequest,
    minimizedThreadIds,
    openThread,
    startCall,
    markThreadRead,
    clearMessagesForUser,
    setMessagesForThread,
  } = useProductionChat();

  const { members } = useMembers();

  const memberStatusMap = useMemo(() => {
    const map = new Map<string, PresenceStatus>();
    members.forEach((member) => {
      if (member.status) {
        map.set(member.id, member.status);
      } else if (member.last_seen) {
        map.set(member.id, "away");
      }
    });
    return map;
  }, [members]);

  const thread = getThreadById(threadId);
  const messages = getMessagesForThread(threadId);
  const visibleMessages = useMemo(() => {
    if (!currentUser) return messages;
    return messages.filter((message: ChatMessage) =>
      !message.deleted_for?.includes(currentUser.id)
    );
  }, [messages, currentUser?.id]);
  const pendingCall = callRequests[threadId];
  const pendingCallType = pendingCall?.type;
  const pendingRoomId = pendingCall?.roomId;
  const pendingCallerName = pendingCall?.callerName;
  const pendingToken = pendingCall?.token;
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

  const displayThreadName = useMemo(() => {
    if (isSelfChat) {
      return `${currentUser?.name || "You"} (Notes)`;
    }
    return primaryParticipant?.name || thread?.name || "Chat";
  }, [isSelfChat, primaryParticipant?.name, thread?.name, currentUser?.name]);

  const [headerImageFailed, setHeaderImageFailed] = useState(false);

  const headerAvatarUrl = useMemo(() => {
    if (isSelfChat) {
      const self = thread?.participants?.find((p: any) => p.id === currentUser?.id);
      return (self?.avatarUrl ?? (self as any)?.avatar_url) || undefined;
    }
    const p = primaryParticipant;
    return (p?.avatarUrl ?? (p as any)?.avatar_url) || undefined;
  }, [isSelfChat, thread?.participants, primaryParticipant]);

  useEffect(() => {
    setHeaderImageFailed(false);
  }, [headerAvatarUrl]);

  const headerAvatarAvailable = Boolean(headerAvatarUrl) && !headerImageFailed;

  const headerInitial = useMemo(() => {
    const name = isSelfChat ? currentUser?.name || "You" : primaryParticipant?.name || thread?.name || "U";
    return name.charAt(0).toUpperCase();
  }, [isSelfChat, currentUser?.name, primaryParticipant?.name, thread?.name]);

  const participantStatuses = useMemo<PresenceStatus[]>(
    () =>
      otherParticipants.map(
        (participant: any) => presence[participant.id] || "offline"
      ),
    [otherParticipants, presence]
  );
  const presenceStatus = useMemo<PresenceStatus>(() => {
    if (participantStatuses.some((status) => status === "online"))
      return "online";
    if (participantStatuses.some((status) => status === "busy")) return "busy";
    if (participantStatuses.some((status) => status === "away")) return "away";
    return "offline";
  }, [participantStatuses]);

  const [draft, setDraft] = useState("");
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [currentCallType, setCurrentCallType] = useState<"audio" | "video">(
    "video"
  );
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isFileAttachmentOpen, setIsFileAttachmentOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileUploadResult[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [deleteStates, setDeleteStates] = useState<Map<string, boolean>>(
    new Map()
  );
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const userInitiatedCall = useRef(false);
  const deleteStatesCacheRef = useRef<Map<string, boolean>>(new Map());
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;

    const checkDeletePermissions = async () => {
      const messagesToCheck = messages.filter(
        (m: ChatMessage) => m.sender_id === currentUser.id && !m.is_deleted
      );
      let hasNewMessages = false;

      for (const message of messagesToCheck) {
        if (!processedMessageIdsRef.current.has(message.id)) {
          const canDelete = await supabaseMessagingService.canDeleteForEveryone(
            message.id,
            currentUser.id
          );
          deleteStatesCacheRef.current.set(message.id, canDelete);
          processedMessageIdsRef.current.add(message.id);
          hasNewMessages = true;
        }
      }

      if (hasNewMessages) {
        setDeleteStates(new Map(deleteStatesCacheRef.current));
      }
    };

    checkDeletePermissions();
  }, [messages.length, currentUser?.id]);

  const menuRef = useRef<HTMLDivElement>(null);

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

      setCurrentCallType(pendingCallType);
      setIsCallOpen(true);
      if (pendingRoomId) {
        setActiveRoomId(pendingRoomId);
      }
      if (initiatedByCurrentUser) {
        userInitiatedCall.current = true;
      }
      setIsIncomingCall(!initiatedByCurrentUser);
    } else if (!userInitiatedCall.current) {
      setIsIncomingCall(false);
      setActiveRoomId(null);
    }
  }, [
    pendingCallType,
    pendingRoomId,
    pendingCallerId,
    threadId,
    currentUserId,
  ]);

  useEffect(() => {
    if (!threadId || !currentUser) return

    const unsubscribe = supabaseMessagingService.subscribeToThread(threadId, (message) => {
      const currentMessages = getMessagesForThread(threadId)
      if (currentMessages.some((m: ChatMessage) => m.id === message.id)) {
        return
      }
      setMessagesForThread(threadId, [...currentMessages, message])
    })

    return () => {
      unsubscribe()
    }
  }, [threadId, currentUser, getMessagesForThread, setMessagesForThread])

  useEffect(() => {
    if (
      thread &&
      !minimizedThreadIds.includes(threadId) &&
      messages.length > 0
    ) {
      markThreadRead(threadId);
    }
  }, [threadId, thread, minimizedThreadIds, messages.length, markThreadRead]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el || visibleMessages.length === 0) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }, [threadId, visibleMessages.length]);

  if (!thread) return null;

  const [isSending, setIsSending] = useState(false);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;
    if (isSending) return;

    setIsSending(true);
    try {
      let uploadedAttachments = pendingFiles;

      if (pendingFiles.length > 0) {
        try {
          uploadedAttachments = await fileUploadService.uploadFiles(pendingFiles);
        } catch (uploadError: any) {
          toast.error(uploadError.message || "Failed to upload files");
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
        reply_to_id: replyingTo?.id,
      });

      fileUploadService.revokePreviews(pendingFiles);
      setDraft("");
      setPendingFiles([]);
      setReplyingTo(null);
    } catch (error: any) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = (message: ChatMessage) => {
    setReplyingTo(message);
  };

  const handleDelete = async (
    messageId: string,
    deleteForEveryone: boolean
  ) => {
    if (!currentUser) return;

    try {
      if (deleteForEveryone) {
        const canDelete = await supabaseMessagingService.canDeleteForEveryone(
          messageId,
          currentUser.id
        );
        if (!canDelete) {
          toast.error(
            "Can only delete for everyone within 15 minutes of sending"
          );
          return;
        }
        await supabaseMessagingService.deleteMessageForEveryone(
          messageId,
          currentUser.id
        );
        toast.success("Message deleted for everyone");
      } else {
        await supabaseMessagingService.deleteMessageForMe(
          messageId,
          currentUser.id
        );
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

  const handleClearAllMessages = async () => {
    if (!currentUser) return;

    const confirmed = window.confirm(
      "Are you sure you want to clear all messages in this chat? This will only clear them for you."
    );

    if (!confirmed) return;

    let prevMessagesForThread: ChatMessage[] | null = null
    try {
      prevMessagesForThread = getMessagesForThread(threadId);
      const messagesToDelete = visibleMessages;

      clearMessagesForUser(threadId, currentUser.id);

      for (const message of messagesToDelete) {
        await supabaseMessagingService.deleteMessageForMe(
          message.id,
          currentUser.id
        );
      }

      toast.success("All messages cleared");
      setShowOptionsMenu(false);
    } catch (error) {
      if (prevMessagesForThread) {
        setMessagesForThread(threadId, prevMessagesForThread);
      }
      toast.error("Failed to clear messages");
    }
  };

  const handleStartCall = async (type: "audio" | "video") => {
    try {
      userInitiatedCall.current = true;
      await startCall(threadId, type);
    } catch (error) {
      setIsCallOpen(false);
      setIsIncomingCall(false);
      setActiveRoomId(null);
      userInitiatedCall.current = false;
    }
  };

  const handleEndCall = () => {
    setIsCallOpen(false);
    setIsIncomingCall(false);
    setCurrentCallType("video");
    setActiveRoomId(null);
    userInitiatedCall.current = false;
    clearCallRequest(threadId);
  };

  const handleFilesSelected = (files: FileUploadResult[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
    setIsFileAttachmentOpen(false);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const target = prev[index];
      if (target) {
        fileUploadService.revokePreviews([target]);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleToggleMinimize = () => {
    if (minimizedThreadIds.includes(threadId)) {
      openThread(threadId);
    } else {
      onMinimize(threadId);
    }
  };

  return (
    <div className="pointer-events-auto flex w-72 sm:w-80 max-w-full sm:max-w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-2 py-3">
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
          <div>
            <div className="text-sm font-semibold text-gray-900 line-clamp-1">
              {displayThreadName}
            </div>
            <div className="text-xs text-gray-500">
              {isSelfChat
                ? "Save messages to yourself"
                : otherParticipants.length > 1
                ? `${otherParticipants.length} participants`
                : formatPresenceLabel(presenceStatus)}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
            <>
              <button
                onClick={() => handleStartCall("audio")}
                className="text-gray-500 hover:text-[#f97316]"
                title="Start voice call"
              >
                <Phone className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleStartCall("video")}
                className="text-gray-500 hover:text-[#f97316]"
                title="Start video call"
              >
                <Video className="h-4 w-4" />
              </button>
            </>

          <button
            onClick={handleToggleMinimize}
            className="text-gray-400 hover:text-gray-600"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => onClose(threadId)}
            className="text-gray-400 hover:text-gray-600"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {visibleMessages.length > 0 && (
            <div className="relative">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setShowOptionsMenu(true);
                }}
                className="text-gray-400 hover:text-gray-600"
                title="Options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showOptionsMenu && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[180px]"
                >
                  <button
                    onClick={handleClearAllMessages}
                    className="w-full px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm text-red-600"
                  >
                    <X className="h-4 w-4" />
                    <span>Clear All Chat</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        ref={messagesScrollRef}
        className="flex h-[250px] sm:h-[290px] flex-col space-y-3 sm:space-y-4 overflow-y-auto px-3 sm:px-4 py-2 sm:py-3"
      >
        {visibleMessages.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Send a message to kick off the conversation.
          </div>
        ) : (
          visibleMessages.map((message: ChatMessage) => {
              const isOwn = message.sender_id === currentUser?.id;
              const canDeleteForEveryone =
                deleteStates.get(message.id) ?? false;

              const participantPresenceMap: Record<string, 'online' | 'away' | 'busy' | 'offline'> = {};
              thread?.participants?.forEach((p: any) => {
                participantPresenceMap[p.id] = presence[p.id] || 'offline';
              });

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwn}
                  currentUserId={currentUser?.id || ""}
                  threadParticipants={
                    thread?.participants?.map((p: any) => p.id) || []
                  }
                  participantPresence={participantPresenceMap}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  canDeleteForEveryone={canDeleteForEveryone}
                />
              );
            })
        )}
        <div aria-hidden="true" />
      </div>

      {pendingFiles.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-3">
          <FilePreview files={pendingFiles} onRemove={removePendingFile} />
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="border-t border-gray-200 bg-white px-2 sm:px-3 py-2 sm:py-3"
      >
        {replyingTo && (
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
        )}

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsFileAttachmentOpen(true)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message..."
            className=" w-full px-3 py-2 border border-gray-300 rounded-full text-gray-800 text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
          />
          <button
            type="submit"
            disabled={isSending}
            className="flex h-10 w-10 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
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
        </div>
      </form>

      <FileAttachment
        isOpen={isFileAttachmentOpen}
        onClose={() => setIsFileAttachmentOpen(false)}
        onFilesSelected={handleFilesSelected}
      />
    </div>
  );
};

export default ChatWindow;
