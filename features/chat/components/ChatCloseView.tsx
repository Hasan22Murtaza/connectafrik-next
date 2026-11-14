"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Loader2, Search, UserPlus, Users, X } from '@/shared/icons';
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import { useParentalControls } from "@/features/family/hooks/useParentalControls";
import { fileUploadService, type FileUploadResult } from "@/shared/services/fileUploadService";
import {
  supabaseMessagingService,
  type ChatThread,
} from "@/features/chat/services/supabaseMessagingService";

interface ChatCloseViewProps {
  onFocusSearch?: () => void;
}

function getAvatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  }
  return (words[0] || "U").slice(0, 2).toUpperCase();
}

function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
    >
      <span className="flex h-[104px] w-[104px] items-center justify-center rounded-2xl bg-surface shadow-card ring-1 ring-border-subtle transition group-hover:bg-surface-hover group-active:scale-[0.98]">
        {icon}
      </span>
      <span className="max-w-[7.5rem] text-center text-[13px] leading-snug text-content-secondary">
        {label}
      </span>
    </button>
  );
}

export default function ChatCloseView({ onFocusSearch }: ChatCloseViewProps) {
  const router = useRouter();
  const { currentUser, sendMessage, openThread } = useProductionChat();
  const parental = useParentalControls();
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [sidebarThreads, setSidebarThreads] = useState<ChatThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<FileUploadResult[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) {
      setSidebarThreads([]);
      setThreadsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchSidebarThreads = async () => {
      setThreadsLoading(true);
      try {
        const allThreads: ChatThread[] = [];
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const result = await supabaseMessagingService.getUserThreads(currentUser, {
            limit: 50,
            page,
            category: "general",
          });
          allThreads.push(...result.threads);
          hasMore = result.hasMore;
          page += 1;
          if (result.threads.length === 0) break;
        }

        if (!cancelled) {
          setSidebarThreads(
            allThreads
              .filter((thread) => !thread.archived && !thread.is_block && !thread.is_locked)
              .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                if (a.pinned && b.pinned) {
                  const pinTimeDifference =
                    new Date(b.pinned_at || 0).getTime() - new Date(a.pinned_at || 0).getTime();
                  if (pinTimeDifference) return pinTimeDifference;
                }
                return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
              })
          );
        }
      } catch (error) {
        console.error("Failed to load chat recipients:", error);
        if (!cancelled) {
          setSidebarThreads([]);
          toast.error("Could not load your chats.");
        }
      } finally {
        if (!cancelled) setThreadsLoading(false);
      }
    };

    void fetchSidebarThreads();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!contactPickerOpen || sending) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContactPickerOpen(false);
        setContactSearch("");
        setSelectedThreadIds(new Set());
        fileUploadService.revokePreviews(selectedFiles);
        setSelectedFiles([]);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [contactPickerOpen, selectedFiles, sending]);

  const filteredThreads = useMemo(() => {
    const search = contactSearch.trim().toLocaleLowerCase();
    return sidebarThreads.filter((thread) => {
      if (!search) return true;
      const otherParticipants = thread.participants.filter(
        (participant) => participant.id !== currentUser?.id
      );
      return [
        thread.name,
        thread.product_title,
        thread.last_message_preview,
        ...otherParticipants.map((participant) => participant.name),
      ].some((value) => value?.toLocaleLowerCase().includes(search));
    });
  }, [contactSearch, currentUser?.id, sidebarThreads]);

  const handleSendDocument = () => {
    if (!currentUser) {
      toast.error("Sign in to send documents.");
      return;
    }
    if (parental.onlyEmergencyMessaging) {
      toast.error("Only emergency text messages are allowed.");
      return;
    }
    if (parental.controlsActive && !parental.canSendText) {
      toast.error("Document sharing is restricted by your parent.");
      return;
    }
    documentInputRef.current?.click();
  };

  const handleDocumentSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    if (parental.onlyEmergencyMessaging) {
      toast.error("Only emergency text messages are allowed.");
      return;
    }
    if (parental.controlsActive && !parental.canSendText) {
      toast.error("Document sharing is restricted by your parent.");
      return;
    }

    try {
      const preparedFiles = await fileUploadService.fromFiles(files);
      setSelectedFiles(preparedFiles);
      setSelectedThreadIds(new Set());
      setContactSearch("");
      setContactPickerOpen(true);
    } catch (error) {
      console.error("Failed to prepare document:", error);
      toast.error("Could not open the selected document.");
    }
  };

  const toggleThreadSelection = (threadId: string) => {
    setSelectedThreadIds((previous) => {
      const next = new Set(previous);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const closeContactPicker = () => {
    if (sending) return;
    setContactPickerOpen(false);
    setContactSearch("");
    setSelectedThreadIds(new Set());
    fileUploadService.revokePreviews(selectedFiles);
    setSelectedFiles([]);
  };

  const sendDocumentToSelectedContacts = async () => {
    if (sending || selectedThreadIds.size === 0 || selectedFiles.length === 0) return;
    if (parental.onlyEmergencyMessaging || (parental.controlsActive && !parental.canSendText)) {
      toast.error(
        parental.onlyEmergencyMessaging
          ? "Only emergency text messages are allowed."
          : "Document sharing is restricted by your parent."
      );
      return;
    }

    const recipients = sidebarThreads.filter((thread) => selectedThreadIds.has(thread.id));
    if (!recipients.length) return;

    setSending(true);
    try {
      const uploadedFiles = await fileUploadService.uploadFiles(selectedFiles, {
        threadId: recipients[0].id,
      });
      const attachments = uploadedFiles.map((file) => ({
        id: file.id,
        name: file.name,
        url: file.url,
        type: file.type,
        size: file.size,
        mimeType: file.mimeType,
      }));

      for (const thread of recipients) {
        await sendMessage(thread.id, "", { content: "", attachments });
      }

      const firstThreadId = recipients[0].id;
      fileUploadService.revokePreviews(selectedFiles);
      setSelectedFiles([]);
      setSelectedThreadIds(new Set());
      setContactPickerOpen(false);
      openThread(firstThreadId);
      router.push(`/chat/${encodeURIComponent(firstThreadId)}`);
      toast.success(`Document sent to ${recipients.length} chat${recipients.length === 1 ? "" : "s"}`);
    } catch (error) {
      console.error("Failed to send document:", error);
      toast.error("Could not send document.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center  px-6">
      <div className="flex flex-wrap items-start justify-center gap-10 sm:gap-14">
        <ActionTile
          icon={<FileText className="h-9 w-9 text-content-secondary" strokeWidth={1.5} />}
          label="Send document"
          onClick={handleSendDocument}
        />
        <ActionTile
          icon={<UserPlus className="h-9 w-9 text-content-secondary" strokeWidth={1.5} />}
          label="Add contact"
          onClick={() => router.push("/friends")}
        />
        <ActionTile
          icon={<Users className="h-9 w-9 text-content-secondary" strokeWidth={1.5} />}
          label="Find people"
          onClick={() => {
            onFocusSearch?.();
            toast("Search or pick a chat to start messaging.");
          }}
        />
      </div>

      <input
        ref={documentInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,application/*"
        onChange={handleDocumentSelected}
        aria-hidden
        tabIndex={-1}
      />

      {contactPickerOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-document-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeContactPicker();
          }}
        >
          <div className="flex h-[min(88vh,600px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:h-[min(560px,85vh)] sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 id="send-document-title" className="text-lg font-semibold text-content">
                Select chats
              </h2>
              <button
                type="button"
                onClick={closeContactPicker}
                disabled={sending}
                aria-label="Close contact picker"
                className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="shrink-0 border-b border-border-subtle bg-surface px-3 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
                <input
                  type="search"
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Search name, number or @username"
                  autoComplete="off"
                  autoFocus
                  disabled={sending}
                  className="input-field !pl-10 !pr-3 focus:!border-[#FB700E] focus:!shadow-[0_0_0_3px_rgba(251,112,14,0.2)]"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="border-b border-border-subtle px-4 py-2">
                <p className="truncate text-sm text-content-secondary">
                  {selectedFiles.length === 1
                    ? selectedFiles[0].name
                    : `${selectedFiles.length} documents selected`}
                </p>
              </div>
              {threadsLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-content-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading chats…
                </div>
              ) : filteredThreads.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-content-secondary">
                  {sidebarThreads.length === 0
                    ? "No chats available."
                    : "No chats match your search."}
                </p>
              ) : (
                <>
                  <p className="px-4 py-3 text-sm text-content-secondary">Recent chats</p>
                  <ul className="divide-y divide-border-subtle">
                    {filteredThreads.map((thread) => {
                      const selected = selectedThreadIds.has(thread.id);
                      const otherParticipants = thread.participants.filter(
                        (participant) => participant.id !== currentUser?.id
                      );
                      const isGroup =
                        thread.type === "group" ||
                        Boolean(thread.group_id) ||
                        otherParticipants.length > 1;
                      const label =
                        isGroup && thread.name
                          ? thread.name
                          : otherParticipants[0]?.name || thread.name || "Chat";
                      const avatarUrl =
                        isGroup && thread.banner_url
                          ? thread.banner_url
                          : otherParticipants[0]?.avatarUrl || thread.participants[0]?.avatarUrl;
                      const subtitle =
                        thread.last_message_preview?.trim() ||
                        (otherParticipants.length === 0
                          ? "Message yourself"
                          : isGroup
                            ? `${otherParticipants.length} participants`
                            : "Tap to open chat");
                      return (
                        <li key={thread.id}>
                          <label
                            className={`group flex cursor-pointer items-center gap-3 px-4 py-3 transition ${selected ? "bg-[#FB700E]/5" : "hover:bg-surface-hover"} ${sending ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleThreadSelection(thread.id)}
                              disabled={sending}
                              className="peer sr-only"
                              aria-label={`Select ${label}`}
                            />
                            <span
                              aria-hidden="true"
                              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#FB700E]/40 ${selected ? "border-[#FB700E] bg-[#FB700E] text-white" : "border-gray-400 bg-surface group-hover:border-[#FB700E]"}`}
                            >
                              {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                            </span>
                            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-semibold text-[#FB700E]">
                              {getAvatarInitials(label)}
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt=""
                                  onError={(event) => event.currentTarget.remove()}
                                  className="absolute inset-0 h-12 w-12 rounded-full object-cover"
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-content">
                                {label}
                              </span>
                              <span className="block truncate text-xs text-content-secondary">
                                {subtitle}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="text-sm text-content-secondary">
                {selectedThreadIds.size} selected
              </span>
              <button
                type="button"
                onClick={() => void sendDocumentToSelectedContacts()}
                disabled={sending || selectedThreadIds.size === 0}
                className="flex min-w-24 items-center justify-center gap-2 rounded-full bg-[#FB700E] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e96500] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
