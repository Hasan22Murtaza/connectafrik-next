"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, User, X } from "@/shared/icons";
import Portal from "@/shared/components/ui/Portal";
import {
  friendRequestService,
  type Friend,
} from "@/features/social/services/friendRequestService";
import { apiClient } from "@/lib/api-client";
import { toast } from "react-hot-toast";

interface AddChatGroupMembersModalProps {
  open: boolean;
  threadId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onAdded: (addedUserIds: string[]) => void;
}

const WA_GREEN = "#008069";

export default function AddChatGroupMembersModal({
  open,
  threadId,
  existingMemberIds,
  onClose,
  onAdded,
}: AddChatGroupMembersModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const existingSet = useMemo(
    () => new Set(existingMemberIds),
    [existingMemberIds]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setSearch("");
    setSubmitting(false);

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const list = await friendRequestService.getFriends();
        if (!cancelled) setFriends(list);
      } catch {
        if (!cancelled) {
          setFriends([]);
          toast.error("Failed to load friends");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  const availableFriends = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^@/, "");
    return friends
      .filter((f) => {
        if (existingSet.has(f.id)) return false;
        if (!q) return true;
        return (
          f.full_name?.toLowerCase().includes(q) ||
          f.username?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        (a.full_name || a.username || "").localeCompare(
          b.full_name || b.username || "",
          undefined,
          { sensitivity: "base" }
        )
      );
  }, [friends, search, existingSet]);

  const toggleFriend = (friendId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one contact");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post<{
        added_user_ids?: string[];
        added_count?: number;
      }>(`/api/chat/threads/${threadId}/participants/invite`, {
        user_ids: Array.from(selectedIds),
      });
      const added = res?.added_user_ids ?? [];
      const count = res?.added_count ?? added.length;
      if (count > 0) {
        toast.success(`Added ${count} member${count === 1 ? "" : "s"}`);
        onAdded(added);
        onClose();
      } else {
        toast.error("Selected contacts are already in the group");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to add members";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const canSubmit = selectedIds.size > 0 && !submitting;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-chat-members-title"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !submitting) onClose();
        }}
      >
        <div className="relative flex max-h-[min(90vh,640px)] w-full max-w-[480px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_12px_40px_rgba(11,20,26,0.28)] dark:bg-surface">
          {/* Header — WhatsApp: X left + title */}
          <div className="flex shrink-0 items-center gap-4 px-4 pb-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition hover:bg-[#f0f2f5] disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <h2
              id="add-chat-members-title"
              className="text-[18px] font-medium text-[#111b21] dark:text-content"
            >
              Add member
            </h2>
          </div>

          {/* Search */}
          <div className="shrink-0 px-4 pb-3 pt-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667781]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, number or @username"
                disabled={submitting}
                autoFocus
                className="w-full rounded-full border-0 bg-[#f0f2f5] py-2.5 pl-10 pr-4 text-[14px] text-[#111b21] outline-none placeholder:text-[#667781] focus:ring-0 dark:bg-surface-secondary dark:text-content"
              />
            </div>
          </div>

          {/* Contacts list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2
                  className="h-7 w-7 animate-spin"
                  style={{ color: WA_GREEN }}
                  aria-hidden
                />
              </div>
            ) : availableFriends.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-[14px] text-[#667781]">
                  {search.trim()
                    ? "No contacts match your search"
                    : "No contacts left to add"}
                </p>
              </div>
            ) : (
              <>
                <p className="px-5 pb-2 pt-1 text-[13px] font-normal text-[#667781]">
                  Contacts
                </p>
                <ul>
                  {availableFriends.map((friend) => {
                    const selected = selectedIds.has(friend.id);
                    const label = friend.full_name || friend.username || "User";
                    const subtitle = friend.username
                      ? `@${friend.username}`
                      : null;

                    return (
                      <li key={friend.id}>
                        <button
                          type="button"
                          onClick={() => toggleFriend(friend.id)}
                          disabled={submitting}
                          className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-[#f5f6f6] disabled:opacity-60 dark:hover:bg-surface-hover"
                        >
                          {/* Square checkbox — WhatsApp style */}
                          <span
                            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px] ${
                              selected
                                ? "border-transparent text-white"
                                : "border-[#8696a0] bg-transparent"
                            }`}
                            style={
                              selected
                                ? { backgroundColor: WA_GREEN }
                                : undefined
                            }
                            aria-hidden
                          >
                            {selected ? (
                              <Check className="h-3 w-3" strokeWidth={3} />
                            ) : null}
                          </span>

                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#dfe5e7]">
                            {friend.avatar_url ? (
                              <img
                                src={friend.avatar_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User className="h-6 w-6 text-[#8696a0]" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 border-b border-[#f0f2f5] py-2 dark:border-border">
                            <p className="truncate text-[16px] font-normal text-[#111b21] dark:text-content">
                              {label}
                            </p>
                            {subtitle ? (
                              <p className="truncate text-[13px] text-[#667781]">
                                {subtitle}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          {/* Bottom action — appears when contacts selected */}
          {selectedIds.size > 0 ? (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e9edef] px-4 py-3 dark:border-border">
              <p className="truncate text-[13px] text-[#667781]">
                {selectedIds.size} selected
              </p>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={!canSubmit}
                className="inline-flex h-11 min-w-[11px] items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: WA_GREEN }}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Check className="h-5 w-5" aria-hidden />
                    Add
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
