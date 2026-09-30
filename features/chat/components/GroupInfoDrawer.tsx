"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MoreVertical,
  Pencil,
  Phone,
  Search,
  Shield,
  ShieldOff,
  UserMinus,
  UserPlus,
  Video,
  X,
} from "@/shared/icons";
import { apiClient } from "@/lib/api-client";
import {
  formatChatParticipantRoleLabel,
  isChatAdminRole,
} from "@/lib/chat/chatThreadAdmin";
import { chatUserIdsEqual } from "@/features/chat/services/supabaseMessagingService";
import { fileUploadService } from "@/shared/services/fileUploadService";
import { useConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { toast } from "react-hot-toast";
import AddChatGroupMembersModal from "./AddChatGroupMembersModal";

type GroupMember = {
  id: string;
  name: string;
  avatarUrl?: string;
  role: string;
};

type MediaPreviewItem = {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  kind?: string;
};

interface GroupInfoDrawerProps {
  open: boolean;
  threadId: string;
  threadName: string;
  bannerUrl?: string | null;
  currentUserId?: string;
  /** Page layout: dock beside chat. Dock/popup: overlay. */
  variant?: "page" | "dock";
  leavingGroup?: boolean;
  onClose: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onSearchInChat: () => void;
  onOpenMediaGallery: () => void;
  onLeaveGroup: () => void;
  onMetaUpdated?: (meta: {
    name?: string;
    banner_url?: string | null;
  }) => void;
}

const WA_GREEN = "#008069";

export default function GroupInfoDrawer({
  open,
  threadId,
  threadName,
  bannerUrl,
  currentUserId,
  variant = "page",
  leavingGroup = false,
  onClose,
  onVoiceCall,
  onVideoCall,
  onSearchInChat,
  onOpenMediaGallery,
  onLeaveGroup,
  onMetaUpdated,
}: GroupInfoDrawerProps) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"overview" | "members">("overview");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewItem[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(false);

  const [localName, setLocalName] = useState(threadName);
  const [localBanner, setLocalBanner] = useState(bannerUrl || "");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(threadName);
  const [savingName, setSavingName] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(
    null
  );

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await apiClient.get<
        | GroupMember[]
        | {
            data?: Array<{
              user_id: string;
              role?: string;
              name?: string;
              avatar_url?: string | null;
            }>;
          }
        | Array<{
            user_id: string;
            role?: string;
            name?: string;
            avatar_url?: string | null;
          }>
      >(`/api/chat/threads/${threadId}/participants`);

      const rows = Array.isArray(res) ? res : (res as any)?.data ?? [];
      const mapped: GroupMember[] = (rows as any[]).map((row) => ({
        id: row.user_id || row.id,
        name: row.name || "User",
        avatarUrl: row.avatar_url || row.avatarUrl || undefined,
        role: (row.role || "member").toLowerCase(),
      }));
      setMembers(mapped);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [threadId]);

  const loadMediaPreview = useCallback(async () => {
    setMediaLoading(true);
    try {
      const res = await apiClient.get<{
        items?: MediaPreviewItem[];
        hasMore?: boolean;
        pageSize?: number;
      }>(`/api/chat/threads/${threadId}/media`, {
        tab: "media",
        limit: 8,
        page: 0,
      });
      const items = Array.isArray(res?.items) ? res.items : [];
      setMediaPreview(items.slice(0, 4));
      // Approximate count from first page; gallery shows full set
      setMediaCount(
        items.length >= 8 ? items.length : items.length
      );
    } catch {
      setMediaPreview([]);
      setMediaCount(0);
    } finally {
      setMediaLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (!open) return;
    setView("overview");
    setLocalName(threadName);
    setNameDraft(threadName);
    setLocalBanner(bannerUrl || "");
    setEditingName(false);
    setShowAddMembers(false);
    setMemberMenuId(null);
    void loadMembers();
    void loadMediaPreview();
  }, [open, threadId, threadName, bannerUrl, loadMembers, loadMediaPreview]);

  useEffect(() => {
    if (!memberMenuId) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-group-member-menu]")) return;
      setMemberMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [memberMenuId]);

  const isAdmin = useMemo(() => {
    if (!currentUserId) return false;
    const me = members.find((m) => chatUserIdsEqual(m.id, currentUserId));
    const role = me?.role || "";
    return isChatAdminRole(role) || role === "manager";
  }, [members, currentUserId]);

  const memberCount = members.length;

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) {
      toast.error("Enter a group name");
      return;
    }
    if (next === localName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await apiClient.patch(`/api/chat/threads/${threadId}`, {
        name: next,
        title: next,
      });
      setLocalName(next);
      setEditingName(false);
      onMetaUpdated?.({ name: next });
      toast.success("Group name updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update name");
    } finally {
      setSavingName(false);
    }
  };

  const handleBannerFile = async (file: File | null) => {
    if (!file || !isAdmin) return;
    setUploadingBanner(true);
    try {
      const prepared = await fileUploadService.fromFiles([file]);
      const uploaded = await fileUploadService.uploadFiles(prepared);
      const url = uploaded[0]?.url || uploaded[0]?.previewUrl;
      if (!url) throw new Error("Upload failed");
      await apiClient.patch(`/api/chat/threads/${threadId}`, {
        banner_url: url,
      });
      setLocalBanner(url);
      onMetaUpdated?.({ banner_url: url });
      toast.success("Group photo updated");
      fileUploadService.revokePreviews(prepared);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update photo");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleChangeRole = async (
    member: GroupMember,
    nextRole: "admin" | "member"
  ) => {
    if (!isAdmin || updatingRoleUserId) return;
    const makingAdmin = nextRole === "admin";
    const confirmed = await confirm({
      title: makingAdmin ? "Make admin" : "Dismiss as admin",
      message: makingAdmin
        ? `Make ${member.name} a group admin? They will be able to add, remove, and manage members.`
        : `Dismiss ${member.name} as admin? They will become a regular member.`,
      confirmLabel: makingAdmin ? "Make admin" : "Dismiss",
    });
    if (!confirmed) return;
    setMemberMenuId(null);
    setUpdatingRoleUserId(member.id);
    try {
      await apiClient.post(`/api/chat/threads/${threadId}/participants/role`, {
        user_id: member.id,
        role: nextRole,
      });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, role: nextRole } : m
        )
      );
      toast.success(
        makingAdmin
          ? `${member.name} is now an admin`
          : `${member.name} is no longer an admin`
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to update role");
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const handleRemoveMember = async (member: GroupMember) => {
    if (!isAdmin || removingMemberId) return;
    if (chatUserIdsEqual(member.id, currentUserId)) return;
    const confirmed = await confirm({
      title: "Remove member",
      message: `Remove ${member.name} from this group?`,
      confirmLabel: "Remove",
    });
    if (!confirmed) return;
    setMemberMenuId(null);
    setRemovingMemberId(member.id);
    try {
      await apiClient.post(
        `/api/chat/threads/${threadId}/participants/remove`,
        { user_id: member.id }
      );
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success(`${member.name} removed`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (!open) return null;

  const initial = (localName || "G").charAt(0).toUpperCase();

  const actionBtn = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    disabled?: boolean
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 disabled:opacity-40"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f0f2f5] text-[#54656f] transition hover:bg-[#e9edef]">
        {icon}
      </span>
      <span className="text-[12px] text-[#54656f]">{label}</span>
    </button>
  );

  const membersList = (
    <ul className="divide-y divide-[#f0f2f5]">
      {[...members]
        .sort((a, b) => {
          const aAdmin = isChatAdminRole(a.role) ? 0 : 1;
          const bAdmin = isChatAdminRole(b.role) ? 0 : 1;
          if (aAdmin !== bAdmin) return aAdmin - bAdmin;
          return (a.name || "").localeCompare(b.name || "");
        })
        .map((p) => {
          const isYou = chatUserIdsEqual(p.id, currentUserId);
          const memberIsAdmin = isChatAdminRole(p.role);
          const roleLabel = formatChatParticipantRoleLabel(p.role);
          const label = p.name || "User";
          const showMenu = isAdmin && !isYou;
          const menuOpen = memberMenuId === p.id;
          const busy =
            removingMemberId === p.id || updatingRoleUserId === p.id;

          return (
            <li key={p.id} className="relative flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/user/${encodeURIComponent(p.id)}`);
                }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#dfe5e7]">
                  {p.avatarUrl ? (
                    <img
                      src={p.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#54656f]">
                      {label.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] text-[#111b21]">
                      {isYou ? `${label} (you)` : label}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        memberIsAdmin || p.role === "manager"
                          ? "bg-[#fff3e0] text-[#c4690e]"
                          : "bg-[#f0f2f5] text-[#667781]"
                      }`}
                    >
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </button>
              {showMenu ? (
                <div className="relative shrink-0" data-group-member-menu>
                  <button
                    type="button"
                    onClick={() =>
                      setMemberMenuId((id) => (id === p.id ? null : p.id))
                    }
                    disabled={busy}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#54656f] hover:bg-[#f0f2f5] disabled:opacity-50"
                    aria-label={`Manage ${label}`}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreVertical className="h-4 w-4" />
                    )}
                  </button>
                  {menuOpen ? (
                    <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-[#e9edef] bg-white p-1 shadow-xl">
                      {memberIsAdmin ? (
                        <button
                          type="button"
                          onClick={() => void handleChangeRole(p, "member")}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#111b21] hover:bg-[#f0f2f5]"
                        >
                          <ShieldOff className="h-4 w-4 text-[#54656f]" />
                          Dismiss as admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleChangeRole(p, "admin")}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#111b21] hover:bg-[#f0f2f5]"
                        >
                          <Shield className="h-4 w-4 text-[#54656f]" />
                          Make admin
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(p)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <UserMinus className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
    </ul>
  );

  const panel = (
    <aside
      className={
        variant === "page"
          ? "absolute inset-0 z-40 flex h-full w-full flex-col border-l border-[#e9edef] bg-white dark:border-border dark:bg-surface sm:static sm:z-auto sm:w-[380px] sm:max-w-[380px] sm:shrink-0"
          : "absolute inset-0 z-40 flex h-full w-full flex-col bg-white dark:bg-surface"
      }
      role="dialog"
      aria-label="Group info"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-[#e9edef] bg-[#f0f2f5] px-3 py-3 dark:border-border dark:bg-surface-secondary">
        {view === "members" ? (
          <button
            type="button"
            onClick={() => setView("overview")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef]"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <h2 className="text-[16px] font-medium text-[#111b21] dark:text-content">
          {view === "members" ? `${memberCount} members` : "Group info"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f0f2f5] dark:bg-surface-secondary">
        {view === "members" ? (
          <div className="mt-2 bg-white dark:bg-surface">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setShowAddMembers(true)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#f5f6f6]"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: WA_GREEN }}
                >
                  <UserPlus className="h-5 w-5" />
                </span>
                <span className="text-[15px] font-medium" style={{ color: WA_GREEN }}>
                  Add members
                </span>
              </button>
            ) : null}
            {membersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#008069]" />
              </div>
            ) : (
              membersList
            )}
          </div>
        ) : (
          <>
            {/* Profile */}
            <div className="bg-white px-4 pb-5 pt-6 text-center dark:bg-surface">
              <div className="relative mx-auto h-[120px] w-[120px]">
                <div className="h-full w-full overflow-hidden rounded-full bg-[#dfe5e7]">
                  {localBanner ? (
                    <img
                      src={localBanner}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-[#54656f]">
                      {initial}
                    </div>
                  )}
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingBanner}
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md disabled:opacity-60"
                    style={{ backgroundColor: WA_GREEN }}
                    aria-label="Edit group photo"
                    title="Edit"
                  >
                    {uploadingBanner ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    e.target.value = "";
                    void handleBannerFile(file);
                  }}
                />
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 px-2">
                {editingName && isAdmin ? (
                  <div className="flex w-full max-w-[280px] items-center gap-2">
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value.slice(0, 80))}
                      className="min-w-0 flex-1 rounded-lg border border-[#e9edef] px-3 py-1.5 text-center text-lg font-medium text-[#111b21] outline-none focus:border-[#008069]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveName();
                        if (e.key === "Escape") {
                          setEditingName(false);
                          setNameDraft(localName);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void saveName()}
                      disabled={savingName}
                      className="text-sm font-medium"
                      style={{ color: WA_GREEN }}
                    >
                      {savingName ? "…" : "Save"}
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="max-w-[260px] truncate text-[20px] font-medium leading-tight text-[#111b21] dark:text-content">
                      {localName || "Group"}
                    </h3>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNameDraft(localName);
                          setEditingName(true);
                        }}
                        className="rounded-full p-1 text-[#54656f] hover:bg-[#f0f2f5]"
                        aria-label="Edit group name"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              <p className="mt-1 text-[14px] text-[#667781]">
                Group ·{" "}
                <button
                  type="button"
                  onClick={() => setView("members")}
                  className="font-medium hover:underline"
                  style={{ color: WA_GREEN }}
                >
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </button>
              </p>

              <div className="mt-5 flex items-start justify-center gap-6">
                {actionBtn(
                  <Phone className="h-5 w-5" />,
                  "Voice",
                  () => {
                    onClose();
                    onVoiceCall();
                  }
                )}
                {actionBtn(
                  <Video className="h-5 w-5" />,
                  "Video",
                  () => {
                    onClose();
                    onVideoCall();
                  }
                )}
                {actionBtn(
                  <UserPlus className="h-5 w-5" />,
                  "Add",
                  () => setShowAddMembers(true),
                  !isAdmin
                )}
                {actionBtn(
                  <Search className="h-5 w-5" />,
                  "Search",
                  () => {
                    onClose();
                    onSearchInChat();
                  }
                )}
              </div>
            </div>

            {/* Media */}
            <button
              type="button"
              onClick={onOpenMediaGallery}
              className="mt-2 w-full bg-white px-4 py-3 text-left hover:bg-[#fafafa] dark:bg-surface"
            >
              <div className="flex items-center gap-3">
                <ImageIcon className="h-5 w-5 text-[#54656f]" />
                <span className="flex-1 text-[15px] text-[#111b21] dark:text-content">
                  Media, links and docs
                </span>
                <span className="text-[14px] text-[#667781]">
                  {mediaLoading ? "…" : mediaCount || mediaPreview.length || ""}
                </span>
                <ChevronRight className="h-4 w-4 text-[#667781]" />
              </div>
              {mediaPreview.length > 0 ? (
                <div className="mt-3 flex gap-1.5 overflow-hidden">
                  {mediaPreview.map((item) => (
                    <div
                      key={item.id}
                      className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-md bg-[#f0f2f5]"
                    >
                      {item.kind === "video" ? (
                        <div className="relative h-full w-full">
                          <img
                            src={item.thumbnail_url || item.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <Video className="absolute bottom-1 right-1 h-3.5 w-3.5 text-white drop-shadow" />
                        </div>
                      ) : (
                        <img
                          src={item.thumbnail_url || item.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </button>

            {/* Members preview */}
            <div className="mt-2 bg-white dark:bg-surface">
              <button
                type="button"
                onClick={() => setView("members")}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#fafafa]"
              >
                <span className="text-[14px] text-[#667781]">
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </span>
                <ChevronRight className="h-4 w-4 text-[#667781]" />
              </button>
              {membersLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[#008069]" />
                </div>
              ) : (
                <div className="pb-1">{membersList}</div>
              )}
            </div>

            {/* Leave */}
            <div className="mt-2 mb-4 bg-white dark:bg-surface">
              <button
                type="button"
                onClick={onLeaveGroup}
                disabled={leavingGroup}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {leavingGroup ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
                <span className="text-[15px] font-medium">Leave group</span>
              </button>
            </div>
          </>
        )}
      </div>

      <AddChatGroupMembersModal
        open={showAddMembers}
        threadId={threadId}
        existingMemberIds={members.map((m) => m.id)}
        onClose={() => setShowAddMembers(false)}
        onAdded={() => void loadMembers()}
      />
      {dialog}
    </aside>
  );

  return panel;
}
