"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, UserPlus, Users, X } from "@/shared/icons";
import Portal from "@/shared/components/ui/Portal";
import { useProductionChat } from "@/contexts/ProductionChatContext";
import {
  friendRequestService,
  type Friend,
} from "@/features/social/services/friendRequestService";
import type { ChatParticipant } from "@/shared/types/chat";
import { toast } from "react-hot-toast";

interface CreateChatGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (threadId: string) => void;
}

export default function CreateChatGroupModal({
  open,
  onClose,
  onCreated,
}: CreateChatGroupModalProps) {
  const { startChatWithMembers } = useProductionChat();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setSearch("");
    setGroupName("");
    setCreating(false);

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
      if (event.key === "Escape" && !creating) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, creating, onClose]);

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.full_name?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q)
    );
  }, [friends, search]);

  const toggleFriend = (friendId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) {
      toast.error("Enter a group name");
      return;
    }
    if (selectedIds.size < 1) {
      toast.error("Select at least one friend");
      return;
    }

    const selectedFriends = friends.filter((f) => selectedIds.has(f.id));
    const participants: ChatParticipant[] = selectedFriends.map((f) => ({
      id: f.id,
      name: f.full_name || f.username || "User",
      avatarUrl: f.avatar_url,
    }));

    setCreating(true);
    try {
      const threadId = await startChatWithMembers(participants, {
        type: "group",
        name,
        openInDock: false,
      });
      if (!threadId) return;
      toast.success("Group created");
      onCreated(threadId);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const canCreate = groupName.trim().length > 0 && selectedIds.size >= 1 && !creating;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-chat-group-title"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !creating) onClose();
        }}
      >
        <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-content-secondary" aria-hidden />
              <h2
                id="create-chat-group-title"
                className="text-lg font-semibold text-content"
              >
                New group
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="space-y-3 border-b border-border px-4 py-3">
            <div>
              <label
                htmlFor="chat-group-name"
                className="mb-1.5 block text-sm font-medium text-content"
              >
                Group name
              </label>
              <input
                id="chat-group-name"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value.slice(0, 80))}
                placeholder="e.g. Weekend plans"
                maxLength={80}
                disabled={creating}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content outline-none placeholder:text-content-tertiary focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search friends"
                disabled={creating}
                className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-3 text-sm text-content outline-none placeholder:text-content-secondary focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <p className="text-xs text-content-secondary">
              {selectedIds.size} friend{selectedIds.size !== 1 ? "s" : ""} selected
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-primary-500" aria-hidden />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <UserPlus className="mx-auto mb-2 h-10 w-10 text-content-tertiary" aria-hidden />
                <p className="text-sm text-content-secondary">
                  {search.trim()
                    ? "No friends match your search"
                    : "No friends yet — add contacts to create a group"}
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filteredFriends.map((friend) => {
                  const selected = selectedIds.has(friend.id);
                  const label = friend.full_name || friend.username || "User";
                  return (
                    <li key={friend.id}>
                      <button
                        type="button"
                        onClick={() => toggleFriend(friend.id)}
                        disabled={creating}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                          selected
                            ? "bg-primary-50"
                            : "hover:bg-surface-hover"
                        } disabled:opacity-60`}
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-hover text-sm font-semibold text-content-secondary">
                          {friend.avatar_url ? (
                            <img
                              src={friend.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{label[0]?.toUpperCase() || "U"}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-content">
                            {label}
                          </p>
                          {friend.username ? (
                            <p className="truncate text-xs text-content-secondary">
                              @{friend.username}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                            selected
                              ? "border-primary-500 bg-primary-500"
                              : "border-border"
                          }`}
                          aria-hidden
                        >
                          {selected ? (
                            <Check className="h-3 w-3 text-white" />
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-lg px-4 py-2 text-sm font-medium text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!canCreate}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                canCreate
                  ? "bg-primary-600 text-white hover:bg-primary-700"
                  : "cursor-not-allowed bg-surface-hover text-content-tertiary"
              }`}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                "Create group"
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
