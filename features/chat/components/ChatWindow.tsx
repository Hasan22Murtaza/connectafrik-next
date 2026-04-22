"use client";
// @ts-nocheck

import { useProductionChat } from "@/contexts/ProductionChatContext";
import {
  supabaseMessagingService,
  type ChatMessage,
} from "@/features/chat/services/supabaseMessagingService";
import { apiClient } from "@/lib/api-client";
import { useMembers } from "@/shared/hooks/useMembers";
import { useTypingIndicator } from "@/shared/hooks/useTypingIndicator";
import {
  FileUploadResult,
  fileUploadService,
} from "@/shared/services/fileUploadService";
import type { PresenceStatus } from "@/shared/types/chat";
import {
  Minus,
  MoreVertical,
  Mic,
  Phone,
  Plus,
  Send,
  Square,
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
import ChatAttachmentMenu from "./ChatAttachmentMenu";
import ChatWebcamCapture from "./ChatWebcamCapture";
import FilePreview from "./FilePreview";
import { MessageBubble } from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { Tooltip } from "@/shared/components/ui/Tooltip";

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
const MESSAGES_PAGE_SIZE = 50;

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
    markMessageDeletedForUser,
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

  const isGroupThread =
    thread?.type === "group" ||
    Boolean(thread?.group_id) ||
    (thread?.participants?.length ?? 0) > 2 ||
    Boolean((thread as any)?.isGroup);

  const displayThreadName = useMemo(() => {
    if (isSelfChat) {
      return `${currentUser?.name || "You"} (Notes)`;
    }
    // For group threads, prefer the thread/group name over a participant's name
    if (isGroupThread && thread?.name) {
      return thread.name;
    }
    return primaryParticipant?.name || thread?.name || "Chat";
  }, [isSelfChat, isGroupThread, primaryParticipant?.name, thread?.name, currentUser?.name]);

  const [headerImageFailed, setHeaderImageFailed] = useState(false);
  /** Fetched banner; scoped by threadId so a switch never shows the previous chat's image */
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
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [pendingFiles, setPendingFiles] = useState<FileUploadResult[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
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
  }, [threadId]);

  const loadOlderMessages = async () => {
    if (!threadId || isLoadingOlderMessages || !hasOlderMessages) return;
    const scrollEl = messagesScrollRef.current;
    if (!scrollEl) return;

    setIsLoadingOlderMessages(true);
    const prevScrollHeight = scrollEl.scrollHeight;
    const prevScrollTop = scrollEl.scrollTop;
    const nextPage = historyPage + 1;

    try {
      const olderMessages = await supabaseMessagingService.getThreadMessages(threadId, {
        page: nextPage,
        limit: MESSAGES_PAGE_SIZE,
      });

      if (!olderMessages.length) {
        setHasOlderMessages(false);
        return;
      }
      if (olderMessages.length < MESSAGES_PAGE_SIZE) {
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
    } catch (error) {
      console.error("Error loading older messages:", error);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  };

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

      if (!initiatedByCurrentUser) {
        const syncKey = `${threadId}:${pendingCall?.callId || ""}:${pendingRoomId || ""}`;
        if (lastIncomingCallSyncKeyRef.current === syncKey) {
          return;
        }
        lastIncomingCallSyncKeyRef.current = syncKey;
      }

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
      lastIncomingCallSyncKeyRef.current = "";
      setIsIncomingCall(false);
      setActiveRoomId(null);
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
    if (isPrependingHistoryRef.current) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }, [threadId, visibleMessages.length]);

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
  }, [threadId, historyPage, isLoadingOlderMessages, hasOlderMessages, messages.length]);

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

  if (!thread) return null;

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
      stopTyping();
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

  const handleClearAllMessages = async () => {
    if (!currentUser) return;

    const confirmed = window.confirm(
      "Are you sure you want to clear all messages in this chat? This will only clear them for you."
    );

    if (!confirmed) return;

    let prevMessagesForThread: ChatMessage[] | null = null
    try {
      prevMessagesForThread = getMessagesForThread(threadId);

      clearMessagesForUser(threadId, currentUser.id);

      await supabaseMessagingService.clearThreadMessagesForMe(
        threadId,
        currentUser.id
      );

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
      await startCall(threadId, type, primaryParticipant?.id, primaryParticipant?.name, primaryParticipant?.avatarUrl);
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
          try {
            const results = await fileUploadService.fromFiles([file]);
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
            });
            fileUploadService.revokePreviews(results);
            stopTyping();
          } catch (err: any) {
            toast.error(err?.message || "Failed to send voice message");
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
    draft.trim().length > 0 || pendingFiles.length > 0;

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
    <div className="pointer-events-auto flex w-72 sm:w-80 max-w-full sm:max-w-full flex-col border border-1 border-gray-100  rounded-2xl  bg-white shadow-2xl">
      <div className="flex items-center justify-between  bg-gray-50 rounded-tl-2xl rounded-tr-2xl  border-b border-gray-200 p-2">
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
                : (thread?.participants?.length ?? 0) > 2
                  ? `${thread?.participants?.length} participants`
                  : formatPresenceLabel(presenceStatus)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip text="Start audio call" position="top">
            <button
              onClick={() => handleStartCall("audio")}
              className="text-gray-500 hover:text-[#f97316] transition"
            >
              <Phone className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip text="Start video call" position="top">
          <button
            onClick={() => handleStartCall("video")}
            className="text-gray-500 hover:text-[#f97316]"
            title="Start video call"
          >
            <Video className="h-4 w-4" />
          </button>
          </Tooltip>
          <Tooltip text="Minimize chat" position="top">
          <button
            onClick={handleToggleMinimize}
            className="text-gray-400 hover:text-gray-600"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          </Tooltip>
          <Tooltip text="Close chat" position="top">
          <button
            onClick={() => onClose(threadId)}
            className="text-gray-400 hover:text-gray-600"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
          </Tooltip>

          {visibleMessages.length > 0 && (
            <Tooltip text="options" position="top">
            <div className="relative">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setShowOptionsMenu(true);
                }}
                className="text-gray-400 hover:text-gray-600"
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
            </Tooltip>
          )}
        </div>
      </div>

      <div
        ref={messagesScrollRef}
        className="flex h-[250px] sm:h-[290px] flex-col space-y-3 sm:space-y-4 overflow-y-auto px-3 sm:px-4 py-2 sm:py-3"
      >
        {isLoadingOlderMessages && (
          <div className="py-1 text-center text-xs text-gray-500">Loading older messages...</div>
        )}
        {visibleMessages.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Send a message to kick off the conversation.
          </div>
        ) : (
          visibleMessages.map((message: ChatMessage) => {
            const isOwn = message.sender_id === currentUser?.id;

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
                onReact={handleMessageReaction}
              />
            );
          })
        )}
        <div aria-hidden="true" />
      </div>

      {/* WhatsApp-style typing indicator */}
      <TypingIndicator isTyping={typingUserIds.length > 0} />

      {pendingFiles.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-3">
          <FilePreview files={pendingFiles} onRemove={removePendingFile} />
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="rounded-bl-2xl rounded-br-2xl border-t border-gray-200 bg-white px-2 sm:px-3 py-2 sm:py-3"
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
              onClick={() => setAttachmentMenuOpen((o) => !o)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 ${attachmentMenuOpen ? "ring-1 ring-orange-500 text-primary-600" : ""
                }`}
              aria-label="Attach"
              aria-expanded={attachmentMenuOpen}
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
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              handleTyping();
            }}
            placeholder="Type a message"
            className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-full text-gray-800 text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
          />
          {showSendButton ? (
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
          ) : (
            <button
              type="button"
              onClick={toggleVoiceRecording}
              disabled={isSending}
              className={`flex h-10 w-10 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed ${voiceRecording
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-primary-600 hover:bg-primary-700"
                }`}
              aria-label={voiceRecording ? "Stop recording" : "Voice message"}
              title={voiceRecording ? "Stop and send" : "Voice message"}
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
    </div>
  );
};

export default ChatWindow;
